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
