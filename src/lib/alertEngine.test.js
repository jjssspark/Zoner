import { createAlertEngine, ALERT_CONSECUTIVE_TICKS, ALERT_MESSAGES } from './alertEngine';

const T0 = Date.UTC(2026, 7, 6, 5, 0, 0); // 2026-08-06T05:00:00.000Z
const tick = (offsetSeconds, focused, reason) => ({
  timestampMs: T0 + offsetSeconds * 1000,
  focused,
  reason,
});
const unfocused = (s, reason = 'absent') => tick(s, false, reason);
const focusedTick = (s) => tick(s, true, 'focused');

describe('createAlertEngine — 발화 규칙', () => {
  test('2틱 비집중으로는 발화하지 않는다', () => {
    const onAlert = jest.fn();
    const engine = createAlertEngine({ onAlert });
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    expect(onAlert).not.toHaveBeenCalled();
  });

  test('3틱째에 정확히 1회 발화한다', () => {
    const onAlert = jest.fn();
    const engine = createAlertEngine({ onAlert });
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10));
    expect(onAlert).toHaveBeenCalledTimes(1);
    expect(onAlert).toHaveBeenCalledWith({
      started_at: new Date(T0 + 10000).toISOString(),
      reason: 'absent',
    });
  });

  test('기본 임계값은 ALERT_CONSECUTIVE_TICKS와 같다', () => {
    expect(ALERT_CONSECUTIVE_TICKS).toBe(3);
  });

  test('알림이 열린 동안에는 reason이 바뀌어도 재발화하지 않는다', () => {
    const onAlert = jest.fn();
    const engine = createAlertEngine({ onAlert });
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10, 'absent'));
    engine.handleTick(unfocused(15, 'head_turned'));
    engine.handleTick(unfocused(20, 'eyes_closed'));
    expect(onAlert).toHaveBeenCalledTimes(1);
  });

  test('저장되는 reason은 발화 시점의 값이다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0, 'head_turned'));
    engine.handleTick(unfocused(5, 'head_turned'));
    engine.handleTick(unfocused(10, 'absent'));
    engine.handleTick(unfocused(15, 'eyes_closed'));
    engine.handleTick(focusedTick(20));
    expect(engine.getAlerts()[0].reason).toBe('absent');
  });

  test('발화 전에 집중으로 돌아오면 카운트가 초기화된다', () => {
    const onAlert = jest.fn();
    const engine = createAlertEngine({ onAlert });
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(focusedTick(10));
    engine.handleTick(unfocused(15));
    engine.handleTick(unfocused(20));
    expect(onAlert).not.toHaveBeenCalled();
  });

  test('임계값을 주입할 수 있다', () => {
    const onAlert = jest.fn();
    const engine = createAlertEngine({ consecutiveTicks: 2, onAlert });
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    expect(onAlert).toHaveBeenCalledTimes(1);
  });

  test('onAlert를 주지 않아도 동작한다', () => {
    const engine = createAlertEngine({});
    expect(() => {
      engine.handleTick(unfocused(0));
      engine.handleTick(unfocused(5));
      engine.handleTick(unfocused(10));
    }).not.toThrow();
    expect(engine.getAlerts()).toEqual([]);
  });
});

describe('createAlertEngine — 이벤트 기록', () => {
  test('집중 복귀 시 ended_at과 duration_seconds가 채워진다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10));
    engine.handleTick(focusedTick(90));

    expect(engine.getAlerts()).toEqual([
      {
        started_at: new Date(T0 + 10000).toISOString(),
        ended_at: new Date(T0 + 90000).toISOString(),
        reason: 'absent',
        duration_seconds: 80,
        // 이 테스트의 틱에는 elapsedMs가 없으므로 폴백인 0이 된다.
        offset_seconds: 0,
      },
    ]);
  });

  test('비집중이 전혀 없으면 빈 배열이다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(focusedTick(0));
    engine.handleTick(focusedTick(5));
    expect(engine.finish(T0 + 10000)).toEqual([]);
  });

  test('발화하지 않은 짧은 비집중은 기록되지 않는다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(focusedTick(10));
    expect(engine.finish(T0 + 15000)).toEqual([]);
  });

  test('finish()가 열린 알림을 종료 시각으로 닫는다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10));

    const alerts = engine.finish(T0 + 40000);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ended_at).toBe(new Date(T0 + 40000).toISOString());
    expect(alerts[0].duration_seconds).toBe(30);
  });

  test('finish()는 최종 배열을 반환한다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10));
    expect(engine.finish(T0 + 20000)).toEqual(engine.getAlerts());
  });

  test('여러 번 이탈하면 순서대로 쌓인다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10, 'absent'));
    engine.handleTick(focusedTick(20));
    engine.handleTick(unfocused(30, 'eyes_closed'));
    engine.handleTick(unfocused(35, 'eyes_closed'));
    engine.handleTick(unfocused(40, 'eyes_closed'));
    engine.handleTick(focusedTick(50));

    const alerts = engine.getAlerts();
    expect(alerts.map((a) => a.reason)).toEqual(['absent', 'eyes_closed']);
    expect(alerts.map((a) => a.duration_seconds)).toEqual([10, 10]);
  });

  test('getAlerts()는 복사본을 반환해 외부 변형이 내부에 남지 않는다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10));
    engine.handleTick(focusedTick(20));

    engine.getAlerts().push({ bogus: true });
    expect(engine.getAlerts()).toHaveLength(1);
  });
});

describe('createAlertEngine — 일시정지(reset)', () => {
  test('reset()이 열린 알림을 그 시각으로 닫는다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10));

    engine.reset(T0 + 25000);
    const alerts = engine.getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ended_at).toBe(new Date(T0 + 25000).toISOString());
    expect(alerts[0].duration_seconds).toBe(15);
  });

  test('reset() 후에는 카운트가 처음부터 다시 센다', () => {
    const onAlert = jest.fn();
    const engine = createAlertEngine({ onAlert });
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.reset(T0 + 6000);
    engine.handleTick(unfocused(60));
    engine.handleTick(unfocused(65));
    expect(onAlert).not.toHaveBeenCalled();
    engine.handleTick(unfocused(70));
    expect(onAlert).toHaveBeenCalledTimes(1);
  });

  test('열린 알림이 없을 때 reset()은 아무 기록도 남기지 않는다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.reset(T0 + 3000);
    expect(engine.getAlerts()).toEqual([]);
  });
});

describe('ALERT_MESSAGES', () => {
  test('배너 대상 reason 4종에 문구가 있다', () => {
    expect(ALERT_MESSAGES).toEqual({
      absent: '자리를 비우셨나요?',
      head_turned: '화면에서 시선이 벗어났어요',
      looking_up: '집중이 흐트러진 것 같아요',
      eyes_closed: '졸고 계신가요? 잠깐 쉬어가세요',
    });
  });

  test('집중으로 판정되는 reason에는 문구가 없다', () => {
    expect(ALERT_MESSAGES.focused).toBeUndefined();
    expect(ALERT_MESSAGES.looking_down).toBeUndefined();
  });
});

describe('알림 오프셋 — 영상 seek 지점', () => {
  const tick = (elapsedMs, focused, reason) => ({
    timestampMs: 1000000 + elapsedMs,
    elapsedMs,
    focused,
    reason,
  });

  test('알림에 offset_seconds가 붙는다', () => {
    const engine = createAlertEngine();

    engine.handleTick(tick(5000, false, 'absent'));
    engine.handleTick(tick(10000, false, 'absent'));
    engine.handleTick(tick(15000, false, 'absent'));

    const alerts = engine.finish(1_020_000);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].offset_seconds).toBe(15);
  });

  test('오프셋은 발화한 틱의 경과 시간이다 — 벽시계가 아니다', () => {
    const engine = createAlertEngine();

    // 일시정지를 사이에 껴서 timestampMs와 elapsedMs를 크게 벌린다
    engine.handleTick({ timestampMs: 9_000_000, elapsedMs: 5000, focused: false, reason: 'absent' });
    engine.handleTick({ timestampMs: 9_005_000, elapsedMs: 10000, focused: false, reason: 'absent' });
    engine.handleTick({ timestampMs: 9_010_000, elapsedMs: 15000, focused: false, reason: 'absent' });

    const alerts = engine.finish(9_015_000);
    expect(alerts[0].offset_seconds).toBe(15);
  });

  test('elapsedMs가 없으면 오프셋이 0이다', () => {
    const engine = createAlertEngine();

    engine.handleTick({ timestampMs: 1000, focused: false, reason: 'absent' });
    engine.handleTick({ timestampMs: 2000, focused: false, reason: 'absent' });
    engine.handleTick({ timestampMs: 3000, focused: false, reason: 'absent' });

    const alerts = engine.finish(4000);
    expect(alerts[0].offset_seconds).toBe(0);
  });

  test('기존 필드는 그대로 유지된다', () => {
    const engine = createAlertEngine();

    engine.handleTick(tick(5000, false, 'head_turned'));
    engine.handleTick(tick(10000, false, 'head_turned'));
    engine.handleTick(tick(15000, false, 'head_turned'));

    const alerts = engine.finish(1_020_000);
    expect(Object.keys(alerts[0]).sort()).toEqual([
      'duration_seconds',
      'ended_at',
      'offset_seconds',
      'reason',
      'started_at',
    ]);
  });
});
