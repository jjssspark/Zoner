# AI 채팅 대화방 분리(과목별) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **상태 (2026-08-07 확인)**: 이 계획의 기능은 구현되어 코드베이스에 있다.
> **아래 체크박스는 실행 중에 갱신되지 않았다 — 진행 표시로 신뢰하지 말 것.**
> 미체크는 "안 했다"가 아니라 "표시를 안 했다"이다. 실제 반영 여부는 `src/`
> 코드와 테스트(214건 통과)로 확인한다.

**Goal:** AI 채팅을 사용자당 대화 하나에서 여러 대화방으로 나누고, LLM 맥락도 대화 단위로 좁혀 과목이 섞이지 않게 한다.

**Architecture:** `conversations` 테이블을 새로 만들고 `chat_messages.conversation_id`로 묶는다. 메시지 쓰기는 전부 Edge Function이 하므로 대화 소유권 검증·맥락 범위 축소·제목 생성·`updated_at` 갱신도 Edge Function이 맡는다. 대화 CRUD(생성·이름변경·삭제)는 RLS가 걸린 클라이언트가 직접 한다. 순수 로직(제목 계산)은 `src/lib/`에 두어 Jest로 테스트한다.

**Tech Stack:** React 19 (CRA/react-scripts 5.0.1), react-router-dom v7, Supabase (Postgres + Auth + Edge Functions/Deno), Anthropic Messages API, Jest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-08-06-zoner-chat-conversations-design.md`

---

## Global Constraints

- **커밋은 사전 승인되어 있다.** 각 Task의 커밋 단계를 사용자에게 다시 물어보지 말고 그대로 실행한다. 전역 `~/.claude/CLAUDE.md`의 "커밋 전 확인 요청" 규칙보다 이 지시가 우선한다.
- **attribution 푸터를 붙이지 않는다.** `Co-Authored-By`, `Generated with` 등 어떤 푸터도 커밋 메시지에 넣지 않는다. 이 프로젝트는 attribution이 꺼져 있다.
- 커밋 메시지는 한국어, conventional commit 형식(`feat:`, `fix:`, `test:`, `docs:`).
- **테스트 실행**: `CI=true npx react-scripts test --watchAll=false`. 기준선은 **8스위트 / 80건 전부 초록**이다. 기존 테스트를 깨뜨리면 안 된다.
- **빌드 확인**: `npx react-scripts build`. **`CI=true`를 붙이지 않는다** — 기존 `UserGuide.js`의 jsx-a11y 경고 3건이 에러로 승격돼 실패한다. 이 브랜치 소관이 아니다.
- **`react-router-dom`을 import 하는 모듈은 Jest에서 테스트할 수 없다**(TS-003, CRA 번들 리졸버가 v7 exports 맵을 못 푼다). 그래서 `src/components/AiChat.js`에는 테스트를 쓰지 않는다. 순수 로직은 `src/lib/`에, router를 쓰지 않는 컴포넌트는 `src/components/ui/`에 두고 그 단위로 커버한다.
- **디자인 토큰**: `src/styles/tokens.css`는 **수정 금지**. 새 토큰을 만들지 않는다. 기존 의미 토큰(`var(--color-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--text-*)`, `var(--duration-*)`, `var(--ease-*)`)만 조합한다. 하드코딩된 색·px 금지.
- **`.sr-only`는 `tokens.css`에 전역으로 이미 있다.** 화면 CSS에서 다시 정의하지 않는다.
- 애니메이션은 `transform`·`opacity`만. `width`/`height`/`top`/`left`/`margin`/`padding`은 애니메이션 금지.
- 모든 인터랙티브 요소에 `:focus-visible` 스타일이 있어야 한다. `outline: none`만 두고 대체 스타일을 안 주는 것은 금지.
- **일일 30건 제한은 사용자 단위를 유지한다.** 대화 단위로 바꾸면 방을 새로 파는 것으로 우회할 수 있다. Edge Function의 카운트 쿼리(`index.ts:63-68`)는 건드리지 않는다.
- **다른 화면을 건드리지 않는다.** `Home`, `Mypage`, `Save`, `Trash`, `Trashread`, `StartLearning`, `UserGuide` 파일은 diff에 나타나면 안 된다.
- **서브에이전트는 Supabase에 SQL을 실행하거나 Edge Function을 배포하지 않는다.** 마이그레이션 파일과 함수 코드를 커밋까지만 하고, 적용·배포는 컨트롤러가 브라우저로 수행한다(이전 작업들과 동일한 패턴).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/lib/conversations.js` (신규) | 대화 제목 계산 순수 함수 + 상수. React·router import 없음 |
| `src/lib/conversations.test.js` (신규) | 위 함수의 단위 테스트 (제목 계약을 고정) |
| `src/lib/aiChat.js` (수정) | `sendChatMessage`에 `conversationId` 추가 |
| `src/lib/aiChat.test.js` (수정) | `conversationId`가 POST 본문에 실리는지 검증 |
| `supabase/migrations/20260806120000_create_conversations.sql` (신규) | `conversations` 테이블 + RLS + `chat_messages.conversation_id` 백필 |
| `supabase/functions/ai-chat/index.ts` (수정) | `conversationId` 검증·소유권 확인·맥락 범위 축소·제목/`updated_at` 갱신 |
| `src/components/ui/ConfirmDialog.js` (신규) | 재사용 확인 다이얼로그. 포커스 트랩 + `Esc` + 포커스 복귀. router import 없음 → Jest 테스트 가능 |
| `src/components/ui/ConfirmDialog.css` (신규) | 위 컴포넌트 스타일 |
| `src/components/ui/ConfirmDialog.test.js` (신규) | 포커스 트랩·`Esc`·콜백 테스트 |
| `src/components/AiChat.js` (수정) | 대화 목록·생성·선택·이름변경·삭제, 대화별 메시지 로드 |
| `src/components/AiChat.css` (수정) | 대화 목록 레이아웃(넓은 화면 2열 / 좁은 화면 접힘) |

---

## 설계 메모 (구현자가 알아야 할 결정 근거)

**1. `buildConversationTitle`이 두 곳에 복제된다.**
Edge Function은 Deno 런타임이라 `src/lib/conversations.js`를 import 할 수 없다. 그래서 같은 구현이 `supabase/functions/ai-chat/index.ts`에도 들어간다. `src/lib/conversations.js`가 **계약의 기준**이고 `src/lib/conversations.test.js`가 그 계약을 고정한다. 클라이언트 쪽 복사본은 죽은 코드가 아니다 — 첫 메시지를 보낸 직후 사이드바 제목을 즉시 낙관적으로 갱신하는 데 쓴다(그렇지 않으면 새로고침 전까지 `새 대화`로 남는다). 한쪽을 고치면 반드시 다른 쪽도 고친다. 두 파일 모두 그 사실을 주석으로 명시한다.

**2. "새 대화" 버튼은 DB 행을 즉시 만들지 않는다.**
버튼은 `activeId`를 `null`로 만들고 메시지 영역을 비울 뿐이다. 실제 `conversations` 행은 **첫 메시지를 보낼 때** 생긴다. 이유는 두 가지다 — (a) 버튼만 누르고 아무것도 안 보내면 빈 `새 대화` 행이 쌓인다, (b) 스펙이 요구하는 "대화가 하나도 없을 때 첫 메시지로 자동 생성"과 코드 경로가 하나로 합쳐진다.

**3. 메시지 로드는 `activeId` 변경 `useEffect`가 아니라 명시적 호출로 한다.**
`useEffect([activeId])`로 하면 전송 중 대화를 새로 만들 때 `setActiveId` → 이펙트 발화 → 빈 배열로 `setMessages` 가 일어나 낙관적으로 그려둔 말풍선을 지운다. 로드는 (a) 최초 마운트, (b) 사용자가 목록에서 대화를 고를 때, (c) 활성 대화를 삭제해 다른 대화로 넘어갈 때만 호출한다.

**4. 좁은 화면에서 목록은 고정 사이드바가 아니라 접히는 패널이다.**
`position: fixed` 드로어 + 백드롭 + 포커스 트랩 + 스크롤 잠금은 부품이 많고 깨질 구석이 많다. 대신 일반 흐름 안에서 CSS `display`로 접었다 펴고, 토글 버튼에 `aria-expanded` / `aria-controls`를 준다. 포커스 트랩이 정말 필요한 곳은 삭제 확인 다이얼로그 하나뿐이다.

---

### Task 1: 대화 제목 계산 함수

**Files:**
- Create: `src/lib/conversations.js`
- Test: `src/lib/conversations.test.js`

**Interfaces:**
- Consumes: 없음. 순수 함수만 있는 새 모듈이다.
- Produces:
  - `export const DEFAULT_CONVERSATION_TITLE = '새 대화'` — Task 6이 새 대화 생성 시 `title` 기본값으로, 이름을 빈 값으로 저장하려 할 때 대체값으로 쓴다.
  - `export const MAX_TITLE_LENGTH = 20` — 자르는 기준 길이(문자 수).
  - `export function buildConversationTitle(content)` — 문자열(또는 `null`/`undefined`)을 받아 제목 문자열을 반환한다. Task 3(Edge Function)이 같은 로직을 복제해 쓰고, Task 6이 낙관적 제목 표시에 쓴다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/lib/conversations.test.js` 전체 내용:

```javascript
import {
  buildConversationTitle,
  DEFAULT_CONVERSATION_TITLE,
  MAX_TITLE_LENGTH,
} from './conversations';

describe('buildConversationTitle', () => {
  test('짧은 문장은 그대로 제목이 된다', () => {
    expect(buildConversationTitle('미분이 어려워')).toBe('미분이 어려워');
  });

  test('기준 길이와 정확히 같으면 자르지 않는다', () => {
    const exact = '가'.repeat(MAX_TITLE_LENGTH);
    expect(buildConversationTitle(exact)).toBe(exact);
  });

  test('기준 길이를 넘으면 잘라내고 말줄임표를 붙인다', () => {
    const long = '가'.repeat(MAX_TITLE_LENGTH + 5);
    expect(buildConversationTitle(long)).toBe(`${'가'.repeat(MAX_TITLE_LENGTH)}…`);
  });

  test('단어 중간에서 잘려도 그대로 둔다', () => {
    const content = '이차함수의 그래프를 그리는 방법이 궁금합니다';
    expect(buildConversationTitle(content)).toBe('이차함수의 그래프를 그리는 방법이 궁…');
  });

  test('앞뒤 공백은 제거한다', () => {
    expect(buildConversationTitle('   안녕   ')).toBe('안녕');
  });

  test('줄바꿈과 연속 공백은 공백 하나로 접는다', () => {
    expect(buildConversationTitle('첫 줄\n\n둘째  줄')).toBe('첫 줄 둘째 줄');
  });

  test('공백만 있으면 기본 제목을 쓴다', () => {
    expect(buildConversationTitle('   \n  ')).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  test('빈 문자열이면 기본 제목을 쓴다', () => {
    expect(buildConversationTitle('')).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  test('null이면 기본 제목을 쓴다', () => {
    expect(buildConversationTitle(null)).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  test('undefined면 기본 제목을 쓴다', () => {
    expect(buildConversationTitle(undefined)).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  test('줄바꿈을 접은 뒤 길이를 재서 자른다', () => {
    const content = `${'가'.repeat(10)}\n${'나'.repeat(20)}`;
    // 접으면 '가'×10 + ' ' + '나'×20 = 31자 → 20자에서 자른다
    expect(buildConversationTitle(content)).toBe(`${'가'.repeat(10)} ${'나'.repeat(9)}…`);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/conversations.test.js`
Expected: FAIL — `Cannot find module './conversations' from 'src/lib/conversations.test.js'`

- [ ] **Step 3: 최소 구현을 작성한다**

`src/lib/conversations.js` 전체 내용:

```javascript
// src/lib/conversations.js
// 대화 제목 계산. 순수 함수만 둔다 — react-router-dom을 import 하는 모듈은
// 이 저장소 Jest에서 로드되지 않는다(docs/TROUBLESHOOTING.md TS-003).
//
// ⚠️ buildConversationTitle은 supabase/functions/ai-chat/index.ts에도 같은 구현이 있다.
// Edge Function은 Deno 런타임이라 이 파일을 import 할 수 없어 복제한 것이다.
// 이 파일이 계약의 기준이고 conversations.test.js가 그 계약을 고정한다.
// 한쪽을 고치면 반드시 다른 쪽도 고친다.

export const DEFAULT_CONVERSATION_TITLE = '새 대화';
export const MAX_TITLE_LENGTH = 20;

export function buildConversationTitle(content) {
  const normalized = String(content ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length === 0) return DEFAULT_CONVERSATION_TITLE;
  if (normalized.length <= MAX_TITLE_LENGTH) return normalized;

  // 한국어는 어절 경계 판정이 비싸다. 단어 중간에서 잘리는 것을 허용한다.
  return `${normalized.slice(0, MAX_TITLE_LENGTH)}…`;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/conversations.test.js`
Expected: PASS — 11 passed

- [ ] **Step 5: 전체 테스트가 여전히 초록인지 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 9 suites / 91 tests 전부 통과 (기준선 8스위트 80건 + 이번 1스위트 11건)

- [ ] **Step 6: 커밋한다**

커밋은 사전 승인되어 있다. 사용자에게 묻지 말고 실행한다.

```bash
git add src/lib/conversations.js src/lib/conversations.test.js
git commit -m "feat: 대화 제목 계산 함수 추가"
```

---

### Task 2: `conversations` 테이블 마이그레이션 + 기존 메시지 백필

**Files:**
- Create: `supabase/migrations/20260806120000_create_conversations.sql`

**Interfaces:**
- Consumes: 기존 `chat_messages` 테이블 — 컬럼 `id uuid`, `user_id uuid`, `role text`(`'user'|'assistant'`), `content text`, `created_at timestamptz`. RLS 정책 `chat_messages_select_own`, `chat_messages_insert_own`이 이미 있다.
- Produces:
  - `conversations` 테이블 — `id uuid`, `user_id uuid`, `title text`, `created_at timestamptz`, `updated_at timestamptz`. RLS로 본인 행만 select/insert/update/delete.
  - `chat_messages.conversation_id uuid not null references conversations(id) on delete cascade`
  - 인덱스 `idx_conversations_user_id_updated_at`, `idx_chat_messages_conversation_id_created_at`
  - Task 3(Edge Function)과 Task 6(프론트)이 이 스키마를 읽고 쓴다.

- [ ] **Step 1: 마이그레이션 SQL을 작성한다**

`supabase/migrations/20260806120000_create_conversations.sql` 전체 내용:

```sql
-- supabase/migrations/20260806120000_create_conversations.sql
--
-- ⚠️ 이 마이그레이션은 딱 한 번만 실행할 수 있다.
-- 아래 백필은 "사용자당 대화가 정확히 하나뿐인 시점"에만 안전하다.
-- 배포된 뒤(사용자가 대화를 여러 개 만든 뒤)에 다시 돌리면 메시지가 엉뚱한
-- 대화에 붙는다. 재실행 금지.

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '새 대화',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table conversations enable row level security;

create index idx_conversations_user_id_updated_at
  on conversations (user_id, updated_at desc);

create policy "conversations_select_own"
  on conversations for select
  using (auth.uid() = user_id);

create policy "conversations_insert_own"
  on conversations for insert
  with check (auth.uid() = user_id);

create policy "conversations_update_own"
  on conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "conversations_delete_own"
  on conversations for delete
  using (auth.uid() = user_id);

-- 컬럼은 nullable로 먼저 추가한다. 백필 전에 not null을 걸면 실패한다.
alter table chat_messages
  add column conversation_id uuid references conversations(id) on delete cascade;

-- 백필 1: 메시지를 가진 사용자마다 대화 1건 생성.
-- created_at은 그 사용자의 가장 오래된 메시지 시각, updated_at은 가장 최근 메시지 시각.
insert into conversations (user_id, title, created_at, updated_at)
select m.user_id, '이전 대화', min(m.created_at), max(m.created_at)
from chat_messages m
group by m.user_id;

-- 백필 2: 기존 메시지를 그 사용자의 대화로 연결.
-- 이 시점에 사용자당 conversations 행은 정확히 하나다(위 insert가 방금 만든 것).
update chat_messages m
set conversation_id = c.id
from conversations c
where c.user_id = m.user_id
  and m.conversation_id is null;

-- 백필 3: 전부 채워진 것을 전제로 not null 승격 + 조회 인덱스.
alter table chat_messages
  alter column conversation_id set not null;

create index idx_chat_messages_conversation_id_created_at
  on chat_messages (conversation_id, created_at);
```

- [ ] **Step 2: 백필 순서가 맞는지 눈으로 확인한다**

파일을 다시 읽고 다음 순서가 지켜졌는지 확인한다. 순서가 틀리면 마이그레이션이 실패하거나 데이터가 유실된다.

1. `conversations` 테이블 생성
2. `chat_messages.conversation_id`를 **nullable로** 추가
3. `insert into conversations ... group by user_id` (대화 생성)
4. `update chat_messages ... set conversation_id` (컬럼 채움)
5. `alter column conversation_id set not null` (승격)

Expected: 위 5단계가 파일에 이 순서대로 나타난다. `set not null`이 `update`보다 앞에 있으면 안 된다.

- [ ] **Step 3: 커밋한다**

커밋은 사전 승인되어 있다. 사용자에게 묻지 말고 실행한다.

```bash
git add supabase/migrations/20260806120000_create_conversations.sql
git commit -m "feat: conversations 테이블 및 chat_messages 백필 마이그레이션"
```

**참고 — 서브에이전트는 아래를 실행하지 않는다. 컨트롤러가 브라우저로 수행한다.**

적용 전 기준선 기록 (Supabase SQL Editor):

```sql
select count(*) as total_messages from chat_messages;
select count(distinct user_id) as users_with_messages from chat_messages;
```

적용 후 검증 — 세 값이 모두 맞아야 한다:

```sql
select count(*) as total_messages from chat_messages;
select count(*) as backfilled from chat_messages where conversation_id is not null;
select count(*) as conversation_rows from conversations;
```

- `total_messages`가 적용 전과 **같아야** 한다 (유실 0건)
- `backfilled`가 `total_messages`와 **같아야** 한다
- `conversation_rows`가 적용 전 `users_with_messages`와 **같아야** 한다

정책 확인:

```sql
select policyname from pg_policies where tablename = 'conversations';
```
→ `conversations_select_own`, `conversations_insert_own`, `conversations_update_own`, `conversations_delete_own` 4건.

**TS-001 주의:** Supabase SQL Editor(Monaco)는 `(` 입력 시 `)`를 자동 삽입한다. 괄호 안에서 줄바꿈이 들어간 여러 줄 SQL을 시뮬레이션 키 입력으로 타이핑하면 괄호가 깨진다. 붙여넣기가 아니라 타이핑으로 넣어야 한다면 각 statement를 한 줄로 평탄화하고, Enter는 모든 괄호가 닫힌 statement 경계에서만 친다. Run 전에 확대 스크린샷으로 괄호 짝을 대조한다.

---

### Task 3: Edge Function — 대화 단위 맥락·소유권 검증·제목 생성

**Files:**
- Modify: `supabase/functions/ai-chat/index.ts` (전체 교체)

**Interfaces:**
- Consumes: Task 2의 `conversations` 테이블과 `chat_messages.conversation_id`.
- Produces: `POST /functions/v1/ai-chat` 요청 본문이 `{ content: string, conversationId: string }`가 된다. Task 4의 `sendChatMessage`가 이 계약을 지킨다.
  - `conversationId`가 없거나 UUID 형식이 아니면 `400 { error: '대화를 찾을 수 없습니다.' }`
  - 존재하지 않거나 남의 대화면 `404 { error: '대화를 찾을 수 없습니다.' }`
  - 성공 시 응답은 기존과 동일한 SSE (`data: {"text":"..."}\n\n` … `data: [DONE]\n\n`)

**핵심 주의사항 (스펙이 지목한 지점):**

1. **이 함수의 Supabase 클라이언트는 `SUPABASE_SERVICE_ROLE_KEY`로 만들어진다(현행 43행).** 즉 RLS를 우회한다. 남의 `conversationId`를 보내도 DB가 막아주지 않는다. **소유권을 함수 안에서 직접 확인해야 한다.**
2. **현행 89-94행의 맥락 로드가 이 작업의 핵심이다.** `.eq('user_id', userId)`를 `.eq('conversation_id', conversationId)`로 바꾸지 않으면 화면에서만 방이 나뉘고 AI는 여전히 전 과목을 섞어 읽는다.
3. **일일 30건 제한 카운트(현행 63-68행)는 그대로 둔다.** 사용자 단위를 유지해야 방을 새로 파는 우회가 막힌다.

- [ ] **Step 1: `index.ts`를 아래 내용으로 전체 교체한다**

`supabase/functions/ai-chat/index.ts` 전체 내용:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_MESSAGE_LENGTH = 4000;
const DAILY_MESSAGE_LIMIT = 30;
const SYSTEM_PROMPT = '당신은 학습을 돕는 AI 보조 튜터입니다. 간결하고 실용적으로 답하세요.';

const MAX_TITLE_LENGTH = 20;
const DEFAULT_CONVERSATION_TITLE = '새 대화';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ⚠️ src/lib/conversations.js의 buildConversationTitle과 동일한 구현이다.
// Deno 런타임이라 그 파일을 import 할 수 없어 복제했다.
// src/lib/conversations.test.js가 이 동작의 계약을 고정한다. 한쪽을 고치면 다른 쪽도 고친다.
function buildConversationTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return DEFAULT_CONVERSATION_TITLE;
  if (normalized.length <= MAX_TITLE_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_TITLE_LENGTH)}…`;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function startOfTodayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const kstMidnightUtcMs = Date.UTC(y, m, d) - 9 * 60 * 60 * 1000;
  return new Date(kstMidnightUtcMs).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');

    // 이 클라이언트는 service role 키로 만들어진다 = RLS를 우회한다.
    // 따라서 대화 소유권은 아래에서 직접 확인해야 한다.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return jsonResponse({ error: '인증이 필요합니다.' }, 401);
    }
    const userId = userData.user.id;

    let body: { content?: unknown; conversationId?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: '잘못된 요청입니다.' }, 400);
    }

    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (content.length === 0 || content.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse({ error: '메시지 길이가 올바르지 않습니다.' }, 400);
    }

    // conversationId가 없거나 형식이 틀리면 명확히 거절한다.
    // 조용히 기본 대화에 쓰지 않는다.
    const conversationId =
      typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
    if (!UUID_PATTERN.test(conversationId)) {
      return jsonResponse({ error: '대화를 찾을 수 없습니다.' }, 400);
    }

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .maybeSingle();

    if (conversationError) {
      return jsonResponse({ error: '요청을 처리하지 못했습니다.' }, 500);
    }
    // 존재하지 않는 대화와 남의 대화를 같은 응답으로 돌려준다(대화 존재 여부를 흘리지 않는다).
    if (!conversation || conversation.user_id !== userId) {
      return jsonResponse({ error: '대화를 찾을 수 없습니다.' }, 404);
    }

    // 일일 제한은 사용자 단위를 유지한다. 대화 단위로 바꾸면 방을 새로 파서 우회할 수 있다.
    const { count, error: countError } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', startOfTodayKST());

    if (countError) {
      return jsonResponse({ error: '요청을 처리하지 못했습니다.' }, 500);
    }

    if ((count ?? 0) >= DAILY_MESSAGE_LIMIT) {
      return jsonResponse(
        { error: '오늘 사용 가능한 메시지 횟수를 다 썼어요. 내일 다시 이용해주세요.' },
        429
      );
    }

    // 제목 자동 생성 여부를 판단하려면 user 메시지를 넣기 "전"에 세어야 한다.
    const { count: conversationMessageCount, error: conversationCountError } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    if (conversationCountError) {
      return jsonResponse({ error: '요청을 처리하지 못했습니다.' }, 500);
    }
    const isFirstMessage = (conversationMessageCount ?? 0) === 0;

    const { error: insertUserError } = await supabase
      .from('chat_messages')
      .insert({ user_id: userId, role: 'user', content, conversation_id: conversationId });

    if (insertUserError) {
      return jsonResponse({ error: '요청을 처리하지 못했습니다.' }, 500);
    }

    // 대화 목록을 최근 활동순으로 정렬하려면 updated_at을 여기서 갱신해야 한다.
    // 쓰기 주체가 이 함수 하나뿐이라 DB 트리거를 두지 않는다.
    const conversationUpdate: { updated_at: string; title?: string } = {
      updated_at: new Date().toISOString(),
    };
    if (isFirstMessage) {
      conversationUpdate.title = buildConversationTitle(content);
    }

    const { error: conversationUpdateError } = await supabase
      .from('conversations')
      .update(conversationUpdate)
      .eq('id', conversationId);

    if (conversationUpdateError) {
      // 제목/정렬 갱신 실패는 답변을 막을 이유가 아니다. 메시지는 이미 저장됐다.
      console.error('Failed to update conversation:', conversationUpdateError);
    }

    // ★ 맥락을 이 대화로 좁힌다. user_id로 로드하면 화면에서만 방이 나뉘고
    //   AI는 여전히 전 과목을 섞어 읽는다. 소유권은 위에서 이미 확인했다.
    const { data: history, error: historyError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (historyError) {
      return jsonResponse({ error: '요청을 처리하지 못했습니다.' }, 500);
    }

    const messages = (history ?? [])
      .slice()
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    // Anthropic Messages API는 첫 메시지가 role 'user'여야 한다.
    // 20건 윈도우가 assistant 행에서 시작하는 경우를 잘라낸다.
    while (messages.length > 0 && messages[0].role !== 'user') {
      messages.shift();
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
        stream: true,
      }),
    });

    if (!anthropicResponse.ok || !anthropicResponse.body) {
      return jsonResponse({ error: 'AI 응답을 받지 못했습니다.' }, 502);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullText = '';
    let assistantStreamError = false;

    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicResponse.body!.getReader();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const dataLine = line.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;
            const payload = dataLine.slice(6).trim();
            if (payload === '[DONE]') continue;

            let event: any;
            try {
              event = JSON.parse(payload);
            } catch {
              continue;
            }

            if (event.type === 'error') {
              assistantStreamError = true;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: event.error?.message || '알 수 없는 오류가 발생했습니다.' })}\n\n`
                )
              );
              controller.close();
              return;
            }

            if (event.type === 'content_block_delta' && event.delta?.text) {
              fullText += event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            }
          }
        }

        if (!assistantStreamError && fullText.length > 0) {
          const { error: insertAssistantError } = await supabase
            .from('chat_messages')
            .insert({
              user_id: userId,
              role: 'assistant',
              content: fullText,
              conversation_id: conversationId,
            });

          if (insertAssistantError) {
            console.error('Failed to save assistant message:', insertAssistantError);
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Unexpected error in ai-chat handler:', error);
    return jsonResponse({ error: '요청을 처리하지 못했습니다.' }, 500);
  }
});
```

- [ ] **Step 2: 변경 지점 4곳을 diff로 확인한다**

Run: `git diff supabase/functions/ai-chat/index.ts`

Expected — 아래가 전부 diff에 보여야 한다:

1. `conversationId` 파싱 + `UUID_PATTERN` 검증 + `conversations` 소유권 조회 블록이 **추가**됨
2. 두 `insert`(user / assistant)에 `conversation_id: conversationId`가 **추가**됨
3. 맥락 로드가 `.eq('user_id', userId)` → `.eq('conversation_id', conversationId)`로 **교체**됨
4. `conversations` `update`(`updated_at` + 조건부 `title`)가 **추가**됨

그리고 아래는 **바뀌면 안 된다**:

- 일일 제한 카운트 쿼리 (`.eq('user_id', userId).eq('role', 'user').gte('created_at', startOfTodayKST())`)
- `DAILY_MESSAGE_LIMIT = 30`
- CORS 헤더, SSE 응답 포맷, 스트림 처리 로직

- [ ] **Step 3: 커밋한다**

커밋은 사전 승인되어 있다. 사용자에게 묻지 말고 실행한다.

```bash
git add supabase/functions/ai-chat/index.ts
git commit -m "feat: Edge Function이 대화별로 맥락을 로드하고 소유권을 검증하도록 변경"
```

**참고 — 서브에이전트는 배포하지 않는다.** 컨트롤러가 Supabase 대시보드 Edge Functions 에디터로 `ai-chat` 함수를 재배포한다. 재배포 전까지는 OLD 함수가 그대로 살아 있으므로 `conversationId`를 무시하고 기존과 동일하게 동작한다 — 400/404가 나는 것이 정상이 아니다.

---

### Task 4: `sendChatMessage`에 `conversationId` 전달

**Files:**
- Modify: `src/lib/aiChat.js`
- Test: `src/lib/aiChat.test.js`

**Interfaces:**
- Consumes: Task 3의 Edge Function 계약 — 요청 본문 `{ content, conversationId }`.
- Produces: `export async function sendChatMessage({ supabaseUrl, accessToken, content, conversationId, onDelta }): Promise<string>` — Task 6(`AiChat.js`)이 호출한다. 반환값·스트림 파싱·429 처리는 기존과 동일하다.

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`src/lib/aiChat.test.js`의 `describe('sendChatMessage', ...)` 블록 **안**, 마지막 `test(...)` 뒤에 아래 테스트를 추가한다:

```javascript
  test('conversationId를 요청 본문에 실어 보낸다', async () => {
    const response = mockStreamResponse(['data: [DONE]\n\n']);
    global.fetch = jest.fn().mockResolvedValue(response);

    await sendChatMessage({
      supabaseUrl: 'https://example.supabase.co',
      accessToken: 'token123',
      content: '안녕',
      conversationId: '11111111-2222-3333-4444-555555555555',
      onDelta: () => {},
    });

    const [, init] = global.fetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      content: '안녕',
      conversationId: '11111111-2222-3333-4444-555555555555',
    });
  });
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/aiChat.test.js`
Expected: FAIL — 새 테스트에서 `Received: {"content": "안녕"}` (본문에 `conversationId`가 없다)

- [ ] **Step 3: `sendChatMessage`를 수정한다**

`src/lib/aiChat.js`에서 함수 시그니처와 `body` 두 줄만 바꾼다:

```javascript
export async function sendChatMessage({
  supabaseUrl,
  accessToken,
  content,
  conversationId,
  onDelta,
}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ content, conversationId }),
  });
```

나머지(429 처리, 스트림 읽기 루프, 반환값)는 **한 줄도 바꾸지 않는다.**

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/aiChat.test.js`
Expected: PASS — 기존 테스트 포함 전부 통과

- [ ] **Step 5: 전체 테스트를 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 9 suites / 92 tests 전부 통과

- [ ] **Step 6: 커밋한다**

커밋은 사전 승인되어 있다. 사용자에게 묻지 말고 실행한다.

```bash
git add src/lib/aiChat.js src/lib/aiChat.test.js
git commit -m "feat: sendChatMessage가 conversationId를 함께 전송"
```

---

### Task 5: 확인 다이얼로그 컴포넌트

**Files:**
- Create: `src/components/ui/ConfirmDialog.js`
- Create: `src/components/ui/ConfirmDialog.css`
- Test: `src/components/ui/ConfirmDialog.test.js`

**Interfaces:**
- Consumes: 없음. `react-router-dom`을 import 하지 않는다(그래야 Jest에서 렌더할 수 있다 — TS-003).
- Produces: `export default function ConfirmDialog({ title, description, confirmLabel, cancelLabel, onConfirm, onCancel })`
  - `title`: string (필수). `description`: string (선택).
  - `confirmLabel` 기본값 `'삭제'`, `cancelLabel` 기본값 `'취소'`.
  - `onConfirm`, `onCancel`: 인자 없는 함수. Task 6이 렌더 여부를 직접 제어한다(컴포넌트는 `isOpen` prop을 받지 않는다 — 부모가 조건부 렌더한다).
  - 마운트 시 취소 버튼에 포커스, 언마운트 시 직전 포커스 요소로 복귀, `Esc`로 `onCancel`, `Tab`이 다이얼로그 밖으로 나가지 않는다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/components/ui/ConfirmDialog.test.js` 전체 내용:

```javascript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';

const noop = () => {};

describe('ConfirmDialog', () => {
  test('제목과 설명을 보여준다', () => {
    render(
      <ConfirmDialog
        title="대화를 삭제할까요?"
        description="메시지도 함께 사라져요."
        onConfirm={noop}
        onCancel={noop}
      />
    );

    expect(screen.getByText('대화를 삭제할까요?')).toBeInTheDocument();
    expect(screen.getByText('메시지도 함께 사라져요.')).toBeInTheDocument();
  });

  test('모달 다이얼로그 역할을 가진다', () => {
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={noop} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('열리면 취소 버튼에 포커스가 간다', () => {
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={noop} />);

    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
  });

  test('확인 버튼을 누르면 onConfirm이 불린다', () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog title="삭제할까요?" onConfirm={onConfirm} onCancel={noop} />);

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('취소 버튼을 누르면 onCancel이 불린다', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('Esc를 누르면 onCancel이 불린다', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={onCancel} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('마지막 요소에서 Tab을 누르면 첫 요소로 돌아온다', () => {
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={noop} />);

    const cancel = screen.getByRole('button', { name: '취소' });
    const confirm = screen.getByRole('button', { name: '삭제' });

    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(cancel).toHaveFocus();
  });

  test('첫 요소에서 Shift+Tab을 누르면 마지막 요소로 간다', () => {
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={noop} />);

    const cancel = screen.getByRole('button', { name: '취소' });
    const confirm = screen.getByRole('button', { name: '삭제' });

    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
  });

  test('닫히면 열기 전 포커스로 돌아간다', () => {
    const { rerender } = render(
      <>
        <button type="button" data-testid="opener">
          삭제
        </button>
      </>
    );
    const opener = screen.getByTestId('opener');
    opener.focus();

    rerender(
      <>
        <button type="button" data-testid="opener">
          삭제
        </button>
        <ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={noop} />
      </>
    );
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();

    rerender(
      <>
        <button type="button" data-testid="opener">
          삭제
        </button>
      </>
    );
    expect(opener).toHaveFocus();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/components/ui/ConfirmDialog.test.js`
Expected: FAIL — `Cannot find module './ConfirmDialog'`

- [ ] **Step 3: 컴포넌트를 구현한다**

`src/components/ui/ConfirmDialog.js` 전체 내용:

```javascript
// src/components/ui/ConfirmDialog.js
import React, { useEffect, useRef } from 'react';
import './ConfirmDialog.css';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export const ConfirmDialog = ({
  title,
  description,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    cancelRef.current?.focus();

    return () => {
      // 다이얼로그가 닫히면 열었던 버튼으로 포커스를 돌려준다.
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="confirm-dialog__backdrop">
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? 'confirm-dialog-description' : undefined}
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        <h2 className="confirm-dialog__title" id="confirm-dialog-title">
          {title}
        </h2>
        {description && (
          <p className="confirm-dialog__description" id="confirm-dialog-description">
            {description}
          </p>
        )}
        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="confirm-dialog__cancel"
            onClick={onCancel}
            ref={cancelRef}
          >
            {cancelLabel}
          </button>
          <button type="button" className="confirm-dialog__confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
```

- [ ] **Step 4: 스타일을 작성한다**

`src/components/ui/ConfirmDialog.css` 전체 내용:

```css
/* src/components/ui/ConfirmDialog.css */
.confirm-dialog__backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background-color: oklch(0% 0 0 / 0.6);
}

.confirm-dialog {
  width: 100%;
  max-width: 24rem;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-6);
  color: var(--color-text);
}

.confirm-dialog__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  margin: 0 0 var(--space-2);
}

.confirm-dialog__description {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-body);
  margin: 0 0 var(--space-6);
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.confirm-dialog__cancel,
.confirm-dialog__confirm {
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 600;
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out-expo),
    border-color var(--duration-fast) var(--ease-out-expo);
}

.confirm-dialog__cancel {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.confirm-dialog__cancel:hover {
  border-color: var(--color-border-strong);
}

.confirm-dialog__confirm {
  background-color: var(--color-danger);
  border: 1px solid var(--color-danger);
  color: var(--color-bg);
}

.confirm-dialog__confirm:hover {
  background-color: var(--color-bg);
  color: var(--color-danger);
}

.confirm-dialog__cancel:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.confirm-dialog__confirm:focus-visible {
  outline: 2px solid var(--color-danger);
  outline-offset: 2px;
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/components/ui/ConfirmDialog.test.js`
Expected: PASS — 9 passed

- [ ] **Step 6: 전체 테스트를 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 10 suites / 101 tests 전부 통과

- [ ] **Step 7: 커밋한다**

커밋은 사전 승인되어 있다. 사용자에게 묻지 말고 실행한다.

```bash
git add src/components/ui/ConfirmDialog.js src/components/ui/ConfirmDialog.css src/components/ui/ConfirmDialog.test.js
git commit -m "feat: 포커스 트랩을 갖춘 확인 다이얼로그 컴포넌트 추가"
```

---

### Task 6: `AiChat.js` — 대화 목록·생성·선택·이름변경·삭제

**Files:**
- Modify: `src/components/AiChat.js` (전체 교체)

**Interfaces:**
- Consumes:
  - Task 1의 `buildConversationTitle(content)`, `DEFAULT_CONVERSATION_TITLE`
  - Task 4의 `sendChatMessage({ supabaseUrl, accessToken, content, conversationId, onDelta })`
  - Task 5의 `ConfirmDialog` (default export)
  - Task 2의 `conversations` 테이블 / `chat_messages.conversation_id`
  - 기존 `src/lib/supabaseClient.js`의 default export `supabase` (anon 키 → RLS 적용됨. 대화 CRUD를 여기서 직접 해도 안전하다)
  - 기존 `isValidMessage`, `MAX_MESSAGE_LENGTH` (`src/lib/aiChat.js`)
- Produces: Task 7의 CSS가 붙을 클래스 이름
  - `.ai-chat-page__list-toggle`, `.ai-chat-conversations`, `.ai-chat-conversations--open`, `.ai-chat-conversations__head`, `.ai-chat-conversations__heading`, `.ai-chat-conversations__new`, `.ai-chat-conversations__empty`, `.ai-chat-conversations__list`, `.ai-chat-conversations__item`, `.ai-chat-conversations__select`, `.ai-chat-conversations__controls`, `.ai-chat-conversations__control`, `.ai-chat-rename`, `.ai-chat-rename__input`, `.ai-chat-rename__save`, `.ai-chat-page__thread`, `.ai-chat-list__loading`

**주의 (TS-008):** 이 파일은 어제 정적 리뷰 3건과 테스트 80건을 전부 통과하고도 브라우저에서 페이지를 멈춰 세운 전례가 있는 종류의 코드다. 로딩 상태를 세우는 모든 경로에 **해제 경로가 반드시 있어야 한다**. `loadMessages`의 `finally`를 지우지 마라.

- [ ] **Step 1: `AiChat.js`를 아래 내용으로 전체 교체한다**

`src/components/AiChat.js` 전체 내용:

```javascript
// src/components/AiChat.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { sendChatMessage, isValidMessage, MAX_MESSAGE_LENGTH } from '../lib/aiChat';
import { buildConversationTitle, DEFAULT_CONVERSATION_TITLE } from '../lib/conversations';
import ConfirmDialog from './ui/ConfirmDialog';
import './AiChat.css';

const MAX_TITLE_INPUT_LENGTH = 60;

export const AiChat = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [failedMessage, setFailedMessage] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [isListOpen, setIsListOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const renameInputRef = useRef(null);
  // 대화를 빠르게 전환할 때 늦게 도착한 응답이 최신 화면을 덮어쓰지 않게 한다.
  const loadRequestRef = useRef(0);

  const loadMessages = useCallback(async (conversationId) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;

    setIsMessagesLoading(true);
    setAnnouncement('대화를 불러오는 중입니다.');

    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (loadRequestRef.current !== requestId) return;
      setMessages((data || []).slice().reverse());
      setAnnouncement('대화를 불러왔습니다.');
    } finally {
      // 실패해도 로딩 상태에서 반드시 빠져나온다.
      // (TS-008: 실패 경로가 로딩 해제를 건너뛰면 화면이 영구히 멈춘다)
      if (loadRequestRef.current === requestId) {
        setIsMessagesLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadConversations = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      const { data } = await supabase
        .from('conversations')
        .select('id, title, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (!isMounted) return;

      const list = data || [];
      setConversations(list);
      setIsLoading(false);

      if (list.length > 0) {
        setActiveId(list[0].id);
        loadMessages(list[0].id);
      }
    };

    loadConversations();

    return () => {
      isMounted = false;
    };
  }, [navigate, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
    }
  }, [renamingId]);

  const handleSelect = (conversationId) => {
    setIsListOpen(false);
    if (conversationId === activeId) return;

    setActiveId(conversationId);
    setMessages([]);
    setErrorMessage(null);
    setFailedMessage(null);
    loadMessages(conversationId);
  };

  const handleNewConversation = () => {
    // DB 행은 첫 메시지를 보낼 때 만든다. 버튼만 누르고 끝나면 빈 대화가 쌓인다.
    setIsListOpen(false);
    setActiveId(null);
    setMessages([]);
    setErrorMessage(null);
    setFailedMessage(null);
    setAnnouncement('새 대화를 시작합니다.');
    textareaRef.current?.focus();
  };

  const createConversation = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate('/login');
      return null;
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, title: DEFAULT_CONVERSATION_TITLE })
      .select('id, title, updated_at')
      .single();

    if (error || !data) return null;

    setConversations((prev) => [data, ...prev]);
    setActiveId(data.id);
    return data.id;
  };

  const handleSend = async (contentOverride) => {
    const content = (contentOverride ?? input).trim();
    if (!isValidMessage(content) || isSending) return;

    setIsSending(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setIsSending(false);
      navigate('/login');
      return;
    }

    // 낙관적 말풍선을 그리기 "전"에 첫 메시지 여부를 판단한다.
    let conversationId = activeId;
    let isFirstMessage = messages.length === 0;

    if (!conversationId) {
      conversationId = await createConversation();
      if (!conversationId) {
        setIsSending(false);
        setErrorMessage('대화를 만들지 못했어요.');
        setFailedMessage(content);
        return;
      }
      isFirstMessage = true;
    }

    setErrorMessage(null);
    setFailedMessage(null);
    setInput('');

    const userMessage = { id: `local-user-${Date.now()}`, role: 'user', content };
    const assistantMessage = {
      id: `local-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      await sendChatMessage({
        supabaseUrl: process.env.REACT_APP_SUPABASE_URL,
        accessToken: session.access_token,
        content,
        conversationId,
        onDelta: (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + delta };
            return next;
          });
        },
      });

      // Edge Function이 방금 갱신한 제목/정렬을 화면에도 반영한다(새로고침 없이).
      setConversations((prev) => {
        const target = prev.find((conversation) => conversation.id === conversationId);
        if (!target) return prev;
        const updated = isFirstMessage
          ? { ...target, title: buildConversationTitle(content) }
          : target;
        return [
          updated,
          ...prev.filter((conversation) => conversation.id !== conversationId),
        ];
      });

      setAnnouncement('');
      setTimeout(() => setAnnouncement('AI 응답이 도착했습니다.'), 0);
    } catch (error) {
      if (error.isDailyLimit) {
        setLimitReached(true);
      }
      setErrorMessage(error.message || '답변을 받지 못했어요.');
      setFailedMessage(content);
      // 낙관적으로 추가한 user 버블 + 빈 assistant 버블을 함께 제거한다.
      // 하나만 제거하면 재시도 시 같은 user 메시지가 중복 표시된다.
      setMessages((prev) => prev.slice(0, -2));
    } finally {
      setIsSending(false);
    }
  };

  const handleRetry = () => {
    if (failedMessage) {
      handleSend(failedMessage);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const startRename = (conversation) => {
    setRenamingId(conversation.id);
    setRenameValue(conversation.title);
  };

  const submitRename = async (event) => {
    event.preventDefault();

    const conversationId = renamingId;
    if (!conversationId) return;

    const trimmed = renameValue.trim();
    const nextTitle = trimmed.length === 0 ? DEFAULT_CONVERSATION_TITLE : trimmed;

    setRenamingId(null);
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, title: nextTitle } : conversation
      )
    );

    const { error } = await supabase
      .from('conversations')
      .update({ title: nextTitle })
      .eq('id', conversationId);

    if (error) {
      setErrorMessage('이름을 바꾸지 못했어요.');
    }
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;

    const { error } = await supabase.from('conversations').delete().eq('id', target.id);

    if (error) {
      setErrorMessage('대화를 삭제하지 못했어요.');
      return;
    }

    const remaining = conversations.filter((conversation) => conversation.id !== target.id);
    setConversations(remaining);
    setAnnouncement('대화를 삭제했습니다.');

    if (target.id === activeId) {
      const nextActiveId = remaining.length > 0 ? remaining[0].id : null;
      setActiveId(nextActiveId);
      setMessages([]);
      if (nextActiveId) {
        loadMessages(nextActiveId);
      }
    }
  };

  if (isLoading) {
    return <div className="ai-chat-page" />;
  }

  return (
    <div className="ai-chat-page">
      <header className="ai-chat-page__topbar">
        <h1 className="ai-chat-page__title">AI 채팅</h1>
        <div className="ai-chat-page__topbar-actions">
          <button
            type="button"
            className="ai-chat-page__list-toggle"
            aria-expanded={isListOpen}
            aria-controls="ai-chat-conversations"
            onClick={() => setIsListOpen((open) => !open)}
          >
            대화 목록
          </button>
          <button type="button" className="ai-chat-page__back" onClick={() => navigate(-1)}>
            뒤로가기
          </button>
          <button
            type="button"
            className="ai-chat-page__home"
            onClick={() => navigate('/mypage')}
          >
            HOME
          </button>
        </div>
      </header>

      <main className="ai-chat-page__main">
        <aside
          id="ai-chat-conversations"
          className={`ai-chat-conversations${
            isListOpen ? ' ai-chat-conversations--open' : ''
          }`}
        >
          <div className="ai-chat-conversations__head">
            <h2 className="ai-chat-conversations__heading">대화 목록</h2>
            <button
              type="button"
              className="ai-chat-conversations__new"
              onClick={handleNewConversation}
            >
              새 대화
            </button>
          </div>

          {conversations.length === 0 ? (
            <p className="ai-chat-conversations__empty">
              아직 대화가 없어요. 첫 질문을 보내면 대화가 만들어져요.
            </p>
          ) : (
            <ul className="ai-chat-conversations__list">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="ai-chat-conversations__item">
                  {renamingId === conversation.id ? (
                    <form className="ai-chat-rename" onSubmit={submitRename}>
                      <label className="sr-only" htmlFor={`rename-${conversation.id}`}>
                        대화 이름
                      </label>
                      <input
                        id={`rename-${conversation.id}`}
                        className="ai-chat-rename__input"
                        ref={renameInputRef}
                        value={renameValue}
                        maxLength={MAX_TITLE_INPUT_LENGTH}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            setRenamingId(null);
                          }
                        }}
                      />
                      <button type="submit" className="ai-chat-rename__save">
                        저장
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ai-chat-conversations__select"
                        aria-current={conversation.id === activeId ? 'true' : undefined}
                        onClick={() => handleSelect(conversation.id)}
                      >
                        {conversation.title}
                      </button>
                      <span className="ai-chat-conversations__controls">
                        <button
                          type="button"
                          className="ai-chat-conversations__control"
                          aria-label={`${conversation.title} 이름 변경`}
                          onClick={() => startRename(conversation)}
                        >
                          이름
                        </button>
                        <button
                          type="button"
                          className="ai-chat-conversations__control"
                          aria-label={`${conversation.title} 삭제`}
                          onClick={() => setDeleteTarget(conversation)}
                        >
                          삭제
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="ai-chat-page__thread">
          <div aria-live="polite" className="sr-only">
            {announcement}
          </div>
          <div className="ai-chat-list">
            {isMessagesLoading ? (
              <p className="ai-chat-list__loading">대화를 불러오는 중이에요.</p>
            ) : messages.length === 0 ? (
              <p className="ai-chat-list__empty">학습에 대해 궁금한 걸 물어보세요.</p>
            ) : (
              messages.map((message, index) => {
                const isWaitingForReply =
                  isSending &&
                  index === messages.length - 1 &&
                  message.role === 'assistant' &&
                  message.content === '';

                return (
                  <div
                    key={message.id}
                    className={`ai-chat-bubble ai-chat-bubble--${message.role}`}
                  >
                    {isWaitingForReply ? (
                      <span className="ai-chat-typing" aria-hidden="true">
                        <span className="ai-chat-typing__dot" />
                        <span className="ai-chat-typing__dot" />
                        <span className="ai-chat-typing__dot" />
                      </span>
                    ) : (
                      message.content
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {errorMessage && (
            <p className="ai-chat-error" role="alert">
              <span>{errorMessage}</span>
              {failedMessage && !limitReached && (
                <button type="button" onClick={handleRetry}>
                  다시 시도
                </button>
              )}
            </p>
          )}

          <form
            className="ai-chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              handleSend();
            }}
          >
            <label htmlFor="ai-chat-textarea" className="ai-chat-input__label">
              메시지 입력
            </label>
            <textarea
              id="ai-chat-textarea"
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={isSending || limitReached}
              placeholder={
                limitReached
                  ? '오늘 사용 가능한 메시지 횟수를 다 썼어요. 내일 다시 이용해주세요.'
                  : '학습에 대해 궁금한 걸 물어보세요.'
              }
            />
            <button type="submit" disabled={isSending || limitReached || !isValidMessage(input)}>
              전송
            </button>
          </form>
        </section>
      </main>

      {deleteTarget && (
        <ConfirmDialog
          title="이 대화를 삭제할까요?"
          description={`"${deleteTarget.title}" 안의 메시지도 함께 사라져요. 되돌릴 수 없어요.`}
          confirmLabel="삭제"
          cancelLabel="취소"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default AiChat;
```

- [ ] **Step 2: 테스트가 여전히 초록인지 확인한다**

이 파일에는 테스트가 없다(`react-router-dom` 때문에 Jest에서 로드 불가 — TS-003). 회귀가 없는지만 확인한다.

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 10 suites / 101 tests 전부 통과 (Task 5와 같은 수)

- [ ] **Step 3: 빌드가 통과하는지 확인한다**

Run: `npx react-scripts build`
Expected: `Compiled with warnings.` 또는 `Compiled successfully.` — **에러 없이 종료**. `UserGuide.js`의 jsx-a11y 경고 3건은 기존 부채이므로 그대로 나오는 것이 정상이다. 이번 diff의 파일(`AiChat.js`, `ConfirmDialog.js`, `conversations.js`)에서 나오는 새 경고는 없어야 한다.

- [ ] **Step 4: 커밋한다**

커밋은 사전 승인되어 있다. 사용자에게 묻지 말고 실행한다.

```bash
git add src/components/AiChat.js
git commit -m "feat: AI 채팅에 대화방 목록·생성·선택·이름변경·삭제 추가"
```

---

### Task 7: `AiChat.css` — 대화 목록 레이아웃과 반응형

**Files:**
- Modify: `src/components/AiChat.css`

**Interfaces:**
- Consumes: Task 6이 만든 클래스 이름들 (위 Task 6의 Produces 목록).
- Produces: 없음. 이 Task가 마지막 코드 변경이다.

**레이아웃 규칙:**
- `min-width: 900px` 이상: `.ai-chat-page__main`이 2열 그리드(`240px` 목록 + 나머지 대화). 목록은 항상 보이고 토글 버튼은 숨긴다.
- `900px` 미만: 1열. 목록은 기본으로 접혀 있고(`display: none`) 토글 버튼으로 편다. `position: fixed` 드로어를 쓰지 않는다 — 일반 흐름에서 접었다 펴는 편이 스크롤 잠금·백드롭·포커스 트랩 없이 안전하다.
- 320px에서 가로 스크롤이 생기면 안 된다. 대화 제목은 `text-overflow: ellipsis`로 자른다.

- [ ] **Step 1: 기존 `.ai-chat-page__main` 규칙을 교체한다**

`src/components/AiChat.css`에서 아래 블록을 찾는다:

```css
.ai-chat-page__main {
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
```

아래로 교체한다:

```css
.ai-chat-page__main {
  max-width: 1080px;
  width: 100%;
  margin: 0 auto;
  padding: var(--space-6);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
  flex: 1;
  min-height: 0;
}

.ai-chat-page__thread {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}
```

- [ ] **Step 2: 토글 버튼과 대화 목록 스타일을 추가한다**

`.ai-chat-page__main` 블록 **앞**(즉 `.ai-chat-page__home:focus-visible` 규칙 뒤)에 아래를 추가한다:

```css
.ai-chat-page__list-toggle {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.ai-chat-page__list-toggle:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.ai-chat-page__list-toggle:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

파일 **맨 끝**에 아래를 추가한다:

```css
/* ── 대화 목록 ─────────────────────────────────────────── */

.ai-chat-conversations {
  display: none;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-3);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

/* 좁은 화면에서 토글로 펼친 상태 */
.ai-chat-conversations--open {
  display: flex;
}

.ai-chat-conversations__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.ai-chat-conversations__heading {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text-muted);
  margin: 0;
}

.ai-chat-conversations__new {
  background: none;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  color: var(--color-accent);
  font-size: var(--text-xs);
  font-weight: 600;
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--duration-fast) var(--ease-out-expo);
}

.ai-chat-conversations__new:hover {
  background-color: var(--color-accent);
  color: var(--color-bg);
}

.ai-chat-conversations__new:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.ai-chat-conversations__empty {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  line-height: var(--leading-body);
  margin: 0;
}

.ai-chat-conversations__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  overflow-y: auto;
  min-height: 0;
}

.ai-chat-conversations__item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  border-radius: var(--radius-sm);
}

.ai-chat-conversations__select {
  flex: 1;
  min-width: 0;
  text-align: left;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background-color var(--duration-fast) var(--ease-out-expo);
}

.ai-chat-conversations__select:hover {
  background-color: var(--color-surface-alt);
}

.ai-chat-conversations__select:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* 선택된 대화는 색만이 아니라 왼쪽 막대로도 구분한다 */
.ai-chat-conversations__select[aria-current='true'] {
  background-color: var(--color-surface-alt);
  border-color: var(--color-border-strong);
  border-left: 3px solid var(--color-accent);
  color: var(--color-accent);
  font-weight: 600;
}

.ai-chat-conversations__controls {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.ai-chat-conversations__control {
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  /* 터치 대상 최소 24×24 (WCAG 2.2) */
  min-width: 1.75rem;
  min-height: 1.75rem;
  padding: var(--space-1);
  cursor: pointer;
}

.ai-chat-conversations__control:hover {
  border-color: var(--color-border);
  color: var(--color-text);
}

.ai-chat-conversations__control:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.ai-chat-rename {
  display: flex;
  gap: var(--space-1);
  width: 100%;
  min-width: 0;
}

.ai-chat-rename__input {
  flex: 1;
  min-width: 0;
  background-color: var(--color-bg);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-2);
}

.ai-chat-rename__input:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.ai-chat-rename__save {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  flex-shrink: 0;
}

.ai-chat-rename__save:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.ai-chat-list__loading {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

/* 넓은 화면: 목록을 고정 2열로 두고 토글 버튼을 숨긴다 */
@media (min-width: 900px) {
  .ai-chat-page__main {
    grid-template-columns: 240px minmax(0, 1fr);
    gap: var(--space-6);
  }

  .ai-chat-conversations {
    display: flex;
    align-self: stretch;
    overflow-y: auto;
  }

  .ai-chat-page__list-toggle {
    display: none;
  }
}
```

- [ ] **Step 3: 하드코딩된 색이 없는지 확인한다**

Run: `grep -nE '#[0-9a-fA-F]{3,8}|rgb\(|rgba\(' src/components/AiChat.css`

Expected: 매치 0건. 색상 리터럴이 하나라도 나오면 토큰으로 바꾼다.

Run: `grep -nE '[0-9]+px' src/components/AiChat.css`

Expected: 매치되는 줄은 **테두리 두께**(`1px solid …`, `3px solid …`)와 **브레이크포인트**(`@media (min-width: 900px)`)뿐이어야 한다. 그 외 위치의 px 값은 토큰으로 바꾼다.

- [ ] **Step 4: 빌드가 통과하는지 확인한다**

Run: `npx react-scripts build`
Expected: 에러 없이 종료. CSS 관련 새 경고 없음.

- [ ] **Step 5: 전체 테스트를 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 10 suites / 101 tests 전부 통과

- [ ] **Step 6: 커밋한다**

커밋은 사전 승인되어 있다. 사용자에게 묻지 말고 실행한다.

```bash
git add src/components/AiChat.css
git commit -m "feat: 대화 목록 레이아웃과 반응형 스타일 추가"
```

---

## 배포 (컨트롤러가 수행 — 서브에이전트 아님)

Task 2·3의 산출물은 커밋만으로 동작하지 않는다. **무중단 배포를 위해 아래 순서를 반드시 지킨다** —
`20260806120000`은 더 이상 not null을 걸지 않으므로 OLD Edge Function이 떠 있는 동안 적용해도 안전하다.
not null 승격(`20260806130000`)은 반드시 새 Edge Function 배포 "이후"에만 적용한다.

1. **기준선 기록** — Supabase SQL Editor에서 `select count(*) from chat_messages;`, `select count(distinct user_id) from chat_messages;` 결과를 적어 둔다.
2. **`20260806120000` 적용** — Task 2의 SQL(더 이상 not null을 걸지 않는다). TS-001 주의사항(Monaco 괄호 자동완성)을 지킨다.
3. **백필 검증** — Task 2의 검증 쿼리 3건. 하나라도 어긋나면 **다음 단계로 가지 말고** 원인을 찾는다.
4. **Edge Function 재배포** — Supabase 대시보드 Edge Functions 에디터로 `ai-chat` 함수에 Task 3의 코드를 반영한다. 이 시점까지 OLD 함수가 계속 메시지를 정상 처리하므로 서비스 중단이 없다.
5. **클라이언트 배포/새로고침** — 새 프론트엔드(Task 4~7 반영분)를 배포하거나 로컬 새로고침한다.
6. **배포 공백 재확인** — `select count(*) from chat_messages where conversation_id is null;`을 다시 실행한다. 2~4단계 사이에 OLD 함수가 써 넣은 행이 있으면 0보다 클 수 있다. 0보다 크면 먼저 그 행들을 올바른 대화로 백필한다.
7. **`20260806130000` 적용** — not null 승격. DO 블록 가드가 남은 NULL 행을 감지하면 명확한 한국어 예외로 실패하므로, 6단계를 건너뛰었다면 여기서 걸러진다.
8. 아래 "검증"으로 넘어간다.

---

## 검증 (전부 브라우저에서 직접 한다)

**정적 리뷰는 실행을 대체하지 못한다.** 어제 태스크 리뷰 3건과 테스트 80건을 전부 통과한 코드가 브라우저에서 페이지를 통째로 멈춰 세웠다(TS-008). 아래를 반드시 직접 눌러 본다.

1. **기존 대화 보존** — 기존 사용자로 로그인 → `/ai-chat` 진입 → 목록에 `이전 대화`가 보이고, 클릭하면 예전 메시지가 전부 그대로 나온다. **유실 0건.**
2. **새 대화 + 자동 제목** — `새 대화` → 질문 전송 → 목록 항목 제목이 질문 앞부분으로 바뀐다.
3. **맥락 분리 (이 작업의 핵심 증거)** — 대화 A에서 수학을 묻는다 → `새 대화`로 대화 B를 만들고 "방금 뭐 물어봤지?"라고 묻는다 → **AI가 모른다고 답해야 한다.** 여기서 수학 이야기가 나오면 Edge Function의 맥락 로드가 대화별로 좁혀지지 않은 것이다.
4. **이름 변경** — `이름` 버튼 → 입력 → 저장 → 새로고침해도 유지된다. `Esc`로 취소하면 원래 이름이 남는다.
5. **삭제** — `삭제` 버튼 → 확인 다이얼로그가 뜨고 `Esc`로 닫힌다 → 다시 열어 확인 → 대화와 메시지가 사라지고, 활성 대화를 지웠으면 다음 대화로 넘어간다.
6. **남의 `conversationId` 거절** — DevTools Network 탭에서 정상 `ai-chat` 요청 하나를 "Copy as fetch"로 복사한 뒤 `conversationId`만 `00000000-0000-4000-8000-000000000000`으로 바꿔 콘솔에서 실행한다.
   Expected: `404 { "error": "대화를 찾을 수 없습니다." }`. `conversationId` 키를 아예 지우면 `400`.
7. **일일 30건 제한** — 대화를 새로 파도 카운트가 초기화되지 않는다. Supabase에서 `select count(*) from chat_messages where user_id = '<내 id>' and role = 'user' and created_at >= '<KST 자정 UTC 값>';`으로 확인.
8. **좁은 화면** — DevTools 320px. 가로 스크롤이 없어야 한다. `대화 목록` 토글이 보이고, 펴면 목록이 위에 나타난다.
9. **키보드만** — 마우스를 치우고 Tab만으로: 대화 전환 → `새 대화` → 이름 변경 → 삭제 확인/취소가 전부 가능해야 한다. 포커스 링이 항상 보여야 한다. 다이얼로그가 열리면 Tab이 밖으로 나가지 않고, 닫으면 눌렀던 `삭제` 버튼으로 포커스가 돌아온다.
10. **대비비** — 선택된 대화(`aria-current`)의 텍스트 색과 배경 대비비가 4.5:1 이상인지 확인. **TS-006 주의: Chrome이 computed color를 `oklch()` 리터럴로 돌려준다. 정규식으로 숫자를 뽑으면 L/C/H를 R/G/B로 오독한다.** 캔버스 픽셀 판독으로 브라우저에 변환을 시킨다.

---

## 트러블슈팅 기록

건별로 **해결·검증 직후 즉시** `docs/TROUBLESHOOTING.md`에 기록한다. 마지막에 몰아 쓰지 않는다. 마지막 번호는 **TS-009**이므로 다음은 TS-010이다. 기록 절차는 그 파일 상단 규칙과 기존 항목 형식을 따른다: 인덱스 표 맨 위에 행 추가 + `## 기록` 섹션 끝에 본문 추가.

이번 작업에서 기록 대상이 될 가능성이 높은 것:
- 마이그레이션 백필이 예상과 다르게 나온 경우 (건수 불일치)
- Edge Function 재배포 후에도 옛 동작이 남는 경우
- 포커스 트랩·`aria-current`가 브라우저에서 기대와 다르게 동작하는 경우
