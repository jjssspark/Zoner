import supabase from './supabaseClient';

export const PURGE_AFTER_DAYS = 30;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntilPurge(deletedAtIso, now = new Date()) {
  const elapsedMs = now.getTime() - new Date(deletedAtIso).getTime();
  const elapsedDays = Math.floor(elapsedMs / ONE_DAY_MS);
  return Math.max(0, PURGE_AFTER_DAYS - elapsedDays);
}

export async function purgeExpiredSessions(userId) {
  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * ONE_DAY_MS).toISOString();
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
  const { error } = await supabase
    .from('study_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    throw error;
  }
}
