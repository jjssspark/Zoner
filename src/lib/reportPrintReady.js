// PDF는 화면을 그대로 인쇄한다. 조언·성향 섹션은 데이터가 도착하기 전에는
// 아예 렌더링되지 않으므로, 로딩 중에 인쇄하면 그 섹션이 통째로 빠진 PDF가
// 나온다. 종이만 보는 사람은 원래 없는 항목인지 덜 불러온 건지 구분할 수 없다.
//
// adviceStatus가 'failed'면 준비된 것으로 친다. 조언은 리포트의 곁가지고,
// 실패는 되돌아오지 않는 종착 상태다. 이걸 기다리면 버튼이 영영 안 풀린다.
const SETTLED_ADVICE_STATUS = ['ready', 'failed'];

export function isReportPrintReady({ hasRecentSessions, adviceStatus }) {
  return (
    Boolean(hasRecentSessions) && SETTLED_ADVICE_STATUS.includes(adviceStatus)
  );
}

export default isReportPrintReady;
