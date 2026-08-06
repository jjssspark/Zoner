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
