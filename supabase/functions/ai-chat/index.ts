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

  try {
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
            .insert({ user_id: userId, role: 'assistant', content: fullText });

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
