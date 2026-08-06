import {
  SESSION_VIDEO_BUCKET,
  MAX_STORED_VIDEOS,
  buildVideoPath,
  isVideoLimitReached,
  pickOldestVideoSession,
} from './sessionVideos';

describe('buildVideoPath', () => {
  test('user_id를 첫 세그먼트로 두고 session_id.webm을 붙인다', () => {
    expect(buildVideoPath('user-1', 'session-9')).toBe('user-1/session-9.webm');
  });

  test('Storage RLS가 첫 세그먼트로 소유자를 판별하므로 경로가 두 단계다', () => {
    expect(buildVideoPath('user-1', 'session-9').split('/')).toHaveLength(2);
  });
});

describe('isVideoLimitReached', () => {
  test('한도보다 적으면 false', () => {
    expect(isVideoLimitReached(MAX_STORED_VIDEOS - 1)).toBe(false);
  });

  test('한도와 같으면 true', () => {
    expect(isVideoLimitReached(MAX_STORED_VIDEOS)).toBe(true);
  });

  test('한도를 넘으면 true', () => {
    expect(isVideoLimitReached(MAX_STORED_VIDEOS + 1)).toBe(true);
  });

  test('0이면 false', () => {
    expect(isVideoLimitReached(0)).toBe(false);
  });
});

describe('pickOldestVideoSession', () => {
  const sessions = [
    { id: 'b', started_at: '2026-08-05T10:00:00.000Z', video_path: 'u/b.webm' },
    { id: 'a', started_at: '2026-08-03T09:00:00.000Z', video_path: 'u/a.webm' },
    { id: 'c', started_at: '2026-08-06T11:00:00.000Z', video_path: 'u/c.webm' },
  ];

  test('started_at이 가장 이른 세션을 고른다', () => {
    expect(pickOldestVideoSession(sessions).id).toBe('a');
  });

  test('영상이 없는 세션은 후보에서 뺀다', () => {
    const mixed = [
      { id: 'no-video', started_at: '2026-08-01T00:00:00.000Z', video_path: null },
      { id: 'has-video', started_at: '2026-08-04T00:00:00.000Z', video_path: 'u/x.webm' },
    ];
    expect(pickOldestVideoSession(mixed).id).toBe('has-video');
  });

  test('영상 있는 세션이 하나도 없으면 null', () => {
    expect(
      pickOldestVideoSession([
        { id: 'x', started_at: '2026-08-01T00:00:00.000Z', video_path: null },
      ])
    ).toBeNull();
  });

  test('빈 배열이면 null', () => {
    expect(pickOldestVideoSession([])).toBeNull();
  });

  test('배열이 아니면 null — 조회 실패를 크래시로 만들지 않는다', () => {
    expect(pickOldestVideoSession(null)).toBeNull();
    expect(pickOldestVideoSession(undefined)).toBeNull();
  });
});

describe('상수', () => {
  test('버킷 이름이 마이그레이션과 같다', () => {
    expect(SESSION_VIDEO_BUCKET).toBe('session-videos');
  });

  test('한도는 3개다', () => {
    expect(MAX_STORED_VIDEOS).toBe(3);
  });
});
