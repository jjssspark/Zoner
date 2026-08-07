import supabase from './supabaseClient';
import { SESSION_VIDEO_BUCKET } from './sessionVideos';

export const PURGE_AFTER_DAYS = 30;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 행을 지우기 전에 Storage 파일을 지운다. 행이 사라지면 어떤 파일이 이 사용자
// 것이었는지 알 방법이 없어 얼굴이 담긴 영상이 앱에서 지울 수 없는 채로 남고,
// video_path가 있는 행으로 세는 개수 한도에서도 빠져 무한정 쌓인다.
//
// 다만 Storage 실패로 행 삭제를 막지는 않는다. 사용자가 요청한 것은 기록의
// 삭제이고, 그것이 안 되는 쪽이 파일 하나가 고아로 남는 것보다 나쁘다.
async function removeVideosIgnoringFailure(paths) {
  const targets = paths.filter(Boolean);
  if (targets.length === 0) return;

  try {
    const { error } = await supabase.storage
      .from(SESSION_VIDEO_BUCKET)
      .remove(targets);
    if (error) {
      console.error('trash: failed to remove session videos', error);
    }
  } catch (error) {
    console.error('trash: failed to remove session videos', error);
  }
}

export function daysUntilPurge(deletedAtIso, now = new Date()) {
  const elapsedMs = now.getTime() - new Date(deletedAtIso).getTime();
  const elapsedDays = Math.floor(elapsedMs / ONE_DAY_MS);
  return Math.max(0, PURGE_AFTER_DAYS - elapsedDays);
}

export const expiryLevel = (daysLeft) => {
  if (daysLeft <= 3) return 'poor';
  if (daysLeft <= 7) return 'low';
  return 'mid';
};

export async function purgeExpiredSessions(userId) {
  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * ONE_DAY_MS).toISOString();

  // 삭제 대상과 같은 조건으로 먼저 경로를 모은다. 조회가 실패하면 data가
  // null이지만, 그렇다고 만료 정리 자체를 멈추지는 않는다.
  const { data: expiring } = await supabase
    .from('study_sessions')
    .select('video_path')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
    .not('video_path', 'is', null);

  await removeVideosIgnoringFailure((expiring ?? []).map((row) => row.video_path));

  const { error } = await supabase
    .from('study_sessions')
    .delete()
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff);

  if (error) {
    throw error;
  }
}

export async function softDeleteSession(sessionId) {
  const { error } = await supabase
    .from('study_sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    throw error;
  }
}

export async function restoreSession(sessionId) {
  const { error } = await supabase
    .from('study_sessions')
    .update({ deleted_at: null })
    .eq('id', sessionId);

  if (error) {
    throw error;
  }
}

export async function hardDeleteSession(sessionId) {
  const { data: session } = await supabase
    .from('study_sessions')
    .select('video_path')
    .eq('id', sessionId)
    .single();

  await removeVideosIgnoringFailure([session?.video_path]);

  const { error } = await supabase
    .from('study_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    throw error;
  }
}
