import { buildLearningProfile, MIN_PROFILE_SESSIONS } from './learningProfile';

const timelineOf = (ratios) =>
  ratios.map((focus_ratio, minute) => ({ minute, focus_ratio }));

// 로컬 시각으로 고정한다. Z를 붙이면 타임존에 따라 요일·시간대가 밀려
// 요일 집계 테스트가 실행 환경에 좌우된다.
const sessionOf = ({
  at = '2026-08-03T10:00:00',
  score = 70,
  ratios = [0.7, 0.7, 0.7, 0.7],
  breakdown = {},
} = {}) => ({
  started_at: at,
  duration_seconds: 600,
  focus_score: score,
  timeline: timelineOf(ratios),
  focus_breakdown: breakdown,
});

const repeat = (count, factory) =>
  Array.from({ length: count }, (_, i) => factory(i));

describe('buildLearningProfile', () => {
  describe('표본이 모자랄 때', () => {
    // 세션 2개로 "당신은 후반형입니다"라고 쓰면 근거 없는 단정이 된다.
    test(`${MIN_PROFILE_SESSIONS}개 미만이면 성향을 내지 않는다`, () => {
      const profile = buildLearningProfile([sessionOf(), sessionOf()]);
      expect(profile.hasEnoughData).toBe(false);
      expect(profile.rhythmType).toBeNull();
      expect(profile.trend).toBeNull();
    });

    test('빈 배열이나 null에도 던지지 않는다', () => {
      expect(() => buildLearningProfile(null)).not.toThrow();
      expect(buildLearningProfile([]).hasEnoughData).toBe(false);
      expect(buildLearningProfile(null).sessionCount).toBe(0);
    });

    test('표본이 모자라도 셀 수 있는 것은 센다', () => {
      const profile = buildLearningProfile([
        sessionOf({ score: 60 }),
        sessionOf({ score: 80 }),
      ]);
      expect(profile.sessionCount).toBe(2);
      expect(profile.averageScore).toBe(70);
    });
  });

  describe('리듬 유형', () => {
    test('후반이 크게 떨어지면 초반형이다', () => {
      const profile = buildLearningProfile(
        repeat(4, () => sessionOf({ ratios: [1, 1, 0.4, 0.4] }))
      );
      expect(profile.rhythmType).toBe('early');
    });

    test('후반이 크게 오르면 후반형이다', () => {
      const profile = buildLearningProfile(
        repeat(4, () => sessionOf({ ratios: [0.4, 0.4, 1, 1] }))
      );
      expect(profile.rhythmType).toBe('late');
    });

    test('전후반이 비슷하고 잔잔하면 꾸준형이다', () => {
      const profile = buildLearningProfile(
        repeat(4, () => sessionOf({ ratios: [0.7, 0.72, 0.7, 0.71] }))
      );
      expect(profile.rhythmType).toBe('steady');
    });

    test('전후반이 비슷해도 안에서 출렁이면 기복형이다', () => {
      // 전반 평균과 후반 평균은 같지만 구간마다 0과 1을 오간다.
      const profile = buildLearningProfile(
        repeat(4, () => sessionOf({ ratios: [1, 0, 1, 0] }))
      );
      expect(profile.rhythmType).toBe('volatile');
    });
  });

  describe('이탈 유형', () => {
    test('가장 많이 쌓인 이탈 원인을 고른다', () => {
      const profile = buildLearningProfile(
        repeat(4, () =>
          sessionOf({
            breakdown: {
              focused: 0.6,
              looking_down: 0.2,
              absent: 0.05,
              eyes_closed: 0.15,
            },
          })
        )
      );
      expect(profile.distractionType).toBe('eyes_closed');
    });

    test('집중으로 치는 원인은 후보가 아니다', () => {
      const profile = buildLearningProfile(
        repeat(4, () =>
          sessionOf({ breakdown: { looking_down: 0.9, absent: 0.1 } })
        )
      );
      expect(profile.distractionType).toBe('absent');
    });

    test('이탈이 없으면 null이다', () => {
      const profile = buildLearningProfile(
        repeat(4, () => sessionOf({ breakdown: { focused: 1 } }))
      );
      expect(profile.distractionType).toBeNull();
    });
  });

  describe('집중 지속 한계', () => {
    test('무너지기 시작한 분의 평균을 낸다', () => {
      const profile = buildLearningProfile([
        sessionOf({ ratios: [0.9, 0.9, 0.9, 0.1] }), // 3분
        sessionOf({ ratios: [0.9, 0.1, 0.9, 0.9] }), // 1분
        sessionOf({ ratios: [0.9, 0.9, 0.1, 0.9] }), // 2분
      ]);
      expect(profile.enduranceMinutes).toBe(2);
    });

    test('한 번도 안 무너지면 null이다', () => {
      const profile = buildLearningProfile(
        repeat(4, () => sessionOf({ ratios: [0.9, 0.9, 0.9, 0.9] }))
      );
      expect(profile.enduranceMinutes).toBeNull();
    });
  });

  describe('추세', () => {
    test('최근으로 올수록 오르면 상승이다', () => {
      const profile = buildLearningProfile([
        sessionOf({ at: '2026-08-01T10:00:00', score: 50 }),
        sessionOf({ at: '2026-08-02T10:00:00', score: 55 }),
        sessionOf({ at: '2026-08-03T10:00:00', score: 80 }),
        sessionOf({ at: '2026-08-04T10:00:00', score: 85 }),
      ]);
      expect(profile.trend).toBe('up');
    });

    test('입력 순서가 최신순이어도 같은 답을 낸다', () => {
      // Supabase는 보통 최신순으로 내려준다. 정렬을 안에서 해야 한다.
      const profile = buildLearningProfile([
        sessionOf({ at: '2026-08-04T10:00:00', score: 85 }),
        sessionOf({ at: '2026-08-03T10:00:00', score: 80 }),
        sessionOf({ at: '2026-08-02T10:00:00', score: 55 }),
        sessionOf({ at: '2026-08-01T10:00:00', score: 50 }),
      ]);
      expect(profile.trend).toBe('up');
    });

    test('떨어지면 하락이다', () => {
      const profile = buildLearningProfile([
        sessionOf({ at: '2026-08-01T10:00:00', score: 85 }),
        sessionOf({ at: '2026-08-02T10:00:00', score: 80 }),
        sessionOf({ at: '2026-08-03T10:00:00', score: 55 }),
        sessionOf({ at: '2026-08-04T10:00:00', score: 50 }),
      ]);
      expect(profile.trend).toBe('down');
    });

    test('작은 차이는 유지로 본다', () => {
      const profile = buildLearningProfile([
        sessionOf({ at: '2026-08-01T10:00:00', score: 70 }),
        sessionOf({ at: '2026-08-02T10:00:00', score: 72 }),
        sessionOf({ at: '2026-08-03T10:00:00', score: 71 }),
        sessionOf({ at: '2026-08-04T10:00:00', score: 73 }),
      ]);
      expect(profile.trend).toBe('flat');
    });
  });

  describe('요일 · 시간대', () => {
    test('요일별로 묶어 평균을 낸다', () => {
      // 2026-08-03은 월요일, 08-04는 화요일.
      const profile = buildLearningProfile([
        sessionOf({ at: '2026-08-03T10:00:00', score: 60 }),
        sessionOf({ at: '2026-08-03T14:00:00', score: 80 }),
        sessionOf({ at: '2026-08-04T10:00:00', score: 40 }),
      ]);
      const monday = profile.byWeekday.find((row) => row.weekday === 1);
      expect(monday).toEqual({ weekday: 1, average: 70, count: 2 });
    });

    test('가장 잘 되는 시간대를 집는다', () => {
      const profile = buildLearningProfile([
        sessionOf({ at: '2026-08-03T09:00:00', score: 90 }),
        sessionOf({ at: '2026-08-04T09:00:00', score: 88 }),
        sessionOf({ at: '2026-08-05T22:00:00', score: 40 }),
      ]);
      expect(profile.bestHour.hour).toBe(9);
      expect(profile.bestHour.average).toBe(89);
    });

    test('날짜가 깨진 세션은 요일 집계에서 빠지되 전체를 막지 않는다', () => {
      const profile = buildLearningProfile([
        sessionOf({ at: '2026-08-03T10:00:00', score: 60 }),
        sessionOf({ at: '어제', score: 80 }),
        sessionOf({ at: '2026-08-04T10:00:00', score: 40 }),
      ]);
      expect(profile.sessionCount).toBe(3);
      expect(profile.byWeekday.reduce((sum, row) => sum + row.count, 0)).toBe(2);
    });
  });
});
