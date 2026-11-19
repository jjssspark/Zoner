import { computeSessionMetrics, WARMUP_MINUTES } from './sessionMetrics';

// ratio 배열을 timeline 모양으로 바꾼다. 테스트가 분 번호가 아니라
// 집중도 곡선 자체에 집중하도록.
const timelineOf = (ratios) =>
  ratios.map((focus_ratio, minute) => ({ minute, focus_ratio }));

const sessionOf = (overrides = {}) => ({
  duration_seconds: 600,
  focus_score: 70,
  timeline: timelineOf([0.7, 0.7, 0.7, 0.7, 0.7]),
  focus_breakdown: {},
  alerts: [],
  ...overrides,
});

describe('computeSessionMetrics', () => {
  describe('순 집중 시간', () => {
    test('학습 시간에 집중률을 곱한다', () => {
      const m = computeSessionMetrics(
        sessionOf({ duration_seconds: 3600, focus_score: 73 })
      );
      expect(m.netFocusSeconds).toBe(2628);
    });
  });

  describe('최장 연속 집중 구간', () => {
    test('80% 이상이 이어진 가장 긴 구간을 분으로 센다', () => {
      const m = computeSessionMetrics(
        sessionOf({
          // 2분 - 끊김 - 4분. 뒤쪽이 이긴다.
          timeline: timelineOf([0.9, 0.85, 0.2, 0.9, 0.95, 0.8, 0.88, 0.1]),
        })
      );
      expect(m.longestStreakMinutes).toBe(4);
    });

    test('한 번도 80%에 못 닿으면 0이다', () => {
      const m = computeSessionMetrics(
        sessionOf({ timeline: timelineOf([0.5, 0.6, 0.7]) })
      );
      expect(m.longestStreakMinutes).toBe(0);
    });

    test('끝까지 유지되면 전체 길이가 된다', () => {
      const m = computeSessionMetrics(
        sessionOf({ timeline: timelineOf([0.9, 0.9, 0.9]) })
      );
      expect(m.longestStreakMinutes).toBe(3);
    });
  });

  describe('집중이 처음 무너진 시점', () => {
    test('50% 아래로 처음 떨어진 분을 찾는다', () => {
      const m = computeSessionMetrics(
        sessionOf({
          timeline: timelineOf([0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.3, 0.9, 0.2]),
        })
      );
      expect(m.firstBreakMinute).toBe(6);
    });

    test('끝까지 안 무너지면 null이다 — 0분과 구분되어야 한다', () => {
      const m = computeSessionMetrics(
        sessionOf({
          timeline: timelineOf([0.9, 0.8, 0.7, 0.9, 0.8, 0.7, 0.9, 0.8]),
        })
      );
      expect(m.firstBreakMinute).toBeNull();
    });

    // 워밍업 길이를 바꿔도 테스트가 따라오도록 상수에서 만든다.
    const warmupLow = Array(WARMUP_MINUTES).fill(0.1);

    test(`워밍업 ${WARMUP_MINUTES}분 안의 하락은 무너짐으로 세지 않는다`, () => {
      // 카메라가 얼굴을 잡기 전이라 거의 모든 세션의 앞부분이 낮게 찍힌다.
      // 이걸 세면 "집중 지속 한계 약 0분"이라는 뜻 없는 값이 나온다.
      const m = computeSessionMetrics(
        sessionOf({ timeline: timelineOf([...warmupLow, 0.9, 0.9, 0.9, 0.9]) })
      );
      expect(m.firstBreakMinute).toBeNull();
    });

    test('워밍업이 끝나자마자 무너지면 그 분을 집는다', () => {
      const m = computeSessionMetrics(
        sessionOf({ timeline: timelineOf([...warmupLow, 0.2, 0.9, 0.9]) })
      );
      expect(m.firstBreakMinute).toBe(WARMUP_MINUTES);
    });

    test('워밍업보다 짧은 세션은 판정하지 않는다', () => {
      const m = computeSessionMetrics(
        sessionOf({ timeline: timelineOf(warmupLow) })
      );
      expect(m.firstBreakMinute).toBeNull();
    });
  });

  describe('전반 / 후반', () => {
    test('후반이 떨어지면 delta가 음수다', () => {
      const m = computeSessionMetrics(
        sessionOf({ timeline: timelineOf([1, 1, 0.5, 0.5]) })
      );
      expect(m.halves.first).toBe(100);
      expect(m.halves.second).toBe(50);
      expect(m.halves.delta).toBe(-50);
    });

    test('홀수 개면 가운데 구간은 후반에 넣는다', () => {
      const m = computeSessionMetrics(
        sessionOf({ timeline: timelineOf([1, 0.5, 0.5]) })
      );
      expect(m.halves.first).toBe(100);
      expect(m.halves.second).toBe(50);
    });

    test('구간이 하나뿐이면 전후반을 나눌 수 없어 null이다', () => {
      const m = computeSessionMetrics(
        sessionOf({ timeline: timelineOf([0.8]) })
      );
      expect(m.halves).toBeNull();
    });
  });

  describe('기복', () => {
    test('한결같으면 0이다', () => {
      const m = computeSessionMetrics(
        sessionOf({ timeline: timelineOf([0.6, 0.6, 0.6]) })
      );
      expect(m.volatility).toBe(0);
    });

    test('출렁일수록 커진다', () => {
      const steady = computeSessionMetrics(
        sessionOf({ timeline: timelineOf([0.5, 0.6, 0.5, 0.6]) })
      );
      const wild = computeSessionMetrics(
        sessionOf({ timeline: timelineOf([0, 1, 0, 1]) })
      );
      expect(wild.volatility).toBeGreaterThan(steady.volatility);
    });
  });

  describe('최고 / 최저 구간', () => {
    test('가장 높은 분과 가장 낮은 분을 집는다', () => {
      const m = computeSessionMetrics(
        sessionOf({ timeline: timelineOf([0.4, 0.95, 0.2, 0.7]) })
      );
      expect(m.best).toEqual({ minute: 1, ratio: 95 });
      expect(m.worst).toEqual({ minute: 2, ratio: 20 });
    });
  });

  describe('시간당 이탈 횟수', () => {
    test('30분에 2회면 시간당 4회다', () => {
      const m = computeSessionMetrics(
        sessionOf({
          duration_seconds: 1800,
          alerts: [{ reason: 'absent' }, { reason: 'absent' }],
        })
      );
      expect(m.alertsPerHour).toBe(4);
    });

    test('학습 시간이 0이면 나눌 수 없어 null이다', () => {
      const m = computeSessionMetrics(
        sessionOf({ duration_seconds: 0, alerts: [{ reason: 'absent' }] })
      );
      expect(m.alertsPerHour).toBeNull();
    });
  });

  describe('주 이탈 원인', () => {
    test('집중으로 치는 원인은 후보에서 뺀다', () => {
      // focused와 looking_down은 집중으로 집계된다(focusTracker).
      // 비율이 가장 커도 "이탈 원인"이 될 수 없다.
      const m = computeSessionMetrics(
        sessionOf({
          duration_seconds: 600,
          focus_breakdown: {
            focused: 0.6,
            looking_down: 0.2,
            absent: 0.15,
            eyes_closed: 0.05,
          },
        })
      );
      expect(m.topDistraction.reason).toBe('absent');
      expect(m.topDistraction.ratio).toBe(15);
      expect(m.topDistraction.seconds).toBe(90);
    });

    test('이탈이 전혀 없으면 null이다', () => {
      const m = computeSessionMetrics(
        sessionOf({ focus_breakdown: { focused: 1 } })
      );
      expect(m.topDistraction).toBeNull();
    });
  });

  describe('데이터가 없을 때', () => {
    // 리포트는 어떤 세션에서도 열려야 한다. 지표 계산이 예외를 던지면
    // 화면 전체가 죽는다. 값을 못 내는 항목은 null로 비운다.
    test('timeline이 비어도 던지지 않는다', () => {
      const m = computeSessionMetrics(sessionOf({ timeline: [] }));
      expect(m.longestStreakMinutes).toBe(0);
      expect(m.firstBreakMinute).toBeNull();
      expect(m.halves).toBeNull();
      expect(m.best).toBeNull();
      expect(m.worst).toBeNull();
      expect(m.volatility).toBeNull();
    });

    test('세션 자체가 없어도 던지지 않는다', () => {
      expect(() => computeSessionMetrics(null)).not.toThrow();
      expect(computeSessionMetrics(null).netFocusSeconds).toBeNull();
    });

    test('timeline과 alerts가 배열이 아니어도 던지지 않는다', () => {
      const m = computeSessionMetrics(
        sessionOf({ timeline: null, alerts: undefined, focus_breakdown: null })
      );
      expect(m.best).toBeNull();
      expect(m.topDistraction).toBeNull();
      expect(m.alertsPerHour).toBe(0);
    });
  });
});
