# Zoner AI 채팅 (학습 보조) 설계

## 배경

Mypage의 "빠른 실행" 퀵액션에 `AI 채팅` 버튼이 `/ai-chat` 경로로 이미 존재하지만, 실제 라우트/컴포넌트가 없어 클릭해도 아무 반응이 없다. 이 버튼을 눌렀을 때 학습 보조용 LLM(Anthropic Claude)과 실시간으로 질의응답할 수 있는 채팅 화면을 신설한다.

이 프로젝트는 백엔드 서버 없이 프론트엔드가 Supabase를 직접 호출하는 구조다. Claude API 키를 프론트에 그대로 두면 노출·과금 악용 위험이 있으므로, Supabase Edge Function을 프록시로 두어 API 키를 서버 쪽에만 보관한다.

## 아키텍처

```
브라우저(React, AiChat.js)
  → fetch(SUPABASE_URL/functions/v1/ai-chat, Authorization: Bearer <user JWT>)
  → Supabase Edge Function (ai-chat, Deno)
      - JWT로 사용자 인증 확인
      - 오늘자 메시지 수 카운트 (chat_messages 테이블) → 30회 초과 시 429 응답
      - Anthropic Claude API 스트리밍 호출 (모델 ID: claude-haiku-4-5-20251001,
        API 키는 Edge Function 환경변수(secret)에만 존재)
      - 응답 스트림을 그대로 클라이언트로 중계(relay)
      - 스트림 완료 후 user/assistant 메시지 둘 다 chat_messages에 저장
  → 프론트는 스트림을 읽어 타이핑 효과로 렌더링
```

`supabase.functions.invoke()`는 스트리밍 응답을 받을 수 없으므로, 이 호출만 Edge Function URL을 직접 `fetch`하고 세션의 `access_token`을 `Authorization` 헤더에 수동으로 실어 보낸다. Claude API 키는 Edge Function 환경변수(`supabase secrets set`)에만 두고 프론트/DB 어디에도 노출하지 않는다.

Edge Function은 Supabase CLI로 최초 설정(`supabase functions new ai-chat`, `supabase secrets set ANTHROPIC_API_KEY=...`, `supabase functions deploy ai-chat`)이 필요하다 — 이 프로젝트에 Supabase Edge Function을 도입하는 첫 사례다.

## 데이터 모델

```sql
-- supabase/migrations/{timestamp}_create_chat_messages.sql

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;

create index idx_chat_messages_user_id_created_at on chat_messages (user_id, created_at);

create policy "chat_messages_select_own"
  on chat_messages for select
  using (auth.uid() = user_id);

create policy "chat_messages_insert_own"
  on chat_messages for insert
  with check (auth.uid() = user_id);
```

- `study_sessions`와 동일한 패턴(uuid pk, `auth.users` FK, RLS select/insert own).
- `role`은 DB `ENUM` 대신 `TEXT` + `CHECK` (db-conventions.md 규약).
- 삭제 기능은 범위 밖(단일 연속 대화라 트래시 개념 없음).
- 하루 메시지 카운트는 별도 카운터 테이블 없이 `chat_messages`에서 `role='user' AND created_at >= 오늘 00:00 (KST)`로 직접 집계한다. `idx_chat_messages_user_id_created_at` 인덱스가 이 쿼리를 커버한다.
- Edge Function은 `service_role` 키로 이 테이블에 접근한다(RLS를 우회해 INSERT/카운트 조회를 수행하되, 항상 인증된 `user_id`로만 필터링).

## Edge Function 로직 (`supabase/functions/ai-chat/index.ts`)

```
1. Authorization 헤더에서 JWT 추출 → supabase.auth.getUser(jwt)로 사용자 확인
   실패 시 401 반환

2. 오늘(KST 00:00~) chat_messages 중 role='user' 개수 조회
   >= 30 이면 429 { error: '오늘 사용 가능한 메시지 횟수를 다 썼어요. 내일 다시 이용해주세요.' }

3. 요청 바디에서 사용자 메시지(content: string) 받음
   빈 문자열/4000자 초과면 400

4. user 메시지를 chat_messages에 INSERT (role='user')

5. 이전 대화 이력 중 최근 20개 메시지를 조회해 Claude API 대화 컨텍스트로 구성
   시스템 프롬프트 고정: "당신은 학습을 돕는 AI 보조 튜터입니다. 간결하고 실용적으로 답하세요."

6. Anthropic Messages API를 stream: true로 호출
   응답 스트림을 그대로 클라이언트에 relay (Response body를 ReadableStream으로 전달)

7. 스트림이 끝나면 relay 도중 누적한 전체 assistant 응답 텍스트를
   chat_messages에 INSERT (role='assistant')

8. Anthropic API 에러(429/500 등) 발생 시 502로 클라이언트에 전달.
   이미 저장된 user 메시지는 그대로 유지(재시도 시 같은 질문을 다시 입력할 필요 없게)
```

Rate limit 카운트는 user 메시지 INSERT 및 Anthropic 호출 **이전**에 확인한다 — 한도 초과 시 Anthropic API 호출 자체가 발생하지 않아야 비용 방지 목적을 달성한다.

## 프론트엔드 변경

**새 파일**
- `src/components/AiChat.js` — `/ai-chat` 라우트, `App.js`에 등록
- `src/components/AiChat.css`
- `src/lib/aiChat.js` — Edge Function 호출 + 스트림 파싱 공유 로직(컴포넌트에서 로직 분리, `trash.js`와 동일한 패턴)

**화면 흐름**
1. 진입 시 로그인 확인(다른 페이지와 동일 패턴) → 비로그인 시 `/login` 리다이렉트
2. `chat_messages`에서 본인 이력 전체를 시간순으로 로드해 대화창에 렌더링 (user는 우측 정렬, assistant는 좌측 정렬 — 말풍선 UI)
3. 하단 입력창 + 전송 버튼. 전송 시:
   - user 메시지를 즉시 낙관적으로 리스트에 추가
   - Edge Function 스트림 호출 시작, assistant 메시지 버블을 스트리밍 중 텍스트로 실시간 업데이트
   - 완료되면 그대로 유지(이미 DB에도 저장됐으므로 별도 재조회 불필요)
4. 429(한도 초과) 응답 시: 입력창 비활성화 + 안내 문구(`role="alert"`)
5. 네트워크/API 에러 시: 실패한 user 메시지 옆에 "답변을 받지 못했어요. 다시 시도" 버튼

**접근성**
- assistant 메시지 영역에 `aria-live="polite"` — 스트리밍 중간마다 전부 읽히지 않도록, 완료 시점 위주로 인지되게 구성
- 입력창은 `<label>` + `<textarea>`, Enter 전송/Shift+Enter 줄바꿈
- 스트리밍 중에도 포커스는 입력창 유지

**스타일**: 기존 dark 톤 디자인 토큰(`--color-bg`, `--color-surface` 등) 그대로 사용. Mypage 퀵액션의 "AI 채팅" 버튼이 이미 `/ai-chat`을 가리키므로 라우트만 추가되면 진입 동선은 그대로 살아난다.

## 에러 처리

- **빈 메시지 전송**: 프론트에서 trim 후 빈 문자열이면 전송 버튼 비활성화(API 호출 자체를 안 만듦)
- **메시지 길이 초과(4000자)**: 프론트에서 입력 중 글자 수 표시 + 초과 시 전송 막음. 서버도 동일 기준으로 400 반환(방어)
- **로그인 세션 만료**: Edge Function이 401 반환 → 프론트가 `/login`으로 리다이렉트
- **중복 전송(연속 클릭/Enter 연타)**: 스트리밍 응답을 기다리는 동안 입력창·전송 버튼 비활성화
- **Anthropic API 장애/429**: Edge Function이 502로 전달 → 프론트는 "답변을 받지 못했어요. 다시 시도" 버튼 노출, user 메시지는 유지
- **스트림 중간 연결 끊김**: 그때까지 받은 부분 텍스트는 화면에 남기고, 말풍선 하단에 "응답이 끊겼어요. 다시 시도" 버튼 추가(부분 응답은 DB에 저장하지 않음 — 완결된 응답만 저장)
- **일일 한도 초과(30회/일)**: 429 응답, 입력창 비활성화 + 안내 문구. 자정(KST) 이후엔 카운트 쿼리가 당일 기준이라 자연히 해제(별도 리셋 로직 불필요)

## 범위 밖 (이번 구현 제외)

- 여러 대화방 생성/전환/삭제 (단일 연속 대화로 확정)
- 학습 세션 데이터 연동한 개인화 답변 (일반 Q&A로 시작하기로 확정)
- 메시지 개별 삭제/대화 초기화
- 이미지·파일 첨부
- 모델 선택 UI (Haiku 고정)
- 사용량 대시보드/관리자 모니터링

## 검증

- Edge Function 배포 후 로그인 사용자로 메시지 전송 → 스트리밍 응답이 화면에 타이핑되듯 표시되는지 확인
- 새로고침 후 `/ai-chat` 재진입 시 이전 대화 이력이 그대로 로드되는지 확인
- 비로그인 상태로 `/ai-chat` 접근 시 `/login`으로 리다이렉트되는지 확인
- 하루 31번째 메시지 전송 시 429와 함께 입력창이 비활성화되는지 확인
- `chat_messages` 테이블에 RLS 정책 적용 후, 다른 사용자의 메시지가 조회되지 않는지 확인
- 네트워크 차단 상태에서 메시지 전송 시 "다시 시도" 버튼이 뜨고, 재시도 시 정상 전송되는지 확인
