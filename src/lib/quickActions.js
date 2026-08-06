import { focusLevel } from '../components/ui/ScoreRing';

const EMPTY_SCORE_TEXT = '첫 세션을 시작하세요';
const EMPTY_RECORDS_TEXT = '아직 기록이 없습니다';
// count 쿼리가 실패하면 "총 null세션"이 아니라 중립 문구로 떨어진다.
const UNKNOWN_RECORDS_TEXT = '기록 전체 보기';

export function buildQuickActionMeta(recentSessions, totalSessions) {
  const latest = Array.isArray(recentSessions) ? recentSessions[0] : undefined;
  const score =
    latest && typeof latest.focus_score === 'number'
      ? Math.round(latest.focus_score)
      : null;

  let recordsText;
  if (typeof totalSessions !== 'number') {
    recordsText = UNKNOWN_RECORDS_TEXT;
  } else if (totalSessions === 0) {
    recordsText = EMPTY_RECORDS_TEXT;
  } else {
    recordsText = `총 ${totalSessions}세션`;
  }

  return {
    startLearning:
      score === null
        ? { text: EMPTY_SCORE_TEXT, level: null }
        : { text: `마지막 세션 ${score}%`, level: focusLevel(score) },
    records: { text: recordsText, level: null },
  };
}
