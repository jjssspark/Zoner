import { daysUntilPurge, expiryLevel, PURGE_AFTER_DAYS } from './trash';

describe('daysUntilPurge', () => {
  test('returns the full purge window when deleted just now', () => {
    const now = new Date('2026-08-05T12:00:00.000Z');
    const deletedAt = '2026-08-05T12:00:00.000Z';
    expect(daysUntilPurge(deletedAt, now)).toBe(PURGE_AFTER_DAYS);
  });

  test('returns the remaining days when partially elapsed', () => {
    const now = new Date('2026-08-10T12:00:00.000Z');
    const deletedAt = '2026-08-05T12:00:00.000Z';
    expect(daysUntilPurge(deletedAt, now)).toBe(PURGE_AFTER_DAYS - 5);
  });

  test('clamps to 0 when already past the purge window', () => {
    const now = new Date('2026-09-10T12:00:00.000Z');
    const deletedAt = '2026-08-05T12:00:00.000Z';
    expect(daysUntilPurge(deletedAt, now)).toBe(0);
  });
});

describe('expiryLevel', () => {
  test('returns poor at the upper boundary of the poor range (3)', () => {
    expect(expiryLevel(3)).toBe('poor');
  });

  test('returns low just above the poor boundary (4)', () => {
    expect(expiryLevel(4)).toBe('low');
  });

  test('returns low at the upper boundary of the low range (7)', () => {
    expect(expiryLevel(7)).toBe('low');
  });

  test('returns mid just above the low boundary (8)', () => {
    expect(expiryLevel(8)).toBe('mid');
  });
});
