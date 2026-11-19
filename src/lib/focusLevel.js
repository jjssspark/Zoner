// 집중도 점수(0~100)를 밴드로 나눈다. tokens.css의 --color-focus-* 와 1:1이다.
//
// ScoreRing.js 안에 있던 것을 옮겼다. lib/quickActions.js가 이 함수 하나 때문에
// 컴포넌트를 import 하고 있었는데, lib은 아무것도 모르는 안쪽 계층이어야 한다.
export function focusLevel(value) {
  if (value >= 80) return 'high';
  if (value >= 50) return 'mid';
  if (value >= 30) return 'low';
  return 'poor';
}
