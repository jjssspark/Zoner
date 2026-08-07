// 수치가 0에서 목표값까지 올라가는 연출에 쓰는 순수 계산.
// 화면 파일은 Jest로 돌릴 수 없으므로(TS-003) 계산만 여기로 뺀다.

/**
 * ScoreRing의 링은 CSS --ease-in-out(cubic-bezier(0.65, 0, 0.35, 1))으로
 * 채워진다. 숫자가 링과 따로 놀지 않으려면 같은 곡선을 써야 하는데,
 * easeInOutCubic이 그 베지어와 육안으로 구분되지 않는 근사라 이것을 쓴다.
 * 베지어 solver를 넣을 만큼의 차이가 아니다.
 *
 * @param {number} t 0~1
 * @returns {number} 0~1
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 카운트업 도중 특정 시점에 표시할 값.
 *
 * @param {number} target 최종값
 * @param {number} elapsedMs 시작 후 경과
 * @param {number} durationMs 전체 길이
 * @returns {number} 반올림된 표시값
 */
export function countUpFrame(target, elapsedMs, durationMs) {
  if (durationMs <= 0 || elapsedMs >= durationMs) {
    return target;
  }
  if (elapsedMs <= 0) {
    return 0;
  }
  return Math.round(target * easeInOutCubic(elapsedMs / durationMs));
}
