import { easeInOutCubic, countUpFrame } from './countUp';

describe('easeInOutCubic', () => {
  test('양 끝은 0과 1로 고정된다', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });

  test('중간점은 0.5다 — 곡선이 대칭이다', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
  });

  test('단조 증가한다', () => {
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const value = easeInOutCubic(t);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });

  test('앞구간은 느리게 출발한다 — 선형보다 작다', () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
  });
});

describe('countUpFrame', () => {
  test('시작 시점에는 0을 반환한다', () => {
    expect(countUpFrame(73, 0, 600)).toBe(0);
  });

  test('끝나면 목표값을 정확히 반환한다', () => {
    expect(countUpFrame(73, 600, 600)).toBe(73);
    expect(countUpFrame(73, 900, 600)).toBe(73);
  });

  test('중간 시점은 목표값의 절반이다', () => {
    expect(countUpFrame(100, 300, 600)).toBe(50);
  });

  test('정수로 반올림한다', () => {
    expect(Number.isInteger(countUpFrame(73, 200, 600))).toBe(true);
  });

  test('durationMs가 0 이하면 즉시 목표값 — 모션 감소 경로', () => {
    expect(countUpFrame(73, 0, 0)).toBe(73);
    expect(countUpFrame(73, 0, -1)).toBe(73);
  });

  test('목표값이 0이면 내내 0이다', () => {
    expect(countUpFrame(0, 300, 600)).toBe(0);
  });

  test('경과가 음수여도 0 아래로 내려가지 않는다', () => {
    expect(countUpFrame(73, -100, 600)).toBe(0);
  });
});
