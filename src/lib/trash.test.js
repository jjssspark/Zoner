import {
  daysUntilPurge,
  expiryLevel,
  hardDeleteSession,
  purgeExpiredSessions,
  PURGE_AFTER_DAYS,
} from './trash';
import supabase from './supabaseClient';
import { SESSION_VIDEO_BUCKET } from './sessionVideos';

jest.mock('./supabaseClient', () => ({
  __esModule: true,
  default: {
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

// PostgREST 빌더는 모든 메서드가 자기 자신을 돌려주고, 마지막에 await 되면
// 결과로 resolve 된다. thenable 하나로 그 모양을 흉내낸다.
const makeQuery = (result = { data: null, error: null }) => {
  const query = {};
  ['select', 'delete', 'update', 'eq', 'not', 'lt', 'single'].forEach((name) => {
    query[name] = jest.fn(() => query);
  });
  query.then = (onFulfilled, onRejected) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return query;
};

// Storage 실패는 console.error로 남기고 삼키는 것이 의도된 동작이다.
// 그 경로를 검증하는 테스트에서 출력만 가린다.
const silenceStorageLog = () =>
  jest.spyOn(console, 'error').mockImplementation(() => {});

const mockStorage = (result = { data: null, error: null }) => {
  const bucket = { remove: jest.fn().mockResolvedValue(result) };
  supabase.storage.from.mockReturnValue(bucket);
  return bucket;
};

beforeEach(() => {
  jest.clearAllMocks();
});

// console 스파이가 다음 테스트로 새어나가면 진짜 오류가 가려진다.
afterEach(() => {
  jest.restoreAllMocks();
});

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

describe('hardDeleteSession', () => {
  test('행을 지우기 전에 Storage 영상을 먼저 지운다', async () => {
    const selectQuery = makeQuery({ data: { video_path: 'u1/s1.webm' }, error: null });
    const deleteQuery = makeQuery({ error: null });
    supabase.from.mockReturnValueOnce(selectQuery).mockReturnValueOnce(deleteQuery);
    const bucket = mockStorage();

    await hardDeleteSession('s1');

    expect(supabase.storage.from).toHaveBeenCalledWith(SESSION_VIDEO_BUCKET);
    expect(bucket.remove).toHaveBeenCalledWith(['u1/s1.webm']);
    expect(deleteQuery.delete).toHaveBeenCalled();
    expect(bucket.remove.mock.invocationCallOrder[0]).toBeLessThan(
      deleteQuery.delete.mock.invocationCallOrder[0]
    );
  });

  test('영상이 없는 세션은 Storage를 건드리지 않는다', async () => {
    const selectQuery = makeQuery({ data: { video_path: null }, error: null });
    const deleteQuery = makeQuery({ error: null });
    supabase.from.mockReturnValueOnce(selectQuery).mockReturnValueOnce(deleteQuery);
    const bucket = mockStorage();

    await hardDeleteSession('s1');

    expect(bucket.remove).not.toHaveBeenCalled();
    expect(deleteQuery.delete).toHaveBeenCalled();
  });

  test('Storage 삭제가 실패해도 행 삭제는 진행한다', async () => {
    const selectQuery = makeQuery({ data: { video_path: 'u1/s1.webm' }, error: null });
    const deleteQuery = makeQuery({ error: null });
    supabase.from.mockReturnValueOnce(selectQuery).mockReturnValueOnce(deleteQuery);
    mockStorage({ data: null, error: { message: 'storage down' } });
    silenceStorageLog();

    await expect(hardDeleteSession('s1')).resolves.toBeUndefined();
    expect(deleteQuery.delete).toHaveBeenCalled();
  });

  test('Storage 삭제가 예외를 던져도 행 삭제는 진행한다', async () => {
    const selectQuery = makeQuery({ data: { video_path: 'u1/s1.webm' }, error: null });
    const deleteQuery = makeQuery({ error: null });
    supabase.from.mockReturnValueOnce(selectQuery).mockReturnValueOnce(deleteQuery);
    supabase.storage.from.mockReturnValue({
      remove: jest.fn().mockRejectedValue(new Error('network')),
    });
    silenceStorageLog();

    await expect(hardDeleteSession('s1')).resolves.toBeUndefined();
    expect(deleteQuery.delete).toHaveBeenCalled();
  });

  test('행 삭제 실패는 그대로 던진다', async () => {
    const selectQuery = makeQuery({ data: { video_path: null }, error: null });
    const deleteQuery = makeQuery({ error: { message: 'rls' } });
    supabase.from.mockReturnValueOnce(selectQuery).mockReturnValueOnce(deleteQuery);
    mockStorage();

    await expect(hardDeleteSession('s1')).rejects.toEqual({ message: 'rls' });
  });
});

describe('purgeExpiredSessions', () => {
  test('만료 대상의 영상을 한 번에 모아 지운다', async () => {
    const selectQuery = makeQuery({
      data: [{ video_path: 'u1/a.webm' }, { video_path: 'u1/b.webm' }],
      error: null,
    });
    const deleteQuery = makeQuery({ error: null });
    supabase.from.mockReturnValueOnce(selectQuery).mockReturnValueOnce(deleteQuery);
    const bucket = mockStorage();

    await purgeExpiredSessions('u1');

    expect(bucket.remove).toHaveBeenCalledTimes(1);
    expect(bucket.remove).toHaveBeenCalledWith(['u1/a.webm', 'u1/b.webm']);
    expect(bucket.remove.mock.invocationCallOrder[0]).toBeLessThan(
      deleteQuery.delete.mock.invocationCallOrder[0]
    );

    // makeQuery의 체이너블 mock은 무엇을 넘겨도 자기 자신을 돌려주므로, select의
    // 조건이 통째로 빠져도 위 remove 인자·순서 검증은 그대로 통과한다. 만료되지
    // 않은 세션의 영상까지 지우는 회귀를 잡으려면 select에 실제로 어떤 조건이
    // 걸렸는지를 고정해야 한다. delete와 동일한 조건이어야 한다.
    expect(selectQuery.select).toHaveBeenCalledWith('video_path');
    expect(selectQuery.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(selectQuery.not).toHaveBeenCalledWith('deleted_at', 'is', null);
    expect(selectQuery.not).toHaveBeenCalledWith('video_path', 'is', null);
    expect(selectQuery.lt).toHaveBeenCalledWith('deleted_at', expect.any(String));

    // select와 delete가 같은 cutoff를 쓰는지도 고정한다 — 둘이 어긋나면
    // 영상이 지워지는 대상과 행이 지워지는 대상이 갈린다.
    const selectCutoff = selectQuery.lt.mock.calls[0][1];
    const deleteCutoff = deleteQuery.lt.mock.calls[0][1];
    expect(selectCutoff).toBe(deleteCutoff);
  });

  test('만료 대상에 영상이 없으면 Storage를 건드리지 않는다', async () => {
    const selectQuery = makeQuery({ data: [], error: null });
    const deleteQuery = makeQuery({ error: null });
    supabase.from.mockReturnValueOnce(selectQuery).mockReturnValueOnce(deleteQuery);
    const bucket = mockStorage();

    await purgeExpiredSessions('u1');

    expect(bucket.remove).not.toHaveBeenCalled();
    expect(deleteQuery.delete).toHaveBeenCalled();
  });

  test('Storage 삭제가 실패해도 행 삭제는 진행한다', async () => {
    const selectQuery = makeQuery({ data: [{ video_path: 'u1/a.webm' }], error: null });
    const deleteQuery = makeQuery({ error: null });
    supabase.from.mockReturnValueOnce(selectQuery).mockReturnValueOnce(deleteQuery);
    mockStorage({ data: null, error: { message: 'storage down' } });
    silenceStorageLog();

    await expect(purgeExpiredSessions('u1')).resolves.toBeUndefined();
    expect(deleteQuery.delete).toHaveBeenCalled();
  });

  test('조회가 실패해 data가 null이어도 행 삭제는 진행한다', async () => {
    const selectQuery = makeQuery({ data: null, error: { message: 'boom' } });
    const deleteQuery = makeQuery({ error: null });
    supabase.from.mockReturnValueOnce(selectQuery).mockReturnValueOnce(deleteQuery);
    const bucket = mockStorage();

    await expect(purgeExpiredSessions('u1')).resolves.toBeUndefined();
    expect(bucket.remove).not.toHaveBeenCalled();
    expect(deleteQuery.delete).toHaveBeenCalled();
  });

  test('행 삭제 실패는 그대로 던진다', async () => {
    const selectQuery = makeQuery({ data: [], error: null });
    const deleteQuery = makeQuery({ error: { message: 'rls' } });
    supabase.from.mockReturnValueOnce(selectQuery).mockReturnValueOnce(deleteQuery);
    mockStorage();

    await expect(purgeExpiredSessions('u1')).rejects.toEqual({ message: 'rls' });
  });
});
