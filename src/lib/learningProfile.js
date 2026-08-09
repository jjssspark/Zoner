import { FOCUSED_REASONS } from './focusTracker';
import { computeSessionMetrics } from './sessionMetrics';

// 여러 세션을 겹쳐 봐야 보이는 것들. 세션 하나는 그날의 컨디션일 뿐이고,
// 성향은 반복에서 나온다.
//
// 표본이 모자라면 성향 항목을 null로 비운다. 세션 2개로 "당신은 후반형"
// 이라고 쓰는 건 데이터가 아니라 점이다.
export const MIN_PROFILE_SESSIONS = 3;

// 전후반 차이가 이만큼(%p) 벌어져야 리듬에 방향이 있다고 본다.
const RHYTHM_DELTA = 15;
// 전후반이 비슷해도 구간 안에서 이만큼 출렁이면 기복형이다.
const VOLATILE_THRESHOLD = 25;
// 추세를 "움직였다"고 부를 최소 변화(%p).
const TREND_DELTA = 5;

const mean = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const averageOf = (values) =>
  values.length === 0 ? null : Math.round(mean(values));

const startedAtMs = (session) => new Date(session.started_at).getTime();
const hasValidDate = (session) => !Number.isNaN(startedAtMs(session));

// 세션마다 sessionMetrics를 다시 계산한다. 지표 정의가 리포트와 성향에서
// 갈라지지 않게 하려는 것이다 — 같은 숫자를 두 군데서 따로 세면 언젠가 어긋난다.
const metricsOf = (sessions) => sessions.map((s) => computeSessionMetrics(s));

function rhythmType(metrics) {
  const deltas = metrics.map((m) => m.halves?.delta).filter((d) => d != null);
  const volatilities = metrics.map((m) => m.volatility).filter((v) => v != null);
  if (deltas.length === 0) return null;

  const delta = mean(deltas);
  if (delta <= -RHYTHM_DELTA) return 'early';
  if (delta >= RHYTHM_DELTA) return 'late';

  if (volatilities.length > 0 && mean(volatilities) >= VOLATILE_THRESHOLD) {
    return 'volatile';
  }
  return 'steady';
}

function distractionType(sessions) {
  const totals = new Map();
  sessions.forEach((session) => {
    Object.entries(session.focus_breakdown || {}).forEach(([reason, ratio]) => {
      if (FOCUSED_REASONS.includes(reason) || !(ratio > 0)) return;
      totals.set(reason, (totals.get(reason) || 0) + ratio);
    });
  });

  if (totals.size === 0) return null;
  return [...totals.entries()].reduce((acc, entry) =>
    entry[1] > acc[1] ? entry : acc
  )[0];
}

// 평균적으로 몇 분째에 처음 무너지는가. 세션 길이를 정할 때 쓰라고 낸다.
function enduranceMinutes(metrics) {
  const breaks = metrics
    .map((m) => m.firstBreakMinute)
    .filter((minute) => minute != null);
  return averageOf(breaks);
}

// 오래된 절반과 최근 절반의 평균을 견준다. 선형회귀까지 갈 표본이 아니다.
function trend(sessions) {
  const dated = sessions.filter(hasValidDate);
  if (dated.length < MIN_PROFILE_SESSIONS) return null;

  const scores = [...dated]
    .sort((a, b) => startedAtMs(a) - startedAtMs(b))
    .map((session) => session.focus_score)
    .filter((score) => typeof score === 'number');
  if (scores.length < MIN_PROFILE_SESSIONS) return null;

  const mid = Math.floor(scores.length / 2);
  const delta = mean(scores.slice(mid)) - mean(scores.slice(0, mid));
  if (delta >= TREND_DELTA) return 'up';
  if (delta <= -TREND_DELTA) return 'down';
  return 'flat';
}

// 날짜가 깨진 세션은 여기서만 빠진다. 전체 집계까지 막지는 않는다.
function groupBy(sessions, keyOf, keyName) {
  const buckets = new Map();
  sessions.filter(hasValidDate).forEach((session) => {
    if (typeof session.focus_score !== 'number') return;
    const key = keyOf(new Date(session.started_at));
    const bucket = buckets.get(key) || [];
    bucket.push(session.focus_score);
    buckets.set(key, bucket);
  });

  return [...buckets.entries()]
    .map(([key, scores]) => ({
      [keyName]: key,
      average: Math.round(mean(scores)),
      count: scores.length,
    }))
    .sort((a, b) => a[keyName] - b[keyName]);
}

const pickBest = (rows) =>
  rows.length === 0
    ? null
    : rows.reduce((acc, row) => (row.average > acc.average ? row : acc));

export function buildLearningProfile(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const hasEnoughData = list.length >= MIN_PROFILE_SESSIONS;

  const byWeekday = groupBy(list, (date) => date.getDay(), 'weekday');
  const byHour = groupBy(list, (date) => date.getHours(), 'hour');
  const metrics = hasEnoughData ? metricsOf(list) : [];

  return {
    sessionCount: list.length,
    averageScore: averageOf(
      list.map((s) => s.focus_score).filter((score) => typeof score === 'number')
    ),
    hasEnoughData,
    byWeekday,
    byHour,
    bestWeekday: pickBest(byWeekday),
    bestHour: pickBest(byHour),
    rhythmType: hasEnoughData ? rhythmType(metrics) : null,
    distractionType: hasEnoughData ? distractionType(list) : null,
    enduranceMinutes: hasEnoughData ? enduranceMinutes(metrics) : null,
    trend: hasEnoughData ? trend(list) : null,
  };
}

export default buildLearningProfile;
