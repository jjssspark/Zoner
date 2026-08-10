# Zoner 계측기 HUD 재설계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 다크 네이비 + 시안 + 균일 라운드 조합을 슬레이트 + 얼음빛 블루 + 노치 형태로 바꿔, 화면이 "흔한 AI 대시보드 템플릿"이 아니라 계측 장비로 읽히게 한다.

**Architecture:** 2계층 토큰(원시 → 의미) 구조는 그대로 두고 값만 교체한다. HUD 레이어(계측 격자·대각 브래킷·주 수치 글로우)는 신규 컴포넌트가 아니라 `tokens.css`의 전역 유틸리티 클래스와 커스텀 프로퍼티로 구현한다. 인쇄에서는 `@media print`가 토큰 자체를 무력화해 HUD가 한 번에 벗겨진다.

**Tech Stack:** CRA 5 (react-scripts) / React 19 / 순수 CSS 커스텀 프로퍼티 / Jest + @testing-library. 신규 의존성 없음.

## 스펙과 달라진 점 (검토 필요)

스펙 `docs/superpowers/specs/2026-08-10-zoner-hud-instrument-redesign-design.md`는
`HudPanel` · `Gauge` · `SegmentMeter` 세 컴포넌트를 신설하기로 했다. **이 계획은
셋 다 만들지 않는다.** 이유:

1. **`HudPanel`이 풀려던 문제가 더 싸게 풀린다.** 스펙의 함정 항목대로 `clip-path`는
   `:focus-visible` outline뿐 아니라 **바깥 box-shadow와 음수 위치 의사요소까지 자른다.**
   `HudPanel`은 래퍼를 하나 더 두어 이걸 피하려던 장치인데, 브래킷을 `-1px`가 아니라
   `0`에 두면(노치는 반대 대각선을 자르므로 그 두 모서리는 멀쩡하다) 래퍼 없이 해결된다.
   포커스는 outline 대신 `inset box-shadow`로 안쪽에 그린다. 결과적으로 JSX 구조를
   건드리지 않고 CSS 유틸리티 두 개(`--notch-path`, `.hud-brackets`)로 끝난다.
2. **`Gauge` · `SegmentMeter`는 소비처가 없다.** `Gauge`가 하려던 눈금은 StartLearning의
   기존 `__focus-track` 마크업에 `repeating-linear-gradient` 한 줄로 붙는다.
   `SegmentMeter`는 목업에서 장식으로 쓴 것이라, 스펙 자신의 절제 규칙 4번
   ("실제로 측정 중일 때만, 장식으로 쓰지 않는다")과 충돌한다.

3. **스윕 라인(HUD 레이어 목록의 마지막 항목)도 넣지 않는다.** 스펙의 절제 규칙 5번이
   "실시간 데이터 위에만"으로 못박았는데, 이 앱의 실시간 표시는 StartLearning의
   집중도 게이지 하나뿐이고 그건 **시계열이 아니라 순간값**이다. 순간값 게이지 위를
   지나가는 선은 데이터를 나타내지 않는 순수 장식이라 규칙 자체와 충돌한다.

4. **영문 라벨 uppercase 규칙은 새로 적용할 대상이 없다.** 현재 `text-transform: uppercase`는
   Mypage · Pricing · Home · FAQ · UserGuide 다섯 곳에 이미 있고 전부 한글 라벨이라
   실질적으로 무효다(한글에는 대소문자가 없다). 스펙의 이 항목은 **앞으로 영문 라벨을
   추가할 때 지킬 규칙**으로 남기고, 기존 다섯 줄은 이번 변경과 무관하므로 건드리지
   않는다. `--tracking-wide` 토큰도 소비처가 생길 때 추가한다.

컴포넌트 세 개를 그대로 만들길 원하시면 Task 3을 컴포넌트 방식으로 다시 쓰겠습니다.

## Global Constraints

이 절은 모든 태스크의 요구사항에 암묵적으로 포함된다.

- **다크 단일 테마.** 라이트 테마를 추가하지 않는다. `@media print` 블록은 인쇄 매체
  전용이며 테마 추가가 아니다 (기존 `SessionReport.css:449` 주석의 근거와 동일).
- **신규 의존성 금지.** 노치는 `clip-path`, 격자는 `linear-gradient`로만 해결한다.
- **의존 방향은 안쪽으로만**: `features/` → `components/` → `lib/`. `features/A`가
  `features/B`를 직접 import 하지 않는다.
- **`react-router-dom`을 import 하는 파일에 Jest 테스트를 작성하지 않는다** (TS-003).
- **커밋 전 사용자 확인을 받는다.** 각 태스크의 커밋 스텝은 사용자 승인 후 실행한다.
- **대비 기준**: 본문 4.5:1, 큰 텍스트 3:1, 컨트롤 경계 3:1(WCAG 1.4.11). 근거 수치를
  `tokens.css` 주석에 남긴다.
- 기존 테스트가 모두 통과해야 다음 태스크로 넘어간다: `CI=true npx react-scripts test`

## 대비 계산 근거

아래 수치는 oklch → 선형 sRGB → WCAG 상대휘도 → 대비비로 계산했다. 같은 계산기가
기존 `tokens.css:32-35` 주석의 값(navy-500/navy-900 = 3.97, navy-500/navy-800 = 3.54,
navy-550/navy-900 = 2.83, navy-550/navy-800 = 2.52)을 소수점 둘째 자리까지 재현했으므로
기존 문서와 같은 방법론이다.

| 전경 | slate-950 (bg) | slate-900 (surface) | slate-850 (surface-alt) |
|---|---|---|---|
| slate-50 | 18.44 | 17.52 | 16.23 |
| slate-400 | 7.00 | 6.65 | 6.16 |
| slate-500 | 4.33 | 4.12 | 3.81 |
| ice-500 | 8.15 | 7.74 | 7.17 |
| ice-400 | 9.42 | 8.95 | 8.29 |
| lime-400 | 11.38 | 10.81 | 10.02 |
| amber-400 | 10.62 | 10.09 | 9.34 |
| red-500 | 5.88 | 5.59 | 5.18 |
| cyan-400 | 9.70 | 9.22 | 8.54 |

- `slate-950` on `ice-500` (--color-on-accent) = **8.15**
- 인쇄(흰 배경): `ice-700` = **5.51**, `slate-600` = **9.57**, `slate-950` = **20.10**

스펙이 "재계산 후 확정"으로 남겨둔 `--color-border-strong`은 **`slate-500`으로 확정**한다.
surface 위 4.12:1, surface-alt 위 3.81:1로 둘 다 3:1을 넘는다.

---

### Task 1: 토큰 정합성 가드 테스트

토큰 이름을 바꾸는 작업의 가장 큰 위험은 **소비처를 놓치는 것**이다. `var(--navy-950)`이
정의되지 않으면 CSS는 오류를 내지 않고 선언 전체를 버린다. 색이 사라진 자리는 부모 색이나
기본값으로 조용히 그려져서 눈으로 잡기 어렵다. Task 2를 시작하기 전에 이걸 잡는 그물을
먼저 친다.

**Files:**
- Create: `src/styles/tokens.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (테스트 전용). Task 2가 이 테스트를 RED → GREEN으로 통과시킨다.

- [ ] **Step 1: 가드 테스트를 작성한다**

`src/styles/tokens.test.js`:

```js
// tokens.css가 정의하지 않은 CSS 변수를 화면이 참조하면 브라우저는 오류 없이
// 그 선언을 통째로 버린다. 색이 빠진 자리는 부모 색으로 조용히 그려져서
// 눈으로 잡기 어렵다. 토큰 이름을 바꿀 때 소비처를 놓치는 것을 막는 가드다.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const read = (file) => fs.readFileSync(file, 'utf8');

const files = walk(SRC);
const cssFiles = files.filter((f) => f.endsWith('.css'));
const jsFiles = files.filter((f) => f.endsWith('.js'));

// 정의 경로는 셋이다: CSS 선언, JS 인라인 스타일 객체, setProperty 호출.
// useRevealOnScroll이 --reveal-index를 setProperty로만 넣으므로 셋 다 봐야 한다.
const defined = new Set();
for (const file of cssFiles) {
  for (const m of read(file).matchAll(/(--[\w-]+)\s*:/g)) {
    defined.add(m[1]);
  }
}
for (const file of jsFiles) {
  const src = read(file);
  for (const m of src.matchAll(/['"](--[\w-]+)['"]\s*:/g)) {
    defined.add(m[1]);
  }
  for (const m of src.matchAll(/setProperty\(\s*['"](--[\w-]+)['"]/g)) {
    defined.add(m[1]);
  }
}

describe('CSS 커스텀 프로퍼티', () => {
  test('CSS가 참조하는 토큰이 모두 어딘가에 정의돼 있다', () => {
    const dangling = [];
    for (const file of cssFiles) {
      for (const m of read(file).matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (!defined.has(m[1])) {
          dangling.push(`${path.relative(SRC, file)} → ${m[1]}`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트를 실행해 현재 코드에서 통과하는지 확인한다**

Run: `CI=true npx react-scripts test --testPathPattern=tokens`
Expected: PASS (1 test). 지금 코드에는 끊긴 참조가 없다 — 그물이 제대로 걸렸는지
확인하는 것이 목적이다.

- [ ] **Step 3: 그물이 실제로 잡는지 검증한다 (일부러 깨뜨렸다 되돌린다)**

`src/styles/tokens.css:3`의 `--navy-950:`을 `--navyy-950:`으로 잠깐 바꾼다.

Run: `CI=true npx react-scripts test --testPathPattern=tokens`
Expected: FAIL. 실패 메시지에 `styles/tokens.css → --navy-950`,
`features/auth/Login.css → --navy-950` 등이 나열되어야 한다.

확인 후 `--navy-950:`으로 되돌리고 다시 실행해 PASS를 확인한다.

- [ ] **Step 4: 커밋 (사용자 확인 후)**

```bash
git add src/styles/tokens.test.js
git commit -m "test: CSS 토큰 참조 정합성 가드"
```

---

### Task 2: tokens.css 재설계와 소비처 갱신

**Files:**
- Modify: `src/styles/tokens.css:1-110` (`:root` 블록 전체)
- Modify: `src/features/records/SessionReport.css:457-462`
- Modify: `src/features/auth/Login.css:68`
- Modify: `src/features/auth/SignUp.css:102`
- Modify: `src/features/marketing/Home.css:45`
- Test: `src/styles/tokens.test.js` (Task 1에서 생성됨)

**Interfaces:**
- Consumes: Task 1의 가드 테스트
- Produces: 이후 모든 태스크가 쓰는 토큰 —
  `--slate-950|900|850|800|700|600|500|400|200|50`,
  `--ice-300|400|500|700`, `--color-grid`, `--notch`, `--notch-sm`,
  `--notch-path`, `--notch-path-sm`, `--glow-metric`.
  기존 `--color-*` 의미 토큰 이름은 **하나도 바뀌지 않는다** — 값만 바뀐다.

- [ ] **Step 1: 테스트를 RED로 만든다 — 원시 토큰을 교체한다**

`src/styles/tokens.css`의 1~26행(`/* primitive - neutrals */`부터
`--orange-500` 줄까지)을 아래로 통째로 바꾼다.

```css
:root {
  /* primitive - neutrals (slate scale, hue 235)
     기존 navy(hue 260)에서 옮겼다. 배경 채도를 낮춰야 신호색이 산다. */
  --slate-950: oklch(13% 0.012 235);
  --slate-900: oklch(17% 0.012 235);
  --slate-850: oklch(21% 0.012 235);
  --slate-800: oklch(25% 0.012 235);
  --slate-700: oklch(31% 0.012 235);
  --slate-600: oklch(39% 0.013 235);
  --slate-500: oklch(56% 0.014 235);
  --slate-400: oklch(68% 0.014 235);
  --slate-200: oklch(86% 0.008 235);
  --slate-50: oklch(97% 0.004 235);

  /* primitive - signal (ice blue, hue 250)
     시안(200)에서 250으로 옮긴 이유는 집중도 밴드 "보통"과 색이 겹쳤기 때문이다.
     화면의 파란색이 상태 표시인지 UI 장식인지 구분되지 않았다. */
  --ice-300: oklch(84% 0.09 250);
  --ice-400: oklch(76% 0.12 250);
  --ice-500: oklch(72% 0.13 250);
  /* 흰 배경 위에서만 쓴다(인쇄). 화면용 ice-500(72%)은 종이에서 거의 안 보인다.
     흰 배경 위 5.51:1. */
  --ice-700: oklch(52% 0.14 250);

  /* primitive - status */
  --red-500: oklch(66% 0.2 25);
  --lime-400: oklch(80% 0.16 145);
  --amber-400: oklch(80% 0.14 80);
  --orange-500: oklch(70% 0.17 50);
  /* 시안은 이제 강조색이 아니다. 집중도 밴드 "보통"과 판정 원인 표시 전용이다. */
  --cyan-400: oklch(75% 0.14 200);
  --cyan-500: oklch(68% 0.15 200);
```

- [ ] **Step 2: 테스트를 실행해 RED를 확인한다**

Run: `CI=true npx react-scripts test --testPathPattern=tokens`
Expected: FAIL. 끊긴 참조 9건이 나열된다 —
`styles/tokens.css → --navy-950`(외 다수), `features/auth/Login.css → --navy-950`,
`features/auth/SignUp.css → --navy-950`, `features/marketing/Home.css → --navy-950`,
`features/records/SessionReport.css → --navy-50 / --navy-200 / --navy-600 / --cyan-700`.

- [ ] **Step 3: 의미 토큰을 새 원시 토큰에 다시 매핑한다**

`src/styles/tokens.css`의 `/* semantic */`부터 `--color-reason-absent` 줄까지를
아래로 바꾼다.

```css
  /* semantic */
  --color-bg: var(--slate-950);
  --color-surface: var(--slate-900);
  --color-surface-alt: var(--slate-850);
  --color-border: var(--slate-700);
  /* 인터랙티브 요소의 테두리. 이 테두리만으로 컨트롤이 식별되므로
     WCAG 1.4.11(비텍스트 대비 3:1)을 만족해야 한다.
     slate-500(56%)은 surface 위 4.12:1 / surface-alt 위 3.81:1. */
  --color-border-strong: var(--slate-500);
  --color-text: var(--slate-50); /* surface 위 17.52:1 */
  --color-text-muted: var(--slate-400); /* surface-alt 위 6.16:1 */
  --color-accent: var(--ice-500); /* surface 위 7.74:1 */
  --color-accent-hover: var(--ice-400);
  /* 강조색을 배경으로 깔았을 때 그 위에 얹는 글자색. ice-500 위 8.15:1 */
  --color-on-accent: var(--slate-950);
  --color-danger: var(--red-500);
  /* 계측 격자선. 정보를 담지 않는 배경 질감이라 대비 기준 대상이 아니다.
     불투명도를 올리면 본문 대비를 깎으므로 0.024를 넘기지 않는다. */
  --color-grid: oklch(97% 0.004 235 / 0.024);

  /* semantic - focus level (score band) */
  --color-focus-high: var(--lime-400); /* 80% 이상 */
  --color-focus-mid: var(--cyan-400); /* 50~79% */
  --color-focus-low: var(--amber-400); /* 30~49% */
  --color-focus-poor: var(--red-500); /* 30% 미만 */

  /* semantic - tick reason (focusTracker REASON 값과 1:1) */
  --color-reason-focused: var(--cyan-400);
  --color-reason-looking-down: var(--cyan-500);
  --color-reason-head-turned: var(--amber-400);
  --color-reason-looking-up: var(--orange-500);
  --color-reason-eyes-closed: var(--red-500);
  /* 자리 비움은 무채색 점이다. slate-500은 surface 위 4.12:1로
     기존 navy-550(2.83:1)보다 비텍스트 3:1 기준에 여유가 있다. */
  --color-reason-absent: var(--slate-500);
```

- [ ] **Step 4: 형태 토큰을 추가한다**

`src/styles/tokens.css`의 `/* radius / shadow */` 블록을 아래로 바꾼다.

```css
  /* radius / shadow / notch
     균일 라운드가 "뻔함"의 가장 큰 원인이었다. 요소 종류마다 형태를 나눈다 —
     패널은 노치, 버튼·입력·칩은 radius-sm, 링·아바타·상태점은 radius-full.
     radius-md / radius-lg 는 이제 패널에 쓰지 않는다. */
  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1.25rem;
  --radius-full: 9999px;

  --notch: 14px;
  --notch-sm: 8px;
  /* 우상·좌하 모서리를 자른다. 브래킷이 붙는 좌상·우하는 직각으로 남겨야
     의사요소가 잘리지 않는다. 인쇄에서는 index.css가 이 값을 none으로 덮는다. */
  --notch-path: polygon(
    0 0,
    calc(100% - var(--notch)) 0,
    100% var(--notch),
    100% 100%,
    var(--notch) 100%,
    0 calc(100% - var(--notch))
  );
  --notch-path-sm: polygon(
    0 0,
    calc(100% - var(--notch-sm)) 0,
    100% var(--notch-sm),
    100% 100%,
    var(--notch-sm) 100%,
    0 calc(100% - var(--notch-sm))
  );

  --shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.3);
  --shadow-md: 0 8px 24px oklch(0% 0 0 / 0.35);
  /* 테두리 글로우다. HUD 절제 규칙 3번이 금지하므로 Task 7에서 소비처 4곳과
     함께 삭제한다. 여기서 먼저 지우면 그 사이 참조가 끊긴다. */
  --shadow-glow: 0 0 40px oklch(72% 0.13 250 / 0.25);
  /* 화면당 주 수치 하나에만 건다. 인쇄 블록이 none으로 덮어 종이에서는 사라진다. */
  --glow-metric: 0 0 18px oklch(72% 0.13 250 / 0.3);
```

- [ ] **Step 5: 소비처 5개 파일 9줄을 갱신한다**

`src/features/records/SessionReport.css:457-462`:

```css
    --color-surface-alt: var(--slate-50);
    --color-border: var(--slate-200);
    --color-border-strong: var(--slate-600); /* 흰 배경 위 9.57:1 */
    --color-text: var(--slate-950); /* 흰 배경 위 20.10:1 */
    --color-text-muted: var(--slate-600);
    --color-accent: var(--ice-700); /* 흰 배경 위 5.51:1 */
```

`src/features/auth/Login.css:68` · `src/features/auth/SignUp.css:102` ·
`src/features/marketing/Home.css:45` — 세 곳 모두 같은 한 줄:

```css
  color: var(--slate-950);
```

- [ ] **Step 6: 테스트를 실행해 GREEN을 확인한다**

Run: `CI=true npx react-scripts test --testPathPattern=tokens`
Expected: PASS (1 test)

- [ ] **Step 7: 남은 참조가 없는지 직접 확인한다**

Run: `grep -rn -E '\-\-(navy|cyan-300|cyan-700)' src`
Expected: 출력 없음 (종료 코드 1)

- [ ] **Step 8: 전체 테스트와 빌드를 확인한다**

Run: `CI=true npx react-scripts test`
Expected: 모든 스위트 PASS

Run: `npx react-scripts build`
Expected: `Compiled successfully.`

- [ ] **Step 9: 커밋 (사용자 확인 후)**

```bash
git add src/styles/tokens.css src/features/records/SessionReport.css \
  src/features/auth/Login.css src/features/auth/SignUp.css \
  src/features/marketing/Home.css
git commit -m "feat: 토큰을 슬레이트+얼음빛 블루로 교체하고 노치 형태 토큰 추가"
```

---

### Task 3: 전역 HUD 레이어와 인쇄 해제

계측 격자·브래킷·글로우를 화면마다 다시 정의하면 반드시 남발된다. 전역에 한 번만
정의하고, 인쇄에서는 토큰 자체를 무력화해 한 줄로 전부 벗긴다.

**Files:**
- Modify: `src/index.css:23-30` (`body`), `src/index.css:65-77` (`@media print`)
- Modify: `src/styles/tokens.css` (파일 끝, `.sr-only` 아래)
- Test: `src/styles/tokens.test.js`

**Interfaces:**
- Consumes: Task 2의 `--color-grid`, `--notch-path`, `--notch-path-sm`, `--glow-metric`
- Produces: 전역 클래스 `.hud-brackets` (대각 2개 브래킷). 이후 태스크는 JSX의
  `className`에 이 이름을 덧붙이기만 한다. 글로우는 클래스를 따로 두지 않고
  `--glow-metric` 토큰을 화면 CSS에서 직접 참조한다 — 인쇄에서는 토큰을 `none`으로
  덮어 한 번에 꺼진다.

- [ ] **Step 1: 격자를 body에 한 번만 깐다**

`src/index.css:23-30`의 `body` 규칙을 아래로 바꾼다.

```css
body {
  margin: 0;
  background-color: var(--color-bg);
  /* 계측 격자. 화면 전체에 여기 한 번만 깐다 — 화면별 CSS에서 다시 깔지 않는다.
     background-image로 넣으면 의사요소를 쓸 때 생기는 쌓임 순서 문제가 없다.
     background-attachment는 기본값(scroll)으로 둔다. fixed는 긴 페이지에서
     스크롤할 때마다 전체를 다시 칠하게 만든다. */
  background-image: linear-gradient(var(--color-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
  background-size: 22px 22px;
  color: var(--color-text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 2: 브래킷 유틸리티를 추가한다**

`src/styles/tokens.css` 파일 맨 끝(`.sr-only` 블록 다음)에 붙인다.

```css
/* ── HUD 레이어 유틸리티 ────────────────────────────────────
   화면당 주 패널 1개에만 .hud-brackets 를 붙인다. 전역에 한 번만 정의해서
   화면마다 다르게 남발되는 것을 막는다. */

.hud-brackets {
  position: relative;
}

/* 좌상·우하에만 건다. 노치가 자르는 우상·좌하를 피한 대각선이다.
   위치를 0으로 두는 것이 중요하다 — 음수로 두면 같은 요소의 clip-path가
   의사요소를 잘라버려 브래킷이 사라진다. */
.hud-brackets::before,
.hud-brackets::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
}

.hud-brackets::before {
  top: 0;
  left: 0;
  border-top: 1px solid var(--color-accent);
  border-left: 1px solid var(--color-accent);
}

.hud-brackets::after {
  bottom: 0;
  right: 0;
  border-bottom: 1px solid var(--color-accent);
  border-right: 1px solid var(--color-accent);
}
```

- [ ] **Step 3: 인쇄에서 HUD를 한 번에 벗긴다**

`src/index.css:65-77`의 인쇄 블록을 아래로 바꾼다.

```css
/* 인쇄에서 종이 자체를 희게 만들고 HUD 레이어를 전부 걷어낸다.
   화면은 다크라 body 배경이 slate-950 이다. 인쇄 대화상자에서 "배경 그래픽"
   을 켜면(리포트의 막대 색을 남기려면 켜야 한다) 이 검은 배경과 계측 격자까지
   같이 찍힌다. SessionReport.css 의 인쇄 블록은 .session-report 안쪽만
   덮으므로 그 바깥인 body 는 여기서 처리해야 한다 (TS-018).

   노치와 글로우는 선택자마다 지우지 않고 토큰 자체를 덮는다 —
   clip-path: var(--notch-path) 가 전부 clip-path: none 으로,
   text-shadow: var(--glow-metric) 이 전부 text-shadow: none 으로 떨어진다. */
@media print {
  :root {
    --notch-path: none;
    --notch-path-sm: none;
    --glow-metric: none;
    --color-grid: transparent;
  }

  html,
  body {
    background-color: white;
    background-image: none;
    color: black;
  }

  .hud-brackets::before,
  .hud-brackets::after {
    display: none;
  }
}
```

- [ ] **Step 4: 인쇄 해제가 실제로 걸리는지 테스트로 못박는다**

`src/styles/tokens.test.js`의 `describe` 블록 안에 아래 테스트를 추가한다.
TS-018에서 인쇄 배경 버그를 이미 겪었고, 그때 검증 하니스에 사각지대가 있었다.

```js
  test('인쇄에서 HUD 레이어가 전부 무력화된다', () => {
    const indexCss = read(path.join(SRC, 'index.css'));
    const printBlock = indexCss.slice(indexCss.indexOf('@media print'));

    // 노치·글로우는 선택자별로 지우지 않고 토큰을 덮어서 한 번에 끈다
    expect(printBlock).toMatch(/--notch-path:\s*none/);
    expect(printBlock).toMatch(/--notch-path-sm:\s*none/);
    expect(printBlock).toMatch(/--glow-metric:\s*none/);
    expect(printBlock).toMatch(/--color-grid:\s*transparent/);
    expect(printBlock).toMatch(/background-image:\s*none/);
    expect(printBlock).toMatch(/\.hud-brackets::before/);
  });
```

- [ ] **Step 5: 테스트를 실행한다**

Run: `CI=true npx react-scripts test --testPathPattern=tokens`
Expected: PASS (2 tests)

- [ ] **Step 6: 화면에서 격자를 눈으로 확인한다**

Run: `npx react-scripts start`
브라우저에서 `/` 를 연다. 배경에 22px 격자가 **거의 안 보일 정도로만** 보여야 한다.
눈에 띄면 `--color-grid`의 알파를 낮춘다 (0.024를 넘기지 않는다).

브라우저 인쇄 미리보기(Cmd+P)에서 배경이 희고 격자가 없어야 한다.

- [ ] **Step 7: 커밋 (사용자 확인 후)**

```bash
git add src/index.css src/styles/tokens.css src/styles/tokens.test.js
git commit -m "feat: 전역 계측 격자와 HUD 유틸리티, 인쇄에서 일괄 해제"
```

---

### Task 4: StartLearning 적용

제품 본체다. 새 시각 언어가 여기서 성립하지 않으면 나머지를 진행할 이유가 없다.

**Files:**
- Modify: `src/features/learning/StartLearning.css` (아래 지정한 규칙들)
- Modify: `src/features/learning/StartLearning.js` (video-wrap의 `className`)
- Test: 없음 — `StartLearning.js`는 `react-router-dom`을 import 하므로 Jest 대상이 아니다 (TS-003). 육안 검증으로 대체한다.

**Interfaces:**
- Consumes: Task 3의 `.hud-brackets`, Task 2의 `--notch-path`, `--notch-path-sm`, `--glow-metric`
- Produces: 없음

- [ ] **Step 1: 영상 패널을 노치로 바꾸고 글로우를 안쪽으로 옮긴다**

`src/features/learning/StartLearning.css:78-94`의 `.start-learning__video-wrap`을
아래로 바꾼다. **바깥 box-shadow는 clip-path에 잘리므로 inset으로 옮겨야 한다** —
이걸 놓치면 집중도에 따라 물드는 연출이 통째로 사라진다.

```css
.start-learning__video-wrap {
  position: relative;
  width: var(--stage-width);
  aspect-ratio: 4 / 3;
  background-color: var(--color-surface);
  /* --live-focus-color는 main에서 상속된다. 측정 전에는 정의되지 않아
     기존 테두리 색으로 떨어진다. */
  border: 1px solid var(--live-focus-color, var(--color-border));
  clip-path: var(--notch-path);
  overflow: hidden;
  /* 집중도가 낮아지면 화면 가장자리가 천천히 물든다. 틱마다 확 바뀌면
     시야 주변에서 깜빡여 학습을 방해하므로 --duration-slow로 늦춘다.
     inset인 이유: clip-path가 바깥 box-shadow를 잘라내기 때문이다. */
  box-shadow: inset 0 0 36px -6px
    color-mix(in oklch, var(--live-focus-color, transparent) 55%, transparent);
  transition: border-color var(--duration-slow) var(--ease-in-out),
    box-shadow var(--duration-slow) var(--ease-in-out);
}
```

- [ ] **Step 2: 이 화면의 주 패널에 브래킷을 붙인다**

`src/features/learning/StartLearning.js`에서 `start-learning__video-wrap` 이 붙은
`div`를 찾아 className을 바꾼다.

```jsx
<div className="start-learning__video-wrap hud-brackets">
```

화면당 주 패널 **1개**에만 붙인다. 이 화면에서는 영상 패널이 그 하나다.

- [ ] **Step 3: 게이지에 눈금을 넣고 각지게 만든다**

`src/features/learning/StartLearning.css:174-190`의 트랙·필 규칙을 아래로 바꾼다.

```css
.start-learning__focus-track {
  position: relative;
  height: 6px;
  background-color: var(--color-surface-alt);
  overflow: hidden;
}

/* 눈금 10칸. 계측기로 읽히려면 값이 어디쯤인지 셀 수 있어야 한다.
   채움 위에 얹혀야 하므로 ::after로 둔다. */
.start-learning__focus-track::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    90deg,
    var(--color-bg) 0 1px,
    transparent 1px 10%
  );
  opacity: 0.55;
  pointer-events: none;
}

.start-learning__focus-fill {
  height: 100%;
  background-color: var(--live-focus-color, var(--color-border));
  /* width가 아니라 scaleX로 늘린다 — 레이아웃을 다시 계산시키지 않는다. */
  transform: scaleX(var(--fill, 0));
  transform-origin: left center;
  transition: transform var(--duration-slow) var(--ease-in-out),
    background-color var(--duration-slow) var(--ease-in-out);
}
```

- [ ] **Step 4: 주 수치에 글로우를, 타이머에 모노스페이스를 준다**

`src/features/learning/StartLearning.css:130-135`의 `.start-learning__timer`를
아래로 바꾼다.

```css
.start-learning__timer {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: var(--tracking-data);
  margin: 0;
}
```

`src/features/learning/StartLearning.css:163-172`의 `.start-learning__focus-value`를
아래로 바꾼다. 이 화면의 주 수치는 이것 하나다.

```css
.start-learning__focus-value {
  font-family: var(--font-mono);
  font-size: var(--text-metric-sm);
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--tracking-data);
  /* 수치도 구간 색을 따라간다. 색만으로 정보를 전달하지 않도록 옆의
     라벨과 퍼센트 수치를 항상 함께 보여준다. */
  color: var(--live-focus-color, var(--color-text-muted));
  /* 화면당 하나뿐인 글로우. 테두리 글로우는 쓰지 않는다. */
  text-shadow: var(--glow-metric);
  transition: color var(--duration-slow) var(--ease-in-out);
}
```

- [ ] **Step 5: 버튼을 radius-full에서 radius-sm으로 내린다**

`src/features/learning/StartLearning.css`에서 `.start-learning__stop`(약 195행)과
`.start-learning__start, .start-learning__pause, .start-learning__resume`(약 218행)의
`border-radius: var(--radius-full);`을 각각 `border-radius: var(--radius-sm);`로
바꾼다. 알약 버튼은 이 방향의 인상과 맞지 않는다.

`.start-learning__status-dot`(약 109행)과 `.start-learning__alert-icon`(약 277행)의
`--radius-full`은 **그대로 둔다** — 상태 점과 아이콘은 원형이 맞다.

- [ ] **Step 6: 경고 배너를 노치로 바꾼다**

`src/features/learning/StartLearning.css`의 `.start-learning__alert` 규칙에서
`border-radius: var(--radius-md);`를 `clip-path: var(--notch-path-sm);`으로 바꾼다.

- [ ] **Step 7: 빌드와 테스트를 확인한다**

Run: `CI=true npx react-scripts test`
Expected: 모든 스위트 PASS

Run: `npx react-scripts build`
Expected: `Compiled successfully.`

- [ ] **Step 8: 육안·키보드로 검증한다**

Run: `npx react-scripts start` → 학습 시작 화면

확인 항목:
- 영상 패널 우상·좌하가 잘려 있고, 좌상·우하에 브래킷이 보인다
- 카메라를 켜고 집중도가 변할 때 영상 안쪽 가장자리가 물든다 (Step 1의 inset)
- 게이지에 눈금 10칸이 보이고 채움이 그 위로 지나간다
- 집중도 수치에만 옅은 글로우가 있다. 테두리에는 없다
- Tab만으로 뒤로가기 → HOME → 시작/중지 → 음소거를 전부 통과하고, 각 요소의
  포커스 링이 잘리지 않고 보인다
- 320px 폭에서 가로 스크롤이 생기지 않는다
- macOS 시스템 설정에서 "동작 줄이기"를 켜면 상태 점 맥박이 멈춘다

- [ ] **Step 9: 커밋 (사용자 확인 후)**

```bash
git add src/features/learning/StartLearning.css src/features/learning/StartLearning.js
git commit -m "feat: 학습 화면에 노치·브래킷·눈금 게이지 적용"
```

---

### Task 5: 리포트 화면 적용과 인쇄 검증

**Files:**
- Modify: `src/features/records/SessionReport.css` (`.session-report__video`, `.metric`, `.metric__value`, `.focus-breakdown__value`, `.weekday-bars__value`, 인쇄 블록)
- Modify: `src/features/records/FocusChart.css` (`.focus-chart`)
- Modify: `src/features/records/FocusChart.js` (루트 `className`)
- Test: 없음 (라우터 의존 화면). 인쇄는 Task 3의 테스트가 전역 해제를 지키고, 나머지는 육안 검증.

**Interfaces:**
- Consumes: Task 3의 `.hud-brackets`, Task 2의 `--notch-path`, `--notch-path-sm`
- Produces: 없음

- [ ] **Step 1: 리포트의 패널을 노치로 바꾼다**

`src/features/records/SessionReport.css`에서:
- `.session-report__video`의 `border-radius: var(--radius-md);` →
  `clip-path: var(--notch-path);`
- `.metric`의 `border-radius: var(--radius-md);` →
  `clip-path: var(--notch-path-sm);`

`src/features/records/FocusChart.css`에서:
- `.focus-chart`의 `border-radius: var(--radius-md);` →
  `clip-path: var(--notch-path);`

- [ ] **Step 2: 리포트의 수치를 모노스페이스로 바꾼다**

스펙의 타이포 규칙: "모든 수치는 `--font-mono`. 자릿수가 흔들리지 않아야 계측기로
읽힌다." `ScoreRing` · `ReasonBadge` · `Mypage` · `Save` · `Trash` · `StartLearning`은
이미 모노를 쓰지만 **`SessionReport.css`에는 한 곳도 없다.**

`src/features/records/SessionReport.css`의 아래 세 규칙에 두 줄씩 추가한다.

```css
/* .metric__value (약 347행) */
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
```

같은 두 줄을 `.focus-breakdown__value`(약 223행)와
`.weekday-bars__value`(약 418행)에도 추가한다.

`.metric__label` · `.metric__note`는 수치가 아니라 설명 텍스트이므로 그대로 둔다.

- [ ] **Step 3: 리포트의 주 패널에 브래킷을 붙인다**

`src/features/records/FocusChart.js`에서 루트 요소의 className을 바꾼다.

```jsx
<div className="focus-chart hud-brackets">
```

`FocusChart`가 리포트의 주 데이터 패널이다. 리포트에서 브래킷은 여기 하나뿐이다.
`.metric` 카드들에는 붙이지 않는다 — 모든 카드에 두르면 규칙이 무너진다.

`.focus-chart`가 이미 의사요소를 쓰는지 먼저 확인한다.

Run: `grep -n 'focus-chart::' src/features/records/FocusChart.css`
Expected: 출력 없음

- [ ] **Step 4: 인쇄 블록에서 노치 잔재를 정리한다**

Task 3이 `--notch-path`를 `none`으로 덮으므로 `clip-path`는 자동으로 풀린다.
다만 `SessionReport.css`의 인쇄 블록에 있는 `.session-report .metric` 규칙은
`border-radius: 0;`을 포함하는데, 이제 `.metric`이 `border-radius`를 쓰지 않으므로
그 줄이 무의미해진다. 해당 규칙을 아래로 바꾼다.

```css
  /* 카드 테두리는 종이에서 과하다. 배경 대신 선 하나로 줄인다.
     노치는 index.css의 인쇄 블록이 --notch-path를 none으로 덮어 이미 풀린다. */
  .session-report .metric {
    padding: var(--space-2) 0;
    border: none;
    border-top: 1px solid var(--color-border);
  }
```

- [ ] **Step 5: 빌드와 테스트를 확인한다**

Run: `CI=true npx react-scripts test`
Expected: 모든 스위트 PASS

Run: `npx react-scripts build`
Expected: `Compiled successfully.`

- [ ] **Step 6: 인쇄 미리보기를 직접 확인한다**

TS-018이 남긴 교훈이다 — 인쇄는 자동 검증이 닿지 않으므로 반드시 눈으로 본다.

Run: `npx react-scripts start` → 저장된 세션 리포트를 연다

브라우저 인쇄 미리보기(Cmd+P)에서 확인:
- **"배경 그래픽" 옵션을 켠 상태**로 확인한다 (막대 색을 남기려면 켜야 한다)
- 종이가 희고, 계측 격자가 없다
- 모서리 노치가 없다 (카드가 직사각형이다)
- FocusChart의 브래킷이 없다
- 콘텐츠가 끝난 자리부터 페이지 끝까지 검게 나오지 않는다
- 집중도 막대 색은 남아 있다
- 마지막 페이지까지 차트 뒷부분이 잘리지 않는다

- [ ] **Step 7: 커밋 (사용자 확인 후)**

```bash
git add src/features/records/SessionReport.css src/features/records/FocusChart.css \
  src/features/records/FocusChart.js
git commit -m "feat: 리포트 화면에 노치·브래킷 적용, 인쇄에서 해제 확인"
```

---

### Task 6: Mypage 적용

프로젝트에서 가장 큰 CSS 파일(735줄)이다.

**Files:**
- Modify: `src/features/profile/Mypage.css` (`.focus-gauge`, `.record-card`, `.quick-action`, `.recommended-card`)
- Modify: `src/features/profile/Mypage.js` (`.focus-gauge` 요소의 `className`)
- Test: 없음 (라우터 의존 화면)

**Interfaces:**
- Consumes: Task 3의 `.hud-brackets`, Task 2의 `--notch-path`
- Produces: 없음

- [ ] **Step 1: 네 패널을 노치로 바꾼다**

`src/features/profile/Mypage.css`에서 아래 네 선택자의 `border-radius` 선언을
`clip-path`로 바꾼다.

| 선택자 | 기존 | 변경 |
|---|---|---|
| `.focus-gauge` | `border-radius: var(--radius-lg);` | `clip-path: var(--notch-path);` |
| `.record-card` | `border-radius: var(--radius-md);` | `clip-path: var(--notch-path);` |
| `.quick-action` | `border-radius: var(--radius-lg);` | `clip-path: var(--notch-path);` |
| `.recommended-card` | `border-radius: var(--radius-md);` | `clip-path: var(--notch-path);` |

`--radius-full`을 쓰는 다섯 곳(아바타·상태 점·칩 계열)은 그대로 둔다.

- [ ] **Step 2: 포커스 가능한 노치 요소의 포커스 링을 안쪽으로 옮긴다**

`clip-path`는 바깥으로 그려지는 `outline`을 잘라낸다. 위 네 선택자 중 포커스를
받는 것을 먼저 찾는다.

Run: `grep -n -E 'focus-gauge|record-card|quick-action|recommended-card' src/features/profile/Mypage.js`

`<a>` · `<button>`이거나 `tabindex`가 있는 것마다 아래 규칙을 추가한다
(`.quick-action`이 버튼일 가능성이 높다).

```css
/* clip-path가 바깥 outline을 잘라내므로 안쪽에 그린다.
   포커스 표시를 없애는 것이 아니라 보이는 자리로 옮기는 것이다. */
.quick-action:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--color-accent);
}
```

- [ ] **Step 3: 이 화면의 주 패널에 브래킷을 붙인다**

`src/features/profile/Mypage.js`에서 `focus-gauge` 요소의 className을 바꾼다.

```jsx
<div className="focus-gauge hud-brackets">
```

붙이기 전에 `.focus-gauge`가 이미 `::before` / `::after`를 쓰는지 확인한다.

Run: `grep -n 'focus-gauge::' src/features/profile/Mypage.css`
Expected: 출력 없음. 있으면 브래킷 대상을 `.recommended-card` 중 첫 카드로 옮긴다.

- [ ] **Step 4: 빌드와 테스트를 확인한다**

Run: `CI=true npx react-scripts test`
Expected: 모든 스위트 PASS

Run: `npx react-scripts build`
Expected: `Compiled successfully.`

- [ ] **Step 5: 육안·키보드로 검증한다**

Run: `npx react-scripts start` → 마이페이지

- 네 종류 패널의 우상·좌하가 잘려 있다
- 브래킷은 집중도 게이지 하나에만 있다
- Tab으로 이동할 때 노치 카드의 포커스 표시가 **잘리지 않고** 보인다
- 320 / 768 / 1024 / 1440 에서 가로 스크롤이 없다

- [ ] **Step 6: 커밋 (사용자 확인 후)**

```bash
git add src/features/profile/Mypage.css src/features/profile/Mypage.js
git commit -m "feat: 마이페이지에 노치·브래킷 적용"
```

---

### Task 7: 마케팅 · 인증 · 채팅 · 공용 UI 적용

남은 화면을 한 번에 정리한다. 기계적인 치환이라 한 태스크로 묶는다.

**Files:**
- Modify: `src/features/marketing/Home.css`, `Pricing.css`, `UserGuide.css`
- Modify: `src/features/auth/Login.css`, `SignUp.css`
- Modify: `src/features/chat/AiChat.css`
- Modify: `src/features/records/Save.css`, `Trash.css`
- Modify: `src/components/ui/Skeleton.css`, `ConfirmDialog.css`
- Modify: `src/features/profile/Mypage.css` (테두리 글로우 한 줄), `src/styles/tokens.css` (`--shadow-glow` 삭제)
- Modify: 위 화면의 주 패널 JSX 5곳 (`className`에 `hud-brackets` 추가)
- Test: `src/components/ui/Skeleton.test.js`, `ConfirmDialog.test.js` (기존 테스트가 깨지지 않는지)

**Interfaces:**
- Consumes: Task 3의 `.hud-brackets`, Task 2의 `--notch-path`, `--notch-path-sm`
- Produces: 없음

- [ ] **Step 1: 패널을 노치로 바꾼다**

아래 표대로 `border-radius` 선언을 `clip-path`로 바꾼다.

| 파일 | 선택자 | 변경 |
|---|---|---|
| `Home.css` | `.home__preview` | `clip-path: var(--notch-path);` |
| `Home.css` | `.feature-card` | `clip-path: var(--notch-path);` |
| `Home.css` | `.feature-card--primary` | `clip-path: var(--notch-path);` |
| `Home.css` | `.home__vision-gallery img` | `clip-path: var(--notch-path);` |
| `Pricing.css` | `.pricing__tier` | `clip-path: var(--notch-path);` |
| `Pricing.css` | `.pricing__tier--featured` | `clip-path: var(--notch-path);` |
| `Pricing.css` | `.pricing__notice` | `clip-path: var(--notch-path-sm);` |
| `UserGuide.css` | `.guide__figure` | `clip-path: var(--notch-path);` |
| `UserGuide.css` | `.guide__outro` | `clip-path: var(--notch-path);` |
| `Login.css` | `.login-card` | `clip-path: var(--notch-path);` |
| `SignUp.css` | `.signup-card` | `clip-path: var(--notch-path);` |
| `AiChat.css` | `.ai-chat-conversations` | `clip-path: var(--notch-path);` |
| `Save.css` | `.session-card__link` | `clip-path: var(--notch-path);` |
| `Trash.css` | `.trash-card` | `clip-path: var(--notch-path);` |
| `Skeleton.css` | `.skeleton__item--card` | `clip-path: var(--notch-path);` |
| `Skeleton.css` | `.skeleton__item--metric` | `clip-path: var(--notch-path);` |
| `ConfirmDialog.css` | `.confirm-dialog` | `clip-path: var(--notch-path);` |

- [ ] **Step 2: 컨트롤은 노치가 아니라 radius-sm으로 내린다**

버튼·입력은 패널이 아니다. 아래는 `--radius-md` → `--radius-sm`으로만 바꾼다.

| 파일 | 선택자 |
|---|---|
| `AiChat.css` | `.ai-chat-input textarea` |
| `AiChat.css` | `.ai-chat-input button` |
| `Save.css` | `.session-card__delete` |
| `Skeleton.css` | `.skeleton__item` |

`AiChat.css`의 `.ai-chat-bubble`은 **그대로 둔다** (`--radius-md` 유지).
말풍선은 패널도 컨트롤도 아니고, 노치를 주면 대화가 계측 패널처럼 읽혀 어색하다.

- [ ] **Step 3: 포커스 가능한 노치 요소에 안쪽 포커스 링을 준다**

`.session-card__link`는 `<a>`다. `clip-path`가 outline을 자르므로 안쪽에 그린다.
`src/features/records/Save.css`에 추가한다.

```css
/* clip-path가 바깥 outline을 잘라내므로 안쪽에 그린다. */
.session-card__link:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--color-accent);
}
```

나머지 노치 대상 중 포커스를 받는 것이 더 있는지 확인한다.

Run: `grep -rn -B3 ':focus-visible' src/features/marketing src/features/auth src/features/chat src/features/records src/components/ui`

Step 1에서 `clip-path`를 건 선택자에 `outline`만 있는 규칙이 나오면 위와 같은
형태(`outline: none` + `inset box-shadow`)로 바꾼다.

- [ ] **Step 4: 화면별 주 패널에 브래킷을 붙인다**

각 화면 **1개**씩이다.

| 파일 | 요소 | 변경 후 className |
|---|---|---|
| `src/features/marketing/Home.js` | `.home__preview` | `home__preview hud-brackets` |
| `src/features/marketing/Pricing.js` | `.pricing__tier--featured` | `... pricing__tier--featured hud-brackets` |
| `src/features/marketing/UserGuide.js` | `.guide__outro` | `guide__outro hud-brackets` |
| `src/features/auth/Login.js` | `.login-card` | `login-card hud-brackets` |
| `src/features/auth/SignUp.js` | `.signup-card` | `signup-card hud-brackets` |

`AiChat` · `Save` · `Trash` · `ConfirmDialog`에는 붙이지 않는다 — 목록·대화 화면에는
주 패널이라 부를 것이 없고, 모달에 브래킷을 두르면 과해진다.

붙이기 전에 각 선택자가 이미 의사요소를 쓰는지 확인한다.

Run: `grep -rn -E '(home__preview|pricing__tier--featured|guide__outro|login-card|signup-card)::(before|after)' src`
Expected: 출력 없음. 나오면 그 화면은 브래킷을 건너뛴다.

- [ ] **Step 5: 테두리 글로우를 걷어낸다**

HUD 절제 규칙 3번이 테두리 글로우를 금지한다. `--shadow-glow`가 정확히 그것이고,
소비처가 네 곳 남아 있다. 강조는 이제 강조색 테두리와 브래킷이 맡는다.

아래 네 줄을 **삭제**한다 (규칙 전체가 아니라 이 한 줄씩만).

| 파일 | 선택자 | 지울 줄 |
|---|---|---|
| `src/features/marketing/Pricing.css` | `.pricing__tier--featured` | `box-shadow: var(--shadow-glow);` |
| `src/features/marketing/Home.css` | 주 CTA 버튼 (약 53행) | `box-shadow: var(--shadow-glow);` |
| `src/features/marketing/UserGuide.css` | 마무리 CTA 버튼 (약 167행) | `box-shadow: var(--shadow-glow);` |
| `src/features/profile/Mypage.css` | `.record-section__link:hover` | `box-shadow: var(--shadow-glow);` |

Mypage는 Task 6의 파일이지만 이 한 줄은 같은 규칙에서 나온 변경이라 여기서 함께
처리한다. `.record-section__link:hover`는 `border-color`와 배경 색 변화가 이미
있으므로 글로우를 빼도 hover 피드백은 남는다.

그다음 `src/styles/tokens.css`에서 토큰 정의 자체를 지운다 (Task 2에서 남겨둔 것).

아래 세 줄(주석 두 줄 + 선언 한 줄)을 통째로 지운다.

```css
  /* 테두리 글로우다. HUD 절제 규칙 3번이 금지하므로 Task 7에서 소비처 4곳과
     함께 삭제한다. 여기서 먼저 지우면 그 사이 참조가 끊긴다. */
  --shadow-glow: 0 0 40px oklch(72% 0.13 250 / 0.25);
```

Run: `grep -rn 'shadow-glow' src`
Expected: 출력 없음

- [ ] **Step 6: 테스트와 빌드를 확인한다**

Run: `CI=true npx react-scripts test`
Expected: 모든 스위트 PASS. `Skeleton.test.js` · `ConfirmDialog.test.js`는 클래스
이름을 바꾸지 않았으므로 그대로 통과해야 한다.

Run: `npx react-scripts build`
Expected: `Compiled successfully.`

- [ ] **Step 7: 남은 균일 라운드를 확인한다**

Run: `grep -rn -E 'border-radius: var\(--radius-(md|lg)\)' src`
Expected: `.ai-chat-bubble` 한 줄만 남는다 (Step 2에서 의도적으로 남긴 것).

- [ ] **Step 8: 전 화면을 눈으로 훑는다**

Run: `npx react-scripts start`

홈 · FAQ · 요금제 · 사용 가이드 · 로그인 · 회원가입 · 마이페이지 · 저장 목록 ·
휴지통 · AI 채팅을 차례로 연다.

- 320 / 768 / 1024 / 1440 에서 가로 스크롤이 없다
- 브래킷이 화면당 1개를 넘지 않는다
- Tab만으로 각 화면의 전체 플로우를 통과하고 포커스 표시가 항상 보인다
- 노치가 카드 안 텍스트를 가리지 않는다 (모서리에 글자가 물리면 그 카드의
  `padding`을 `--notch`(14px) 이상으로 올린다)

- [ ] **Step 9: 커밋 (사용자 확인 후)**

```bash
git add src/features/marketing src/features/auth src/features/chat \
  src/features/records/Save.css src/features/records/Trash.css \
  src/features/profile/Mypage.css src/styles/tokens.css \
  src/components/ui/Skeleton.css src/components/ui/ConfirmDialog.css
git commit -m "feat: 마케팅·인증·채팅·공용 UI에 노치 적용, 테두리 글로우 제거"
```

---

## 완료 기준

- [ ] `CI=true npx react-scripts test` 전체 통과
- [ ] `npx react-scripts build` 성공
- [ ] `grep -rn -E '\-\-(navy|cyan-300|cyan-700)' src` 출력 없음
- [ ] `grep -rn -E 'border-radius: var\(--radius-(md|lg)\)' src` → `.ai-chat-bubble` 한 줄만
- [ ] `grep -rn 'shadow-glow' src` 출력 없음 (테두리 글로우 금지)
- [ ] 리포트의 수치가 모노스페이스로 나온다
- [ ] 대비 근거 수치가 `tokens.css` 주석에 남아 있다
- [ ] 리포트 인쇄 미리보기("배경 그래픽" 켬)에서 격자·노치·브래킷·글로우가 전부 사라진다
- [ ] "동작 줄이기"에서 상태 점 맥박이 멈춘다
- [ ] 320 / 768 / 1024 / 1440 에서 오버플로 없음
- [ ] 전 화면을 키보드만으로 이동 가능하고, 노치에 포커스 표시가 잘리지 않는다

## 범위 밖

- 라이트 테마 추가 (프로젝트 규칙상 금지)
- 집중도 밴드 색 체계 변경
- 신규 의존성 도입
- 기능·데이터 모델 변경 — 이번 작업은 표현 계층만 건드린다
- `Mypage.css` · `Home.css` 등에 남아 있는 하드코딩 색 (기존 코드다. 이번 변경이
  만든 것이 아니므로 건드리지 않는다 — 발견 사실만 여기 남긴다)
