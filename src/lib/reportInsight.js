// 리포트 조언을 받아오는 클라이언트.
//
// 수치는 전부 앱에서 계산해서 넘긴다. 모델에게 원본을 주고 통계를 시키면
// 숫자가 틀릴 수 있다. 여기서는 다 세어 놓은 값을 주고 문장만 받는다.

export const MAX_ADVICE_ITEMS = 4;

// 밖으로 나가는 유일한 지점이다. 세션 객체를 통째로 넘기지 않고 필요한
// 숫자만 옮겨 담는다. 컬럼이 늘어도 자동으로 따라 나가지 않게 하려는 것이다.
export function buildInsightPayload({
  durationSeconds,
  focusScore,
  metrics,
  profile,
}) {
  const m = metrics || {};

  const session = {
    durationSeconds: durationSeconds ?? null,
    focusScore: focusScore ?? null,
    netFocusSeconds: m.netFocusSeconds ?? null,
    longestStreakMinutes: m.longestStreakMinutes ?? null,
    firstBreakMinute: m.firstBreakMinute ?? null,
    firstHalf: m.halves?.first ?? null,
    secondHalf: m.halves?.second ?? null,
    volatility: m.volatility ?? null,
    alertsPerHour: m.alertsPerHour ?? null,
    topDistraction: m.topDistraction
      ? { reason: m.topDistraction.reason, ratio: m.topDistraction.ratio }
      : null,
  };

  // 표본이 모자라면 성향을 아예 보내지 않는다. 근거가 약한 값을 주면
  // 모델은 그걸로 단정적인 문장을 만든다.
  const canProfile = Boolean(profile && profile.hasEnoughData);

  return {
    session,
    profile: canProfile
      ? {
          sessionCount: profile.sessionCount,
          averageScore: profile.averageScore,
          rhythmType: profile.rhythmType,
          distractionType: profile.distractionType,
          enduranceMinutes: profile.enduranceMinutes,
          trend: profile.trend,
          bestSlot: profile.bestSlot?.slot ?? null,
          bestWeekday: profile.bestWeekday?.weekday ?? null,
        }
      : null,
  };
}

/**
 * 조언 문장들을 받아온다. 실패하면 던진다 — 호출하는 쪽에서 조언 섹션만
 * 접고 리포트의 나머지는 그대로 보여줘야 한다.
 *
 * @returns {Promise<string[]>}
 */
export async function fetchReportInsight({
  supabaseUrl,
  accessToken,
  payload,
  signal,
}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/report-insight`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 토큰은 헤더로만 보낸다. URL에 실으면 로그·리퍼러에 남는다.
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(`조언을 받지 못했습니다 (${response.status})`);
  }

  const data = await response.json();
  if (!Array.isArray(data.advice)) {
    throw new Error('조언 형식이 올바르지 않습니다');
  }

  return data.advice
    .filter((item) => typeof item === 'string' && item.trim())
    .slice(0, MAX_ADVICE_ITEMS);
}
