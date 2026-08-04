# Zoner 인증 + DB 연동 — 설계

## 배경

Zoner의 회원가입/로그인은 현재 완전히 가짜다. `SignUp`이 입력값을 `Login`의 `useState`에만 저장하고, `Login`이 그 메모리 값과 비교한다. 새로고침하면 가입 정보가 사라지고, 서버·DB·실제 인증 토큰이 전혀 없다.

이번 작업은 "세부 기능(학습 기록, AI 집중도 분석 등)"으로 가기 전 첫 단계로, **실제로 동작하는 회원가입/로그인/세션 유지**를 만드는 것이다. 영상 업로드, AI 분석은 별도 하위 프로젝트로 분리해 이후에 다룬다 (이 문서 범위 밖).

## 아키텍처

CRA 프론트엔드에서 `supabase-js` 클라이언트로 Supabase를 직접 호출한다. 커스텀 백엔드 서버(Node/Express 등)는 두지 않는다 — Supabase가 인증(비밀번호 해싱, 세션, JWT), Postgres DB, Row Level Security를 전부 제공하므로 MVP 단계에서 별도 서버가 불필요하다.

- **인증**: Supabase Auth, 이메일+비밀번호. 가입 즉시 로그인 가능하도록 이메일 확인(email confirmation) 비활성화.
- **DB**: Postgres, `profiles` 테이블 1개만 신설. `auth.users`는 이메일/비밀번호/id만 가지고 이름이 없으므로, 표시 이름 저장용으로 필요.
- **세션**: `supabase-js`가 브라우저 로컬스토리지에 세션을 자동 유지 — 새로고침해도 로그인 상태가 살아있는 것이 지금과 가장 큰 차이.

Supabase 프로젝트: `https://uptgtgckddgrnimuohwa.supabase.co` (이미 생성됨, anon key 확보).

## DB 스키마

`.claude/standards/db-conventions.md` 규약을 따른다 (snake_case, `created_at`/`updated_at` 공통 컬럼, RLS를 최후 방어선으로).

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "본인 프로필만 조회"
  on profiles for select
  using (auth.uid() = id);

create policy "본인 프로필만 수정"
  on profiles for update
  using (auth.uid() = id);

create policy "가입 시 본인 프로필 생성"
  on profiles for insert
  with check (auth.uid() = id);
```

`profiles.id`가 `auth.users.id`를 그대로 참조하는 1:1 구조라 별도 `user_id` 외래키 컬럼을 두지 않는다 (기본키 자체가 참조키).

## 환경변수

`.claude/standards/env-config.md` 규약을 따른다.

- `.env` 신설 (커밋 안 함): `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`
- `.env.example` 신설 (커밋함): 같은 키에 더미값
- `zoner/.gitignore`에 `.env` 추가 (현재 `.env.local` 계열만 있고 순수 `.env`가 빠져 있음 — 이번에 같이 고침)
- CRA는 `REACT_APP_` 접두사가 붙은 환경변수만 클라이언트 번들에 노출한다. anon key는 원래 클라이언트 노출 목적으로 설계된 키라 문제없음.

## 프론트엔드 변경

### 신규 파일
- `src/lib/supabaseClient.js` — `createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)`로 싱글턴 클라이언트 생성, `export default supabase`

### 신규 의존성
- `@supabase/supabase-js` (npm 패키지 추가 — 이번 작업의 유일한 신규 의존성)

### 수정 파일

**`src/components/SignUp.js`**
- `handleSubmit`을 `async`로 변경
- 기존 클라이언트 검증(빈 필드, 비밀번호 불일치)은 그대로 유지 — `alert()` 유지
- `supabase.auth.signUp({ email, password })` 호출 → 성공하면 반환된 `user.id`로 `profiles` 테이블에 `{ id, name }` insert
- 에러(이미 가입된 이메일 등)는 Supabase가 반환하는 에러 메시지를 `alert()`로 표시
- 성공 시 기존처럼 "회원가입이 완료되었습니다" alert → `closeSignUpModal()` 호출 (로그인 페이지로 복귀)
- 기존 `setUserData` prop은 더 이상 필요 없음 — Supabase가 인증 상태를 관리하므로 Login에 값을 넘겨줄 필요가 없어짐. `Login.js`가 `SignUp`에 넘기던 `setUserData` prop 제거

**`src/components/Login.js`**
- "아이디" 필드 → **"이메일"** 필드로 변경 (Supabase Auth는 이메일 기반). `type="text"` → `type="email"`, label/placeholder 텍스트 변경
- `handleLogin`을 `async`로 변경, `supabase.auth.signInWithPassword({ email, password })` 호출
- 성공 시 `navigate('/mypage')` — 더 이상 `state: { name }`을 넘기지 않음 (Mypage가 직접 세션에서 조회)
- 실패 시 기존 `errorMessage` state + `role="alert"` 패턴 그대로 유지, 메시지만 Supabase 에러로 교체
- 로컬 `userData` state, `id`/`password` 비교 로직 전부 제거 (더 이상 필요 없음)

**`src/components/Mypage.js`**
- `useLocation`으로 이름을 받던 방식 제거
- 마운트 시 `supabase.auth.getUser()`로 현재 로그인 사용자 확인 → 없으면 `/login`으로 리다이렉트 (비로그인 접근 차단)
- `profiles` 테이블에서 `id`로 이름 조회해 `userName`으로 사용
- LOGOUT 버튼: `supabase.auth.signOut()` 호출 후 `navigate('/')`
- `learningVideos`/`reportVideos`/`addLearningVideo`/`addReportVideo`는 이번 범위 밖이므로 그대로 유지 (건드리지 않음)

## 에러 처리

- Supabase가 반환하는 에러는 영어 메시지가 많다 (`"Invalid login credentials"` 등). 사용자에게는 한글로 매핑해서 보여준다 — 정확한 원인 노출보다 일관된 UX 우선 (예: 로그인 실패 → "이메일 또는 비밀번호가 올바르지 않습니다", 중복 가입 → "이미 가입된 이메일입니다").
- 네트워크 에러(Supabase 응답 실패)는 별도로 "일시적인 오류입니다. 잠시 후 다시 시도해주세요" 메시지로 구분.

## 범위 밖 (명시적 제외)

- 영상 업로드/저장, AI 집중도 분석, 리포트 생성 — 별도 하위 프로젝트
- 소셜 로그인(구글 등)
- 비밀번호 재설정(찾기) 플로우
- 이메일 인증 — 이번엔 비활성화
- `learningVideos`/`reportVideos` 관련 로직 — Mypage에 그대로 둠, 손대지 않음
- Save, Read, Report_a 등 나머지 9개 페이지 — 이전 UI 리디자인과 마찬가지로 범위 밖

## 검증

- 회원가입 → Supabase 대시보드의 Authentication → Users에 새 계정이 실제로 생기는지 확인
- 가입 직후 이메일 확인 없이 바로 로그인 가능한지 확인
- 로그인 성공 → Mypage에 이름이 정상 표시되는지, `profiles` 테이블에 해당 row가 있는지 확인
- **새로고침 후에도 로그인 상태가 유지되는지** (기존 mock 구현과의 핵심 차이) 확인
- 로그아웃 후 Mypage 직접 접근 시 `/login`으로 리다이렉트되는지 확인
- 잘못된 비밀번호 입력 시 인라인 에러 메시지가 뜨는지 확인
- `npm run build` 컴파일 성공 확인
