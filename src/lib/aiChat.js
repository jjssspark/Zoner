export const MAX_MESSAGE_LENGTH = 4000;
export const DAILY_MESSAGE_LIMIT = 30;

export function isValidMessage(content) {
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH;
}

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

export async function sendChatMessage({ supabaseUrl, accessToken, content, conversationId, onDelta }) {
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ content, conversationId }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(
        data.error || '오늘 사용 가능한 메시지 횟수를 다 썼어요. 내일 다시 이용해주세요.'
      );
      error.isDailyLimit = true;
      throw error;
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
