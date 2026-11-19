// 브라우저 인쇄 대화상자는 document.title을 PDF 기본 파일명으로 쓴다.
// 저장 직전에 제목을 이걸로 바꿨다가 되돌린다.
//
// 날짜는 로컬 타임존 기준이다. UTC로 맞추면 밤늦게 공부한 세션이 다음 날로
// 찍혀서, 사용자가 기억하는 날짜와 파일명이 어긋난다.
const FALLBACK = 'zoner-report';

export function buildReportTitle(startedAt) {
  const date = new Date(startedAt);
  if (!startedAt || Number.isNaN(date.getTime())) {
    return FALLBACK;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${FALLBACK}-${year}-${month}-${day}`;
}

export default buildReportTitle;
