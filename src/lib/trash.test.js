import { daysUntilPurge, PURGE_AFTER_DAYS } from './trash';

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
