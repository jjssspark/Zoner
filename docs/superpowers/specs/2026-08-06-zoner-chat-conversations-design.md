# Zoner — AI 채팅 대화방 분리 (과목별)

**날짜**: 2026-08-06
**대상**: `supabase/migrations/`, `supabase/functions/ai-chat/index.ts`, `src/lib/aiChat.js`, `src/components/AiChat.js`, `src/components/AiChat.css`
**선행 스펙**: `docs/superpowers/specs/2026-08-05-zoner-ai-chat-design.md` (채팅 기능 자체)

## 배경

현재 AI 채팅은 사용자당 대화가 **하나뿐**이다. `chat_messages`가 `user_id`로만 묶여 있어서, 수학을 묻다가 영어를 물으면 같은 흐름에 쌓인다.

사용자 요청: **과목별로 방을 나누고 싶다.**

## 이 작업이 프론트만의 일이 아닌 이유 (핵심)

메시지를 **클라이언트가 저장하지 않는다.** `AiChat.js`는 `select`만 하고(34-35행), 쓰기는 전부 Edge Function `ai-chat`이 한다.

| 위치 | 하는 일 | 필요한 변경 |
|---|---|---|
| `index.ts:64-74` | 일일 30건 제한 카운트 | **변경 없음** — 사용자 단위 유지 |
| `index.ts:81-83` | 사용자 메시지 insert | `conversation_id` 추가 |
| `index.ts:89-94` | **최근 20건을 LLM 맥락으로 로드** | ⚠️ **대화별로 좁혀야 함** |
| `index.ts:182-184` | AI 답변 insert | `conversation_id` 추가 |

**89-94행이 이 작업의 핵심이다.** 여기를 고치지 않으면 화면에서만 방이 나뉘고 AI는 여전히 전 과목을 섞어 읽는다. 방을 나누는 목적 자체가 사라진다.

일일 제한을 대화 단위로 바꾸면 방을 새로 파는 것으로 우회할 수 있으므로 **사용자 단위를 유지한다.**

## 설계 결정

### 대화 제목: 첫 메시지에서 자동 생성 + 수정 가능

새 대화는 `새 대화`라는 기본 제목으로 시작하고, **첫 사용자 메시지가 저장될 때** 그 내용 앞부분을 제목으로 삼는다. 사용자는 언제든 이름을 바꿀 수 있다.

- 만들 때 제목 입력을 강요하지 않는다 — 빨리 묻고 싶을 때 단계가 늘면 마찰이 된다
- AI에게 제목을 요약시키는 안은 채택하지 않았다. API 호출이 한 번 더 들고 일일 30건 제한과의 관계를 따로 정리해야 한다
- 잘라내기 기준은 구현 시 확정하되, **자르는 위치가 단어 중간이어도 허용한다**(한국어는 어절 경계 판정이 비싸다). 원문이 기준 길이 이하면 그대로 쓴다

### 기존 대화는 반드시 보존한다

이미 쌓인 `chat_messages`가 있다. 마이그레이션에서 **사용자별로 기본 대화 하나를 만들어 기존 메시지를 전부 그 아래로 넣는다.** 유실은 허용하지 않는다.

## 스키마

```sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '새 대화',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table conversations enable row level security;
create index idx_conversations_user_id_updated_at on conversations (user_id, updated_at desc);
-- RLS: select / insert / update / delete 모두 auth.uid() = user_id

alter table chat_messages
  add column conversation_id uuid references conversations(id) on delete cascade;
```

**백필 순서가 중요하다.** 아래 세 단계는 한 마이그레이션 안에서 이 순서로 실행되어야 한다.

1. 메시지를 가진 사용자마다 대화 1건 생성 (제목: `이전 대화`, `created_at`은 그 사용자의 가장 오래된 메시지 시각)
2. 기존 메시지의 `conversation_id`를 그 대화로 채움
3. `conversation_id`를 `not null`로 승격 + `(conversation_id, created_at)` 인덱스 생성

3번을 1·2번보다 먼저 하면 마이그레이션이 실패한다. 그리고 이 백필은 **사용자당 대화가 정확히 하나뿐인 시점에만 안전하다** — 배포된 뒤에 다시 돌리면 안 된다.

기존 `chat_messages` RLS(`select_own`, `insert_own`)는 그대로 둔다. 대화 소유권은 `user_id`로 이미 보장된다.

### `updated_at` 갱신

대화 목록을 최근 활동순으로 정렬하려면 메시지가 오갈 때 `conversations.updated_at`이 갱신되어야 한다. Edge Function이 메시지를 저장하므로 **거기서 함께 갱신한다.** DB 트리거는 쓰지 않는다 — 쓰기 주체가 한 곳뿐이라 트리거가 주는 이득이 없고 디버깅만 어려워진다.

## Edge Function 변경

요청 본문에 `conversationId`를 받는다.

- **소유권 검증 필수.** 남의 `conversationId`를 보내면 거절해야 한다. RLS가 있더라도 Edge Function이 service role로 동작하면 RLS가 우회되므로 함수 안에서 직접 확인한다. **구현 전에 이 함수가 어떤 키로 Supabase 클라이언트를 만드는지 확인할 것**
- 맥락 로드(89-94행)를 `conversation_id`로 좁힌다
- 두 insert에 `conversation_id`를 찍는다
- 첫 사용자 메시지일 때 대화 제목을 갱신한다
- `conversationId`가 없거나 유효하지 않으면 **명확한 에러**를 돌려준다. 조용히 기본 대화에 쓰지 않는다

## 클라이언트

`src/lib/aiChat.js`의 `sendChatMessage`에 `conversationId`를 추가해 POST 본문에 싣는다. 스트리밍 파싱(`parseChatStreamLine`)은 변경 없다.

`AiChat.js`:

- 대화 목록 (최근 활동순)
- 새 대화 만들기
- 대화 선택 → 해당 대화 메시지만 로드 (`.eq('conversation_id', …)`)
- 이름 변경
- 삭제 (확인 절차 필요 — 메시지가 함께 사라진다)
- **대화가 하나도 없을 때**: 목록이 빈 상태로 보이고, 첫 메시지를 보내려 하면 대화가 자동 생성되어야 한다. 빈 화면에서 막히면 안 된다

레이아웃은 좁은 화면을 고려한다. 사이드바 고정은 모바일에서 화면을 잡아먹는다.

## 접근성

- 대화 목록은 `<ul>`/`<li>`, 각 항목은 `<button>`
- 현재 선택된 대화를 `aria-current="true"`로 표시
- 삭제는 되돌릴 수 없으므로 확인 단계를 둔다. 확인 다이얼로그는 포커스 트랩과 `Esc` 닫기를 갖춘다
- 이름 변경 입력에 `<label>` (시각적으로 숨기더라도)
- 대화 전환 시 메시지 영역 로딩을 `aria-live`로 알린다

## 테스트

`react-router-dom`을 import 하는 모듈은 이 저장소 Jest에서 테스트할 수 없다(TS-003). 순수 로직을 `src/lib/`에 두고 그 단위로 커버한다.

| 대상 | 검증 |
|---|---|
| 제목 생성 함수 | 짧은 문장 / 기준 길이 초과 / 공백만 / 줄바꿈 포함 / 빈 문자열 |
| `sendChatMessage` | `conversationId`가 본문에 실리는지 |

마이그레이션은 로컬 Supabase에 적용해 백필 결과를 직접 확인한다 — 기존 메시지 수와 백필 후 `conversation_id`가 채워진 메시지 수가 같아야 한다.

## 검증

1. 기존 사용자로 로그인 → **이전 대화가 그대로 보이는지** (유실 0건)
2. 새 대화 생성 → 첫 질문 → 제목이 자동으로 붙는지
3. **대화 A에서 수학을 묻고, 대화 B에서 "방금 뭐 물어봤지?"라고 물었을 때 AI가 모른다고 해야 한다** — 맥락 분리의 직접 증거다
4. 이름 변경 / 삭제 동작
5. 남의 `conversationId`를 보내면 거절되는지
6. 일일 30건 제한이 대화를 새로 파도 초기화되지 않는지
7. 320px에서 가로 스크롤 없음, 키보드만으로 대화 전환·생성·삭제 가능

## 트러블슈팅 기록

건별로 해결·검증 직후 즉시 `docs/TROUBLESHOOTING.md`에 기록한다. 작업 종료 시점에 몰아 쓰지 않는다.

## 참고 — 이번 세션에서 확인된 사실

`chat_messages`(테이블)에 대한 `select('id', { count: 'exact', head: true })`는 Edge Function에서 정상 동작한다(`index.ts:65`). TS-008에서 503이 났던 것은 **뷰**(`active_study_sessions`)에 대한 HEAD count였고 테이블에서는 재현되지 않는다. 이번 작업에서 카운트 쿼리가 필요하면 테이블 대상은 안전하다.
