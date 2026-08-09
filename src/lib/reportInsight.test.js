import { buildInsightPayload } from './reportInsight';

const metrics = {
  netFocusSeconds: 2628,
  longestStreakMinutes: 12,
  firstBreakMinute: 38,
  halves: { first: 82, second: 64, delta: -18 },
  volatility: 21,
  best: { minute: 11, ratio: 96 },
  worst: { minute: 47, ratio: 12 },
  alertsPerHour: 4,
  topDistraction: { reason: 'absent', ratio: 15, seconds: 540 },
};

const profile = {
  sessionCount: 12,
  averageScore: 71,
  hasEnoughData: true,
  rhythmType: 'early',
  distractionType: 'absent',
  enduranceMinutes: 35,
  trend: 'up',
  bestHour: { hour: 9, average: 84, count: 5 },
  bestWeekday: { weekday: 2, average: 80, count: 3 },
  byHour: [{ hour: 9, average: 84, count: 5 }],
  byWeekday: [{ weekday: 2, average: 80, count: 3 }],
};

describe('buildInsightPayload', () => {
  test('지표와 성향의 숫자를 담는다', () => {
    const payload = buildInsightPayload({
      durationSeconds: 3600,
      focusScore: 73,
      metrics,
      profile,
    });

    expect(payload.session.focusScore).toBe(73);
    expect(payload.session.longestStreakMinutes).toBe(12);
    expect(payload.session.topDistraction).toEqual({
      reason: 'absent',
      ratio: 15,
    });
    expect(payload.profile.rhythmType).toBe('early');
    expect(payload.profile.trend).toBe('up');
  });

  describe('개인정보', () => {
    // 이 함수가 앱에서 데이터가 외부로 나가는 유일한 지점이다.
    // 화이트리스트로만 채우고, 통째로 넘기는 실수를 여기서 막는다.
    const identifying = {
      id: 'ba5eba11-0000-0000-0000-000000000000',
      user_id: 'c0ffee00-0000-0000-0000-000000000000',
      started_at: '2026-08-09T14:30:00Z',
      video_path: 'user/abc/session.webm',
      alerts: [{ started_at: '2026-08-09T14:52:00Z', reason: 'absent' }],
      email: 'someone@example.com',
    };

    test('식별자·시각·영상 경로는 절대 나가지 않는다', () => {
      const payload = buildInsightPayload({
        durationSeconds: 3600,
        focusScore: 73,
        metrics,
        profile,
        ...identifying,
      });

      const serialized = JSON.stringify(payload);
      Object.values(identifying)
        .filter((value) => typeof value === 'string')
        .forEach((value) => {
          expect(serialized).not.toContain(value);
        });
      expect(serialized).not.toContain('session.webm');
      expect(serialized).not.toContain('@example.com');
    });

    test('내보내는 키가 예상 목록에서 벗어나지 않는다', () => {
      const payload = buildInsightPayload({
        durationSeconds: 3600,
        focusScore: 73,
        metrics,
        profile,
      });
      expect(Object.keys(payload).sort()).toEqual(['profile', 'session']);
    });
  });

  describe('값이 없을 때', () => {
    test('성향이 모자라면 profile은 null이다', () => {
      const payload = buildInsightPayload({
        durationSeconds: 600,
        focusScore: 50,
        metrics,
        profile: { ...profile, hasEnoughData: false },
      });
      expect(payload.profile).toBeNull();
    });

    test('지표가 비어도 던지지 않는다', () => {
      expect(() =>
        buildInsightPayload({
          durationSeconds: 0,
          focusScore: 0,
          metrics: {},
          profile: null,
        })
      ).not.toThrow();
    });
  });
});
