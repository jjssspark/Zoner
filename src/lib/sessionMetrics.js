import { FOCUSED_REASONS } from './focusTracker';

// 리포트에 쓰는 파생 지표. 저장된 세션 한 건만 보고 계산한다.
//
// 값을 못 내는 항목은 예외를 던지지 않고 null로 비운다. 리포트는 어떤
// 세션에서도 열려야 하는데, 지표 하나 때문에 화면 전체가 죽으면 안 된다.
// null과 0은 다르다 — "무너진 적 없음"과 "0분에 무너짐"을 섞으면 안 된다.

// 이 분이 "집중한 구간"이라고 말할 수 있는 하한. focusLevel의 high(80)와
// 같은 값을 쓴다. 리포트 안에서 기준이 두 개면 읽는 사람이 혼란스럽다.
const STREAK_THRESHOLD = 0.8;
// 집중이 "무너졌다"고 볼 하한. 절반도 못 채운 구간.
const BREAK_THRESHOLD = 0.5;

// 세션 앞부분은 무너짐 판정에서 뺀다. 카메라가 얼굴을 잡고 자세를 잡는
// 동안이라 거의 모든 세션이 0분에 낮게 찍히고, 그대로 세면 "집중 지속
// 한계 약 0분" 같은 뜻 없는 값이 나온다. 워밍업은 이탈이 아니다.
//
// 2분이다. 더 길게 잡으면 진짜 초반 이탈까지 가려서, 초반에 무너지는
// 사람에게 "한 번도 안 무너졌다"고 잘못 말하게 된다.
export const WARMUP_MINUTES = 2;

const toPercent = (ratio) => Math.round(ratio * 100);

const ratiosOf = (timeline) =>
  Array.isArray(timeline) ? timeline.map((bucket) => bucket.focus_ratio) : [];

const mean = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

function longestStreak(ratios) {
  let longest = 0;
  let current = 0;
  ratios.forEach((ratio) => {
    current = ratio >= STREAK_THRESHOLD ? current + 1 : 0;
    longest = Math.max(longest, current);
  });
  return longest;
}

function firstBreak(timeline) {
  if (!Array.isArray(timeline)) return null;
  const found = timeline.find(
    (bucket) =>
      bucket.minute >= WARMUP_MINUTES && bucket.focus_ratio < BREAK_THRESHOLD
  );
  return found ? found.minute : null;
}

// 전반이 후반보다 몇 %p 높은지. 지구력을 보는 지표다.
// 홀수 개면 가운데를 후반에 넣는다 — 후반이 짧아 보이는 것보다 낫다.
function halves(ratios) {
  if (ratios.length < 2) return null;
  const mid = Math.floor(ratios.length / 2);
  const first = toPercent(mean(ratios.slice(0, mid)));
  const second = toPercent(mean(ratios.slice(mid)));
  return { first, second, delta: second - first };
}

// 모표준편차. 표본이 아니라 그 세션 전체가 대상이므로 n으로 나눈다.
function volatility(ratios) {
  if (ratios.length === 0) return null;
  const avg = mean(ratios);
  const variance = mean(ratios.map((ratio) => (ratio - avg) ** 2));
  return toPercent(Math.sqrt(variance));
}

function extreme(timeline, pick) {
  if (!Array.isArray(timeline) || timeline.length === 0) return null;
  const found = timeline.reduce((acc, bucket) =>
    pick(bucket.focus_ratio, acc.focus_ratio) ? bucket : acc
  );
  return { minute: found.minute, ratio: toPercent(found.focus_ratio) };
}

function alertsPerHour(alerts, durationSeconds) {
  if (!durationSeconds) return null;
  const count = Array.isArray(alerts) ? alerts.length : 0;
  return Math.round((count / (durationSeconds / 3600)) * 10) / 10;
}

// 가장 많이 집중을 뺏은 원인. looking_down은 집중으로 집계되므로
// (focusTracker의 FOCUSED_REASONS) 비율이 아무리 커도 후보가 아니다.
function topDistraction(breakdown, durationSeconds) {
  const entries = Object.entries(breakdown || {}).filter(
    ([reason, ratio]) => !FOCUSED_REASONS.includes(reason) && ratio > 0
  );
  if (entries.length === 0) return null;

  const [reason, ratio] = entries.reduce((acc, entry) =>
    entry[1] > acc[1] ? entry : acc
  );
  return {
    reason,
    ratio: toPercent(ratio),
    seconds: Math.round(ratio * (durationSeconds || 0)),
  };
}

const EMPTY = {
  netFocusSeconds: null,
  longestStreakMinutes: 0,
  firstBreakMinute: null,
  halves: null,
  volatility: null,
  best: null,
  worst: null,
  alertsPerHour: null,
  topDistraction: null,
};

export function computeSessionMetrics(session) {
  if (!session) return { ...EMPTY };

  const { duration_seconds, focus_score, timeline, focus_breakdown, alerts } =
    session;
  const ratios = ratiosOf(timeline);

  return {
    netFocusSeconds:
      typeof focus_score === 'number'
        ? Math.round(((duration_seconds || 0) * focus_score) / 100)
        : null,
    longestStreakMinutes: longestStreak(ratios),
    firstBreakMinute: firstBreak(timeline),
    halves: halves(ratios),
    volatility: volatility(ratios),
    best: extreme(timeline, (a, b) => a > b),
    worst: extreme(timeline, (a, b) => a < b),
    alertsPerHour: alertsPerHour(alerts, duration_seconds),
    topDistraction: topDistraction(focus_breakdown, duration_seconds),
  };
}

export default computeSessionMetrics;
