import { focusLevel } from './focusLevel';

describe('focusLevel', () => {
  test('80 이상은 high', () => {
    expect(focusLevel(80)).toBe('high');
    expect(focusLevel(100)).toBe('high');
  });

  test('50~79는 mid', () => {
    expect(focusLevel(79)).toBe('mid');
    expect(focusLevel(50)).toBe('mid');
  });

  test('30~49는 low', () => {
    expect(focusLevel(49)).toBe('low');
    expect(focusLevel(30)).toBe('low');
  });

  test('30 미만은 poor', () => {
    expect(focusLevel(29)).toBe('poor');
    expect(focusLevel(0)).toBe('poor');
  });
});
