import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 학습 리포트의 조언 문단을 만든다.
//
// 수치는 전부 앱(src/lib/sessionMetrics.js, learningProfile.js)에서 계산해
// 넘어온다. 모델은 세지 않고 읽기만 한다 — 통계를 시키면 숫자가 틀린다.
//
// ⚠️ 여기 들어오는 본문은 클라이언트가 보낸 것이므로 신뢰하지 않는다.
// 숫자는 Number로 강제 변환하고 라벨은 허용 목록으로만 받는다. 그대로
// 프롬프트에 이어붙이면 조작된 클라이언트가 지시문을 심을 수 있다.

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 700;
const MAX_ADVICE_ITEMS = 4;

// ⚠️ src/lib/sessionMetrics.js의 WARMUP_MINUTES와 같은 값이어야 한다.
// 프롬프트가 지표의 정의를 잘못 설명하면 모델이 그 전제로 조언을 쓴다.
const WARMUP_MINUTES = 2;

// src/lib/focusTracker.js의 REASON과 1:1이다. 한쪽을 고치면 다른 쪽도 고친다.
const REASONS = [
  'focused',
  'looking_down',
  'head_turned',
  'looking_up',
  'eyes_closed',
  'absent',
] as const;
const RHYTHM_TYPES = ['early', 'late', 'steady', 'volatile'] as const;
const TRENDS = ['up', 'flat', 'down'] as const;

const REASON_LABELS: Record<string, string> = {
  focused: '집중',
  looking_down: '아래 보기',
  head_turned: '고개 돌림',
  looking_up: '위 보기',
  eyes_closed: '눈 감음',
  absent: '자리 비움',
};
const RHYTHM_LABELS: Record<string, string> = {
  early: '초반에 강하고 후반에 떨어지는 편',
  late: '후반으로 갈수록 오르는 편',
  steady: '전 구간 고른 편',
  volatile: '구간마다 기복이 큰 편',
};
const TREND_LABELS: Record<string, string> = {
  up: '최근 오르는 중',
  flat: '최근 비슷하게 유지',
  down: '최근 떨어지는 중',
};
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ⚠️ src/lib/learningProfile.js의 formatTimeSlot과 동일한 구현이다.
// Deno 런타임이라 그 파일을 import 할 수 없어 복제했다.
// learningProfile.test.js가 이 동작의 계약을 고정한다. 한쪽을 고치면 다른 쪽도 고친다.
const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;

function formatTimeSlot(slot: number): string | null {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS_PER_DAY) return null;
  const pad = (value: number) => String(value).padStart(2, '0');
  const clock = (minutes: number) =>
    `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
  const start = slot * SLOT_MINUTES;
  return `${clock(start)}~${clock(start + SLOT_MINUTES)}`;
}

const SYSTEM_PROMPT = `당신은 학습 집중도 리포트를 읽고 조언하는 코치입니다.

규칙:
- 주어진 수치만 근거로 삼습니다. 없는 데이터를 지어내지 않습니다.
- 수치를 다시 계산하거나 고치지 않습니다. 인용만 합니다.
- 조언은 ${MAX_ADVICE_ITEMS}개 이하, 각 2문장 이내로 씁니다.
- 각 조언은 관찰(무엇이 보였는지)과 행동(그래서 무엇을 해볼지)을 함께 담습니다.
- "열심히 하세요" 같은 일반론은 쓰지 않습니다. 이 사람의 수치에서만 나올 수 있는 말을 씁니다.
- 사용자를 평가하거나 훈계하지 않습니다. 담담하게 씁니다.
- 의학적 진단(수면장애, ADHD 등)을 내리지 않습니다.
- 한국어로 씁니다.

출력은 JSON 배열 하나만 냅니다. 설명이나 코드펜스를 붙이지 않습니다.
예: ["관찰과 행동을 담은 첫 조언.", "두 번째 조언."]`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// 유한한 숫자만 통과시킨다. NaN·Infinity·문자열이 프롬프트에 박히면
// 모델이 그걸 사실로 읽는다.
function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function oneOf(value: unknown, allowed: readonly string[]): string | null {
  return typeof value === 'string' && allowed.includes(value) ? value : null;
}

function line(label: string, value: number | null, unit = ''): string | null {
  return value === null ? null : `- ${label}: ${value}${unit}`;
}

function describeSession(raw: Record<string, unknown>): string[] {
  const distraction = raw.topDistraction as Record<string, unknown> | null;
  const reason = oneOf(distraction?.reason, REASONS);
  const ratio = num(distraction?.ratio);

  return [
    line('학습 시간(분)', Math.round((num(raw.durationSeconds) ?? 0) / 60)),
    line('종합 집중도', num(raw.focusScore), '%'),
    line('순 집중 시간(분)', Math.round((num(raw.netFocusSeconds) ?? 0) / 60)),
    line('최장 연속 집중(분)', num(raw.longestStreakMinutes)),
    line(
      `처음 집중이 무너진 시점(분, 첫 ${WARMUP_MINUTES}분 워밍업 제외)`,
      num(raw.firstBreakMinute)
    ),
    line('전반 집중도', num(raw.firstHalf), '%'),
    line('후반 집중도', num(raw.secondHalf), '%'),
    line('구간별 기복(표준편차)', num(raw.volatility)),
    line('시간당 이탈 횟수', num(raw.alertsPerHour)),
    reason && ratio !== null
      ? `- 가장 큰 이탈 원인: ${REASON_LABELS[reason]} (${ratio}%)`
      : null,
  ].filter((item): item is string => item !== null);
}

function describeProfile(raw: Record<string, unknown> | null): string[] {
  if (!raw) return [];

  const rhythm = oneOf(raw.rhythmType, RHYTHM_TYPES);
  const trend = oneOf(raw.trend, TRENDS);
  const distraction = oneOf(raw.distractionType, REASONS);
  const weekday = num(raw.bestWeekday);
  const slot = num(raw.bestSlot);
  const slotLabel = slot === null ? null : formatTimeSlot(slot);

  return [
    line('분석한 세션 수', num(raw.sessionCount)),
    line('평균 집중도', num(raw.averageScore), '%'),
    rhythm ? `- 리듬: ${RHYTHM_LABELS[rhythm]}` : null,
    distraction ? `- 반복되는 이탈 원인: ${REASON_LABELS[distraction]}` : null,
    line(
      `평균적으로 집중이 무너지기 시작하는 시점(분, 첫 ${WARMUP_MINUTES}분 워밍업 제외)`,
      num(raw.enduranceMinutes)
    ),
    trend ? `- 추세: ${TREND_LABELS[trend]}` : null,
    slotLabel ? `- 가장 잘 되는 시간대: ${slotLabel}` : null,
    weekday !== null && weekday >= 0 && weekday <= 6
      ? `- 가장 잘 되는 요일: ${WEEKDAYS[weekday]}요일`
      : null,
  ].filter((item): item is string => item !== null);
}

// 모델이 코드펜스를 붙이거나 배열 앞뒤에 말을 덧붙이는 경우가 있다.
// 첫 번째 JSON 배열만 떼어내고, 그것도 실패하면 줄 단위로 떨어뜨린다.
function parseAdvice(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string');
      }
    } catch {
      // 아래 줄 단위 처리로 넘어간다
    }
  }

  return text
    .split('\n')
    .map((rawLine) =>
      rawLine.replace(/^[-*\d.\s"]+/, '').replace(/"[,\s]*$/, '')
    )
    .filter((item) => item.length > 0);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userError } = await supabase.auth.getUser(
      jwt
    );
    if (userError || !userData?.user) {
      return jsonResponse({ error: '인증이 필요합니다.' }, 401);
    }

    let body: { session?: unknown; profile?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: '잘못된 요청입니다.' }, 400);
    }

    const sessionLines = describeSession(
      (body.session as Record<string, unknown>) || {}
    );
    if (sessionLines.length === 0) {
      return jsonResponse({ error: '분석할 수치가 없습니다.' }, 400);
    }
    const profileLines = describeProfile(
      (body.profile as Record<string, unknown>) || null
    );

    const userPrompt = [
      '## 이번 세션',
      ...sessionLines,
      ...(profileLines.length > 0
        ? ['', '## 최근 세션들의 성향', ...profileLines]
        : []),
    ].join('\n');

    const anthropicResponse = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      }
    );

    if (!anthropicResponse.ok) {
      return jsonResponse({ error: '조언을 만들지 못했습니다.' }, 502);
    }

    const result = await anthropicResponse.json();
    const text = (result.content || [])
      .filter((block: { type?: string }) => block.type === 'text')
      .map((block: { text?: string }) => block.text || '')
      .join('');

    return jsonResponse(
      { advice: parseAdvice(text).slice(0, MAX_ADVICE_ITEMS) },
      200
    );
  } catch {
    return jsonResponse({ error: '조언을 만들지 못했습니다.' }, 500);
  }
});
