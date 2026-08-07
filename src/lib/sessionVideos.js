// src/lib/sessionVideos.js
// 학습 영상의 저장 경로와 개수 한도를 다루는 순수 함수들.
// Supabase 클라이언트를 여기서 import 하지 않는다 — 호출부(화면)가 주입한다.

export const SESSION_VIDEO_BUCKET = 'session-videos';

// 무료 티어 1GB 기준. 400kbps로 45분이 약 135MB이므로 3개면 약 400MB다.
export const MAX_STORED_VIDEOS = 3;

// 200MB. 마이그레이션의 버킷 file_size_limit과 반드시 같은 값이어야 한다.
// 45분 학습(약 135MB)에 여유를 둔 값이다.
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

// 첫 세그먼트가 user_id여야 한다. Storage RLS가
// (storage.foldername(name))[1] = auth.uid()::text 로 소유자를 판별한다.
export function buildVideoPath(userId, sessionId) {
  return `${userId}/${sessionId}.webm`;
}

export function isVideoLimitReached(count) {
  return Number(count) >= MAX_STORED_VIDEOS;
}

// 버킷이 거절할 크기를 올려보기 전에 미리 걸러낸다. 45분을 공부한 사람이
// 업로드 왕복까지 기다린 끝에 실패를 듣는 일을 막는 것이 목적이다.
// 크기를 알 수 없으면(NaN) 막지 않는다 — 판단 불가를 실패로 만들지 않는다.
export function isVideoTooLarge(sizeBytes) {
  return Number(sizeBytes) > MAX_VIDEO_BYTES;
}

// 휴지통에 있는 세션도 용량은 실제로 차지하므로 후보에 포함한다.
// 호출부가 study_sessions 테이블(뷰가 아니라)에서 조회해 넘긴다.
export function pickOldestVideoSession(sessions) {
  if (!Array.isArray(sessions)) return null;

  const withVideo = sessions.filter((session) => session && session.video_path);
  if (withVideo.length === 0) return null;

  return withVideo.reduce((oldest, session) =>
    new Date(session.started_at).getTime() < new Date(oldest.started_at).getTime()
      ? session
      : oldest
  );
}
