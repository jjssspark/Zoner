import { TextEncoder, TextDecoder } from 'util';
import { isValidMessage, MAX_MESSAGE_LENGTH, parseChatStreamLine, sendChatMessage } from './aiChat';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

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

  test('429 응답이면 에러 객체에 isDailyLimit 플래그가 설정된다', async () => {
    const response = {
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: '오늘 사용 가능한 메시지 횟수를 다 썼어요. 내일 다시 이용해주세요.' }),
    };
    global.fetch = jest.fn().mockResolvedValue(response);

    let caughtError;
    try {
      await sendChatMessage({
        supabaseUrl: 'https://example.supabase.co',
        accessToken: 'token123',
        content: '안녕',
        onDelta: () => {},
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError.isDailyLimit).toBe(true);
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
