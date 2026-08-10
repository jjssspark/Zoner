# Zoner AI 채팅 (학습 보조) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **상태 (2026-08-07 확인)**: 이 계획의 기능은 구현되어 코드베이스에 있다.
> **아래 체크박스는 실행 중에 갱신되지 않았다 — 진행 표시로 신뢰하지 말 것.**
> 미체크는 "안 했다"가 아니라 "표시를 안 했다"이다. 실제 반영 여부는 `src/`
> 코드와 테스트(214건 통과)로 확인한다.

**Goal:** Mypage 퀵액션의 "AI 채팅" 버튼(`/ai-chat`)을 눌렀을 때, Anthropic Claude와 스트리밍으로 실시간 질의응답할 수 있는 학습 보조 채팅 화면을 제공한다.

**Architecture:** 브라우저(React)가 Supabase Edge Function(`ai-chat`)을 직접 `fetch`로 호출한다. Edge Function이 사용자 인증·일일 메시지 한도를 확인한 뒤 Anthropic Messages API를 스트리밍 호출하고, 응답을 단순화된 SSE(`data: {"text": "..."}\n\n` → `data: [DONE]\n\n`)로 그대로 중계한다. 스트림 종료 시 user/assistant 메시지를 `chat_messages` 테이블에 저장한다. Claude API 키는 Edge Function 환경변수(secret)에만 존재한다.

**Tech Stack:** React 19 + react-router-dom v7 (CRA/react-scripts 5.0.1), Supabase (Postgres + Auth + Edge Functions, Deno), Anthropic Messages API (스트리밍).

## Global Constraints

- 모델 ID는 정확히 `claude-haiku-4-5-20251001` 문자열을 사용한다.
- `MAX_MESSAGE_LENGTH = 4000` (문자 수), `DAILY_MESSAGE_LIMIT = 30` (사용자당 하루 user 메시지 수).
- 시스템 프롬프트는 다음 문자열을 그대로 고정 사용한다: `"당신은 학습을 돕는 AI 보조 튜터입니다. 간결하고 실용적으로 답하세요."`
- Anthropic API 호출 시 대화 컨텍스트로 최근 20개 메시지만 전달한다 (`chat_messages`에서 `created_at desc limit 20` 조회 후 다시 오름차순 정렬).
- 테이블/컬럼 명명은 `~/.claude/standards/db-conventions.md` 규약을 따른다: `chat_messages` 테이블, snake_case 컬럼, `role`은 ENUM이 아닌 `TEXT + CHECK` 제약.
- **react-router-dom v7 + CRA Jest 리졸버 이슈(TS-003, `docs/TROUBLESHOOTING.md` 기록됨):** `react-router-dom`을 import하는 파일(`AiChat.js` 등)은 Jest로 직접 테스트하지 않는다. 테스트 가능한 순수 로직은 `src/lib/aiChat.js`처럼 별도 파일로 분리해 그 파일만 테스트한다.
- Edge Function의 모든 응답(OPTIONS 프리플라이트 포함)에 CORS 헤더를 포함한다: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`.
- **ANTHROPIC_API_KEY 시크릿 값은 사용자가 직접 Supabase 대시보드 또는 CLI로 설정한다.** 에이전트(Claude)는 어떤 경우에도 실제 API 키 값을 대화·코드·명령어 인자로 다루거나 브라우저 자동화로 입력하지 않는다 — 이 시크릿 설정만은 사용자 본인이 수행해야 하는 수동 단계다.
- Edge Function은 배포 시 `supabase functions deploy` (CLI) 또는 Supabase 대시보드 Edge Functions 에디터로 배포한다. 코드 자체(시크릿이 아닌)는 컨트롤러가 대신 배포할 수 있다.

---

### Task 1: DB 마이그레이션 — `chat_messages` 테이블

**Files:**
- Create: `supabase/migrations/20260805120000_create_chat_messages.sql`

**Interfaces:**
- Produces: `chat_messages` 테이블 — 컬럼 `id uuid`, `user_id uuid`, `role text` (`'user'|'assistant'`), `content text`, `created_at timestamptz`. RLS로 본인 행만 select/insert 가능. Task 3(Edge Function)과 Task 4(프론트)가 이 스키마를 조회/삽입한다.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- supabase/migrations/20260805120000_create_chat_messages.sql

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

- [ ] **Step 2: 커밋**

```bash
git add supabase/migrations/20260805120000_create_chat_messages.sql
git commit -m "feat: chat_messages 테이블 마이그레이션 추가"
```

**참고 (구현자는 실행하지 않음, 컨트롤러가 별도 수행):** 이 SQL은 서브에이전트가 아닌 컨트롤러가 Supabase SQL Editor에서 직접 실행하고 `select * from chat_messages limit 1;`, `select policyname from pg_policies where tablename = 'chat_messages';`로 검증한다 (트래시 기능 구현 때와 동일한 패턴 — 서브에이전트는 브라우저 자동화 권한이 없음).

---

### Task 2: 공유 로직 — `src/lib/aiChat.js`

**Files:**
- Create: `src/lib/aiChat.js`
- Test: `src/lib/aiChat.test.js`

**Interfaces:**
- Consumes: 없음 (전역 `fetch`만 사용, `react-router-dom`이나 컴포넌트에 의존하지 않음).
- Produces:
  - `export const MAX_MESSAGE_LENGTH = 4000;`
  - `export const DAILY_MESSAGE_LIMIT = 30;`
  - `export function isValidMessage(content: string): boolean`
  - `export function parseChatStreamLine(line: string): { type: 'delta', text: string } | { type: 'done' } | { type: 'error', message: string } | null`
  - `export async function sendChatMessage({ supabaseUrl, accessToken, content, onDelta }): Promise<string>` — Task 4(`AiChat.js`)가 사용.

- [ ] **Step 1: 실패하는 테스트 작성 — `isValidMessage`**

```javascript
// src/lib/aiChat.test.js
import { isValidMessage, MAX_MESSAGE_LENGTH } from './aiChat';

describe('isValidMessage', () => {
  test('빈 문자열은 유효하지 않다', () => {
    expect(isValidMessage('')).toBe(false);
  });

  test('공백만 있는 문자열은 유효하지 않다', () => {
    expect(isValidMessage('   ')).toBe(false);
  });

  test('일반 문자열은 유효하다', () => {
    expect(isValidMessage('미분적분이 어려워')).toBe(true);
  });

  test('정확히 4000자는 유효하다', () => {
    expect(isValidMessage('a'.repeat(MAX_MESSAGE_LENGTH))).toBe(true);
  });

  test('4001자는 유효하지 않다', () => {
    expect(isValidMessage('a'.repeat(MAX_MESSAGE_LENGTH + 1))).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `CI=true npx react-scripts test src/lib/aiChat --watchAll=false`
Expected: FAIL with "isValidMessage is not a function" (또는 모듈 없음)

- [ ] **Step 3: `isValidMessage` 최소 구현**

```javascript
// src/lib/aiChat.js
export const MAX_MESSAGE_LENGTH = 4000;
export const DAILY_MESSAGE_LIMIT = 30;

export function isValidMessage(content) {
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `CI=true npx react-scripts test src/lib/aiChat --watchAll=false`
Expected: PASS (5개 테스트)

- [ ] **Step 5: 실패하는 테스트 작성 — `parseChatStreamLine`**

```javascript
// src/lib/aiChat.test.js에 추가
import { parseChatStreamLine } from './aiChat';

describe('parseChatStreamLine', () => {
  test('data: 텍스트 델타를 파싱한다', () => {
    const line = 'data: {"text":"안녕"}';
    expect(parseChatStreamLine(line)).toEqual({ type: 'delta', text: '안녕' });
  });

  test('data: [DONE]을 종료 이벤트로 파싱한다', () => {
    expect(parseChatStreamLine('data: [DONE]')).toEqual({ type: 'done' });
  });

  test('data: 에러 페이로드를 파싱한다', () => {
    const line = 'data: {"error":"요청 실패"}';
    expect(parseChatStreamLine(line)).toEqual({ type: 'error', message: '요청 실패' });
  });

  test('data:로 시작하지 않는 줄은 null을 반환한다', () => {
    expect(parseChatStreamLine('event: ping')).toBeNull();
  });

  test('잘못된 JSON은 null을 반환한다', () => {
    expect(parseChatStreamLine('data: {broken')).toBeNull();
  });
});
```

- [ ] **Step 6: 테스트 실행 — 실패 확인**

Run: `CI=true npx react-scripts test src/lib/aiChat --watchAll=false`
Expected: FAIL with "parseChatStreamLine is not a function"

- [ ] **Step 7: `parseChatStreamLine` 구현**

```javascript
// src/lib/aiChat.js에 추가
export function parseChatStreamLine(line) {
  if (!line.startsWith('data: ')) return null;
  const payload = line.slice(6).trim();
  if (payload === '[DONE]') return { type: 'done' };

  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (typeof parsed.error === 'string') return { type: 'error', message: parsed.error };
  if (typeof parsed.text === 'string') return { type: 'delta', text: parsed.text };
  return null;
}
```

- [ ] **Step 8: 테스트 실행 — 통과 확인**

Run: `CI=true npx react-scripts test src/lib/aiChat --watchAll=false`
Expected: PASS (10개 테스트)

- [ ] **Step 9: 실패하는 테스트 작성 — `sendChatMessage`**

```javascript
// src/lib/aiChat.test.js에 추가
import { sendChatMessage } from './aiChat';

function mockStreamResponse(lines, { ok = true, status = 200 } = {}) {
  const encoder = new TextEncoder();
  let index = 0;
  const reader = {
    read: jest.fn(() => {
      if (index >= lines.length) {
        return Promise.resolve({ done: true, value: undefined });
      }
      const chunk = encoder.encode(lines[index]);
      index += 1;
      return Promise.resolve({ done: false, value: chunk });
    }),
  };
  return {
    ok,
    status,
    body: { getReader: () => reader },
    json: () => Promise.resolve({}),
  };
}

describe('sendChatMessage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('스트림 델타를 onDelta로 전달하고 전체 텍스트를 반환한다', async () => {
    const response = mockStreamResponse([
      'data: {"text":"안"}\n\n',
      'data: {"text":"녕"}\n\n',
      'data: [DONE]\n\n',
    ]);
    global.fetch = jest.fn().mockResolvedValue(response);

    const deltas = [];
    const result = await sendChatMessage({
      supabaseUrl: 'https://example.supabase.co',
      accessToken: 'token123',
      content: '안녕',
      onDelta: (text) => deltas.push(text),
    });

    expect(deltas).toEqual(['안', '녕']);
    expect(result).toBe('안녕');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/ai-chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token123' }),
      })
    );
  });

  test('429 응답이면 한도 초과 메시지로 reject한다', async () => {
    const response = {
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: '오늘 사용 가능한 메시지 횟수를 다 썼어요. 내일 다시 이용해주세요.' }),
    };
    global.fetch = jest.fn().mockResolvedValue(response);

    await expect(
      sendChatMessage({
        supabaseUrl: 'https://example.supabase.co',
        accessToken: 'token123',
        content: '안녕',
        onDelta: () => {},
      })
    ).rejects.toThrow('오늘 사용 가능한 메시지 횟수를 다 썼어요. 내일 다시 이용해주세요.');
  });

  test('그 외 오류 응답이면 일반 오류 메시지로 reject한다', async () => {
    const response = { ok: false, status: 502, json: () => Promise.resolve({}) };
    global.fetch = jest.fn().mockResolvedValue(response);

    await expect(
      sendChatMessage({
        supabaseUrl: 'https://example.supabase.co',
        accessToken: 'token123',
        content: '안녕',
        onDelta: () => {},
      })
    ).rejects.toThrow('답변을 받지 못했어요.');
  });
});
```

- [ ] **Step 10: 테스트 실행 — 실패 확인**

Run: `CI=true npx react-scripts test src/lib/aiChat --watchAll=false`
Expected: FAIL with "sendChatMessage is not a function"

- [ ] **Step 11: `sendChatMessage` 구현**

```javascript
// src/lib/aiChat.js에 추가
export async function sendChatMessage({ supabaseUrl, accessToken, content, onDelta }) {
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.error || '오늘 사용 가능한 메시지 횟수를 다 썼어요. 내일 다시 이용해주세요.'
      );
    }
    throw new Error('답변을 받지 못했어요.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const event = parseChatStreamLine(part);
      if (!event) continue;
      if (event.type === 'delta') {
        fullText += event.text;
        onDelta(event.text);
      } else if (event.type === 'error') {
        throw new Error(event.message);
      } else if (event.type === 'done') {
        return fullText;
      }
    }
  }

  return fullText;
}
```

- [ ] **Step 12: 테스트 실행 — 통과 확인**

Run: `CI=true npx react-scripts test src/lib/aiChat --watchAll=false`
Expected: PASS (13개 테스트)

- [ ] **Step 13: 커밋**

```bash
git add src/lib/aiChat.js src/lib/aiChat.test.js
git commit -m "feat: AI 채팅 공유 로직(aiChat.js) 추가"
```

---

### Task 3: Supabase Edge Function — `supabase/functions/ai-chat/index.ts`

**Files:**
- Create: `supabase/functions/ai-chat/index.ts`

**Interfaces:**
- Consumes: Task 1의 `chat_messages` 테이블.
- Produces: HTTP 엔드포인트 계약 — `POST {SUPABASE_URL}/functions/v1/ai-chat`, 헤더 `Authorization: Bearer <user JWT>`, 바디 `{ "content": string }`. 성공 시 `text/event-stream` 응답으로 `data: {"text": "..."}\n\n` 델타 후 `data: [DONE]\n\n`. 실패 시 JSON `{ "error": string }` + 상태코드(400/401/429/500/502). Task 2의 `sendChatMessage`가 이 계약을 그대로 가정하고 작성됨.

- [ ] **Step 1: Edge Function 코드 작성**

```typescript
// supabase/functions/ai-chat/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_MESSAGE_LENGTH = 4000;
const DAILY_MESSAGE_LIMIT = 30;
const SYSTEM_PROMPT = '당신은 학습을 돕는 AI 보조 튜터입니다. 간결하고 실용적으로 답하세요.';

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

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace('Bearer ', '');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return jsonResponse({ error: '인증이 필요합니다.' }, 401);
  }
  const userId = userData.user.id;

  let body: { content?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: '잘못된 요청입니다.' }, 400);
  }

  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (content.length === 0 || content.length > MAX_MESSAGE_LENGTH) {
    return jsonResponse({ error: '메시지 길이가 올바르지 않습니다.' }, 400);
  }

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

  const { error: insertUserError } = await supabase
    .from('chat_messages')
    .insert({ user_id: userId, role: 'user', content });

  if (insertUserError) {
    return jsonResponse({ error: '요청을 처리하지 못했습니다.' }, 500);
  }

  const { data: history, error: historyError } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (historyError) {
    return jsonResponse({ error: '요청을 처리하지 못했습니다.' }, 500);
  }

  const messages = (history ?? [])
    .slice()
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));

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

          if (event.type === 'content_block_delta' && event.delta?.text) {
            fullText += event.delta.text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }
      }

      await supabase
        .from('chat_messages')
        .insert({ user_id: userId, role: 'assistant', content: fullText });

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
});
```

- [ ] **Step 2: 커밋**

```bash
git add supabase/functions/ai-chat/index.ts
git commit -m "feat: AI 채팅 Supabase Edge Function 추가"
```

**참고 (구현자는 실행하지 않음, 컨트롤러/사용자가 별도 수행):**
1. 컨트롤러가 Supabase 대시보드 Edge Functions 에디터(또는 CLI)로 이 코드를 `ai-chat` 함수로 배포한다.
2. **사용자 본인이** Supabase 대시보드의 Edge Functions → Secrets(또는 `supabase secrets set ANTHROPIC_API_KEY=...`)에서 `ANTHROPIC_API_KEY` 값을 직접 설정한다 — 에이전트는 이 값을 절대 입력하지 않는다.
3. 배포·시크릿 설정 후, 로그인한 브라우저 세션에서 `curl` 또는 실제 프론트(Task 4) 연동으로 스트리밍 응답이 오는지 검증한다.

---

### Task 4: 프론트엔드 — `AiChat.js` + 라우트 등록

**Files:**
- Create: `src/components/AiChat.js`
- Create: `src/components/AiChat.css`
- Modify: `src/App.js` (라우트 추가)

**Interfaces:**
- Consumes: Task 2의 `sendChatMessage`, `isValidMessage`, `MAX_MESSAGE_LENGTH`; Task 1의 `chat_messages` 테이블(이력 조회); 기존 `src/lib/supabaseClient.js`의 `supabase` 클라이언트.
- Produces: `/ai-chat` 라우트. Mypage 퀵액션(`Mypage.js`의 `QUICK_ACTIONS`에 이미 `{ label: 'AI 채팅', path: '/ai-chat' }` 존재, 수정 불필요)이 이 라우트로 연결된다.

- [ ] **Step 1: `AiChat.js` 작성**

```javascript
// src/components/AiChat.js
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { sendChatMessage, isValidMessage, MAX_MESSAGE_LENGTH } from '../lib/aiChat';
import './AiChat.css';

export const AiChat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [failedMessage, setFailedMessage] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      const { data } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (isMounted) {
        setMessages(data || []);
        setIsLoading(false);
      }
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (contentOverride) => {
    const content = (contentOverride ?? input).trim();
    if (!isValidMessage(content) || isSending) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate('/login');
      return;
    }

    setErrorMessage(null);
    setFailedMessage(null);
    setIsSending(true);
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
        onDelta: (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + delta };
            return next;
          });
        },
      });
    } catch (error) {
      if (error.message.includes('오늘 사용 가능한')) {
        setLimitReached(true);
      }
      setErrorMessage(error.message || '답변을 받지 못했어요.');
      setFailedMessage(content);
      setMessages((prev) => prev.slice(0, -1));
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

  if (isLoading) {
    return <div className="ai-chat-page" />;
  }

  return (
    <div className="ai-chat-page">
      <header className="ai-chat-page__topbar">
        <h1 className="ai-chat-page__title">AI 채팅</h1>
        <button type="button" className="ai-chat-page__home" onClick={() => navigate('/mypage')}>
          HOME
        </button>
      </header>

      <main className="ai-chat-page__main">
        <div className="ai-chat-list" aria-live="polite">
          {messages.length === 0 ? (
            <p className="ai-chat-list__empty">학습에 대해 궁금한 걸 물어보세요.</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`ai-chat-bubble ai-chat-bubble--${message.role}`}>
                {message.content}
              </div>
            ))
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
      </main>
    </div>
  );
};

export default AiChat;
```

- [ ] **Step 2: `AiChat.css` 작성**

```css
/* src/components/AiChat.css */
.ai-chat-page {
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text);
  display: flex;
  flex-direction: column;
}

.ai-chat-page__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.ai-chat-page__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  margin: 0;
}

.ai-chat-page__home {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.ai-chat-page__home:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.ai-chat-page__home:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

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

.ai-chat-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-4);
}

.ai-chat-list__empty {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.ai-chat-bubble {
  max-width: 80%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: var(--leading-body);
  white-space: pre-wrap;
}

.ai-chat-bubble--user {
  align-self: flex-end;
  background-color: var(--color-accent);
  color: var(--color-bg);
}

.ai-chat-bubble--assistant {
  align-self: flex-start;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
}

.ai-chat-error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.ai-chat-error button {
  background: none;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
}

.ai-chat-error button:focus-visible {
  outline: 2px solid var(--color-danger);
  outline-offset: 2px;
}

.ai-chat-input {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-4);
}

.ai-chat-input__label {
  position: absolute;
  left: -9999px;
}

.ai-chat-input textarea {
  flex: 1;
  resize: none;
  min-height: 2.5rem;
  max-height: 8rem;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font: inherit;
  padding: var(--space-3);
}

.ai-chat-input textarea:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.ai-chat-input textarea:disabled {
  opacity: 0.6;
}

.ai-chat-input button {
  background-color: var(--color-accent);
  color: var(--color-bg);
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-5);
  font-weight: 600;
  cursor: pointer;
}

.ai-chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-chat-input button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 3: `App.js`에 라우트 등록**

```javascript
// src/App.js — import 블록에 추가
import AiChat from './components/AiChat';

// <Routes> 안에 추가
<Route path="/ai-chat" element={<AiChat />} />
```

- [ ] **Step 4: 개발 서버로 수동 확인**

Run: `npm start` (이미 실행 중이면 생략), 로그인 후 `/mypage` → "AI 채팅" 클릭 → `/ai-chat` 진입 확인. Task 3 배포 전이므로 메시지 전송은 502/네트워크 에러가 정상 — 이 단계에서는 라우팅·빈 상태·입력창 렌더링만 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add src/components/AiChat.js src/components/AiChat.css src/App.js
git commit -m "feat: AI 채팅 화면(/ai-chat) 및 라우트 추가"
```
