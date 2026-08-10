# Zoner 계측 장비 디자인 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **상태 (2026-08-07 확인)**: 이 계획의 기능은 구현되어 코드베이스에 있다.
> **아래 체크박스는 실행 중에 갱신되지 않았다 — 진행 표시로 신뢰하지 말 것.**
> 미체크는 "안 했다"가 아니라 "표시를 안 했다"이다. 실제 반영 여부는 `src/`
> 코드와 테스트(214건 통과)로 확인한다.

**Goal:** 집중도 수치를 화면의 주인공으로 만드는 "계측 장비" 디자인 시스템(토큰 + 공용 컴포넌트 4종)을 세우고, 기능 변경이 없는 5개 화면(Mypage, Save, Trash, Trashread, Home)에 적용한다.

**Architecture:** 기존 `src/styles/tokens.css`에 상태 색·데이터 타이포·모션 토큰을 **추가만** 한다(기존 값 변경 없음 — 전역 import라 파급이 크다). 그 위에 라우터 의존이 없는 순수 프레젠테이션 컴포넌트 4종을 `src/components/ui/`에 새로 만들고, 화면들은 이 컴포넌트를 소비하기만 한다. 차트 라이브러리 없이 SVG를 직접 그린다.

**Tech Stack:** React 19 (CRA / react-scripts 5.0.1), 순수 CSS 커스텀 프로퍼티, SVG, `IntersectionObserver`, Jest + @testing-library/react

**설계 문서:** `docs/superpowers/specs/2026-08-05-zoner-design-system-design.md`

## Global Constraints

모든 태스크의 요구사항에 암묵적으로 포함된다.

- 기존 `tokens.css`의 값은 **변경하지 않는다. 추가만 한다.** 전역 import되어 모든 화면이 소비한다
- **차트 라이브러리를 추가하지 않는다.** `ScoreRing`·`Sparkline`은 SVG를 직접 그린다. `package.json`에 새 런타임 의존성을 추가하지 않는다
- 폰트 패밀리는 **최대 2종**(Pretendard + JetBrains Mono), 신규 폰트는 **굵기 400 하나만** 로드하고 `font-display: swap`
- 애니메이션은 **`transform` / `opacity` / `stroke-dashoffset`만** 사용한다. `width`, `height`, `top`, `left`, `margin`, `font-size`는 애니메이션하지 않는다
- **색만으로 정보를 전달하지 않는다.** 집중 수준·판정 원인은 색과 함께 반드시 수치 또는 한글 라벨을 동반한다
- 모든 인터랙티브 요소에 `:focus-visible` 스타일을 유지한다. 신규 컴포넌트도 예외 없다
- 터치 대상 최소 **44×44 CSS px**
- 브레이크포인트 **320 / 375 / 768 / 1024 / 1440** 에서 **가로 스크롤이 발생하지 않아야 한다**
- **`react-router-dom`을 import 하는 파일에는 Jest 테스트를 작성하지 않는다** (TROUBLESHOOTING TS-003: CRA 번들 Jest 리졸버가 v7 exports 맵을 해석하지 못한다). `src/components/ui/`는 라우터 의존이 없으므로 테스트 대상이다
- **`src/components/Read.js`와 `src/components/StartLearning.js`(및 각 CSS)는 이번 범위 밖이다. 건드리지 않는다**
- **쿼리·스키마·함수 시그니처를 변경하지 않는다.** 이번 계획은 표현만 바꾼다. `supabase.from(...).select(...)` 문자열을 수정하지 않는다
- 파일당 800줄 미만
- 다크 단일 테마다. 라이트 모드를 추가하지 않는다

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `src/styles/tokens.css` | 전역 토큰. 상태 색·데이터 타이포·모션 추가 | 1 |
| `public/index.html` | JetBrains Mono 400 CDN 로드 | 1 |
| `src/components/ui/ScoreRing.js` `.css` `.test.js` | 점수 원형 게이지 + `focusLevel` 순수 함수 | 2 |
| `src/components/ui/Sparkline.js` `.css` `.test.js` | 추이 폴리라인 | 3 |
| `src/components/ui/Skeleton.js` `.css` `.test.js` | 로딩 자리 표시 | 4 |
| `src/components/ui/ReasonBadge.js` `.css` `.test.js` | 판정 원인 색 + 한글 라벨 | 4 |
| `src/components/Mypage.js` `.css` | 요약 헤로 + 스파크라인 + 스켈레톤 | 5 |
| `src/components/Save.js` `.css` | 목록 행에 스파크라인·점수 색 | 6 |
| `src/components/Trash.js` `Trashread.js` + CSS | Save와 같은 언어, 채도 낮춤, 만료 긴급도 색 | 7 |
| `src/components/Home.js` `.css` | 제품 미리보기 히어로, 비균일 카드, 스크롤 진입 모션 | 8 |

태스크 1이 모든 후속 태스크의 전제다. 태스크 2~4는 서로 독립이지만 5~8이 전부 소비하므로 먼저 끝낸다.

---

### Task 1: 디자인 토큰 확장 + 데이터 폰트 로드

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `public/index.html:18` (Pretendard `<link>` 바로 아래)

**Interfaces:**
- Consumes: 기존 원시 토큰 `--cyan-400`, `--cyan-500`, `--navy-550`, `--red-500` (모두 `tokens.css`에 실존)
- Produces: `--color-focus-high|mid|low|poor`, `--color-reason-*`(6종), `--font-mono`, `--text-metric-sm|metric|metric-lg`, `--tracking-tight`, `--tracking-data`, `--duration-slow`, `--ease-in-out`. 태스크 2~8이 전부 이 이름들을 참조한다

CSS라 단위 테스트가 성립하지 않는다. 검증은 빌드 + 브라우저 확인이다.

- [ ] **Step 1: 원시 상태 색 3종 추가**

`tokens.css`의 `--red-500: oklch(66% 0.2 25);` 줄 **바로 아래**에 삽입한다:

```css
  --lime-400: oklch(80% 0.16 145);
  --amber-400: oklch(80% 0.14 80);
  --orange-500: oklch(70% 0.17 50);
```

- [ ] **Step 2: 의미 토큰 추가**

`--color-danger: var(--red-500);` 줄 **바로 아래**에 삽입한다:

```css

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
  --color-reason-absent: var(--navy-550);
```

원인 색 이름은 `src/lib/focusTracker.js`의 `REASON` 값(`focused`, `looking_down`, `head_turned`, `looking_up`, `eyes_closed`, `absent`)에서 언더스코어를 하이픈으로 바꾼 것과 정확히 일치해야 한다. 후속 서브프로젝트가 매핑 테이블 없이 문자열 치환만으로 토큰 이름을 만들 수 있게 하기 위함이다.

- [ ] **Step 3: 데이터 타이포그래피 토큰 추가**

`--font-display: ...;` 줄 **바로 아래**에 삽입한다:

```css
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
```

그리고 `--leading-body: 1.6;` 줄 **바로 아래**에 삽입한다:

```css

  --text-metric-sm: clamp(1.5rem, 1.2rem + 1.5vw, 2rem);
  --text-metric: clamp(2.5rem, 1.8rem + 3.5vw, 4rem);
  --text-metric-lg: clamp(4rem, 2.5rem + 7vw, 8rem);

  --tracking-tight: -0.03em;
  --tracking-data: 0.02em;
```

- [ ] **Step 4: 모션 토큰 확장**

`--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);` 줄 **바로 아래**에 삽입한다:

```css
  --duration-slow: 600ms;
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

기존 `--duration-fast`, `--duration-normal`, `--ease-out-expo`는 삭제하지 않는다. 파일 하단의 `@media (prefers-reduced-motion: reduce)` 블록도 그대로 둔다 — 신규 애니메이션을 자동으로 커버한다.

- [ ] **Step 5: JetBrains Mono 400 로드**

`public/index.html`의 Pretendard `<link>`(18행에서 닫힘) **바로 아래**에 추가한다:

```html
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5/400.css"
    />
```

호스트가 `cdn.jsdelivr.net`으로 기존 `<link rel="preconnect">`(14행)가 그대로 적용된다. 새 preconnect를 추가하지 않는다. fontsource 패키지는 `font-display: swap`을 이미 포함하므로 별도 지정이 불필요하다. **굵기 400 하나만** 로드한다 — `700.css` 등을 추가하지 않는다.

- [ ] **Step 6: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공, 에러 없음

- [ ] **Step 7: 폰트가 실제로 적용되는지 브라우저에서 확인**

`npm start` 후 브라우저 콘솔에서:

```js
document.fonts.check('400 12px "JetBrains Mono"')
```

Expected: `true`

`false`가 나오면 CDN 경로가 잘못된 것이다. 그 경우 `https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5/index.css`를 시도하고, 그래도 실패하면 **BLOCKED로 보고한다** — 임의의 다른 폰트로 대체하지 않는다.

- [ ] **Step 8: 커밋**

```bash
git add src/styles/tokens.css public/index.html
git commit -m "feat: 계측 장비 디자인 토큰과 데이터 폰트 추가"
```

---

### Task 2: `ScoreRing` 컴포넌트

**Files:**
- Create: `src/components/ui/ScoreRing.js`
- Create: `src/components/ui/ScoreRing.css`
- Test: `src/components/ui/ScoreRing.test.js`

**Interfaces:**
- Consumes: 태스크 1의 `--color-focus-*`, `--font-mono`, `--duration-slow`, `--ease-in-out`
- Produces:
  - `export function focusLevel(value: number): 'high' | 'mid' | 'low' | 'poor'` — 태스크 3·5·6·7이 재사용한다
  - `export function ScoreRing({ value, size, label })` — `size`는 `'sm' | 'md' | 'lg'`, 기본 `'md'`. `label`은 선택
  - default export도 `ScoreRing`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/ui/ScoreRing.test.js`:

```javascript
import React from 'react';
import { render, screen } from '@testing-library/react';
import ScoreRing, { focusLevel } from './ScoreRing';

describe('focusLevel', () => {
  test('80 이상은 high', () => {
    expect(focusLevel(80)).toBe('high');
    expect(focusLevel(100)).toBe('high');
  });

  test('50~79는 mid', () => {
    expect(focusLevel(79)).toBe('mid');
    expect(focusLevel(50)).toBe('mid');
  });

  test('30~49는 low', () => {
    expect(focusLevel(49)).toBe('low');
    expect(focusLevel(30)).toBe('low');
  });

  test('30 미만은 poor', () => {
    expect(focusLevel(29)).toBe('poor');
    expect(focusLevel(0)).toBe('poor');
  });
});

describe('ScoreRing', () => {
  test('점수를 숫자로 표시한다', () => {
    render(<ScoreRing value={73} />);
    expect(screen.getByText('73')).toBeInTheDocument();
  });

  test('aria-label로 수치를 텍스트로 전달한다', () => {
    render(<ScoreRing value={73} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      '집중도 73퍼센트'
    );
  });

  test('label을 주면 aria-label 앞에 붙는다', () => {
    render(<ScoreRing value={50} label="오늘" />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      '오늘 집중도 50퍼센트'
    );
  });

  test('범위를 벗어난 값을 0~100으로 자른다', () => {
    const { rerender } = render(<ScoreRing value={150} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    rerender(<ScoreRing value={-10} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  test('소수점 값을 반올림한다', () => {
    render(<ScoreRing value={72.6} />);
    expect(screen.getByText('73')).toBeInTheDocument();
  });

  test('점수 구간에 따라 다른 클래스를 준다', () => {
    const { container, rerender } = render(<ScoreRing value={90} />);
    expect(
      container.querySelector('.score-ring__value--high')
    ).toBeInTheDocument();
    rerender(<ScoreRing value={10} />);
    expect(
      container.querySelector('.score-ring__value--poor')
    ).toBeInTheDocument();
  });
});
```

`src/setupTests.js`가 `@testing-library/jest-dom`을 import 하는지 확인한다(CRA 기본 템플릿에 포함). 없으면 `import '@testing-library/jest-dom';` 한 줄을 추가한다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `CI=true npx react-scripts test --testPathPattern=ScoreRing`
Expected: FAIL — `Cannot find module './ScoreRing'`

- [ ] **Step 3: 컴포넌트 구현**

`src/components/ui/ScoreRing.js`:

```javascript
import React from 'react';
import './ScoreRing.css';

const SIZE_PX = { sm: 64, md: 120, lg: 200 };
const STROKE_PX = { sm: 6, md: 10, lg: 14 };

export function focusLevel(value) {
  if (value >= 80) return 'high';
  if (value >= 50) return 'mid';
  if (value >= 30) return 'low';
  return 'poor';
}

export function ScoreRing({ value, size = 'md', label }) {
  const score = Math.max(0, Math.min(100, Math.round(value)));
  const px = SIZE_PX[size] ?? SIZE_PX.md;
  const stroke = STROKE_PX[size] ?? STROKE_PX.md;
  const radius = (px - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const level = focusLevel(score);

  return (
    <div className={`score-ring score-ring--${size}`}>
      <svg
        className="score-ring__svg"
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        role="img"
        aria-label={`${label ? `${label} ` : ''}집중도 ${score}퍼센트`}
      >
        <circle
          className="score-ring__track"
          cx={px / 2}
          cy={px / 2}
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className={`score-ring__value score-ring__value--${level}`}
          cx={px / 2}
          cy={px / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          style={{
            '--ring-circumference': circumference,
            '--ring-offset': offset,
          }}
        />
      </svg>
      <div className="score-ring__center" aria-hidden="true">
        <span className={`score-ring__number score-ring__number--${level}`}>
          {score}
        </span>
        <span className="score-ring__unit">%</span>
        {label && <span className="score-ring__label">{label}</span>}
      </div>
    </div>
  );
}

export default ScoreRing;
```

중앙 텍스트에 `aria-hidden="true"`를 준 이유: SVG의 `aria-label`이 이미 같은 수치를 읽어주므로, 그대로 두면 스크린리더가 점수를 두 번 읽는다.

- [ ] **Step 4: 스타일 구현**

`src/components/ui/ScoreRing.css`:

```css
.score-ring {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.score-ring__svg {
  display: block;
}

.score-ring__track {
  fill: none;
  stroke: var(--color-border);
}

.score-ring__value {
  fill: none;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
  animation: score-ring-fill var(--duration-slow) var(--ease-in-out) both;
}

.score-ring__value--high {
  stroke: var(--color-focus-high);
}
.score-ring__value--mid {
  stroke: var(--color-focus-mid);
}
.score-ring__value--low {
  stroke: var(--color-focus-low);
}
.score-ring__value--poor {
  stroke: var(--color-focus-poor);
}

@keyframes score-ring-fill {
  from {
    stroke-dashoffset: var(--ring-circumference);
  }
  to {
    stroke-dashoffset: var(--ring-offset);
  }
}

.score-ring__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  pointer-events: none;
}

.score-ring__number {
  font-family: var(--font-mono);
  font-weight: 400;
  letter-spacing: var(--tracking-tight);
  line-height: 1;
}

.score-ring__number--high {
  color: var(--color-focus-high);
}
.score-ring__number--mid {
  color: var(--color-focus-mid);
}
.score-ring__number--low {
  color: var(--color-focus-low);
}
.score-ring__number--poor {
  color: var(--color-focus-poor);
}

.score-ring__unit {
  font-family: var(--font-mono);
  color: var(--color-text-muted);
  line-height: 1;
}

.score-ring__label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.score-ring--sm .score-ring__number {
  font-size: var(--text-lg);
}
.score-ring--sm .score-ring__unit {
  font-size: var(--text-xs);
}

.score-ring--md .score-ring__number {
  font-size: var(--text-metric-sm);
}
.score-ring--md .score-ring__unit {
  font-size: var(--text-sm);
}

.score-ring--lg .score-ring__number {
  font-size: var(--text-metric);
}
.score-ring--lg .score-ring__unit {
  font-size: var(--text-base);
}
```

`animation` 하나만 쓰고 `stroke-dashoffset`을 인라인 스타일로 중복 지정하지 않는다. `animation-fill-mode: both`가 종료 후 `to` 값을 유지하며, `prefers-reduced-motion`에서 duration이 0.01ms가 되어도 최종 값에 그대로 도달한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `CI=true npx react-scripts test --testPathPattern=ScoreRing`
Expected: PASS (10 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/components/ui/ScoreRing.js src/components/ui/ScoreRing.css src/components/ui/ScoreRing.test.js
git commit -m "feat: 집중도 점수 원형 게이지 ScoreRing 추가"
```

---

### Task 3: `Sparkline` 컴포넌트

**Files:**
- Create: `src/components/ui/Sparkline.js`
- Create: `src/components/ui/Sparkline.css`
- Test: `src/components/ui/Sparkline.test.js`

**Interfaces:**
- Consumes: 태스크 1의 `--color-focus-*`, 태스크 2의 `focusLevel` (`import { focusLevel } from './ScoreRing'`)
- Produces: `export function Sparkline({ data, width, height, ariaLabel })` — `data`는 0~1 사이 숫자 배열, `width` 기본 96, `height` 기본 24. default export도 `Sparkline`

`data`가 0~1인 이유: `study_sessions.timeline`의 `focus_ratio`가 이미 0~1이라 호출부에서 변환이 필요 없다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/ui/Sparkline.test.js`:

```javascript
import React from 'react';
import { render, screen } from '@testing-library/react';
import Sparkline from './Sparkline';

const pointsOf = (container) =>
  container
    .querySelector('polyline')
    .getAttribute('points')
    .trim()
    .split(/\s+/);

describe('Sparkline', () => {
  test('데이터가 비면 아무것도 그리지 않는다', () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('데이터가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<Sparkline data={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  test('점 개수만큼 polyline 좌표를 만든다', () => {
    const { container } = render(
      <Sparkline data={[0, 0.5, 1]} width={100} height={20} />
    );
    expect(pointsOf(container)).toHaveLength(3);
  });

  test('첫 점은 왼쪽 끝, 마지막 점은 오른쪽 끝에 놓는다', () => {
    const { container } = render(
      <Sparkline data={[0, 1]} width={100} height={20} />
    );
    const points = pointsOf(container);
    expect(points[0].split(',')[0]).toBe('0');
    expect(points[1].split(',')[0]).toBe('100');
  });

  test('값이 클수록 y가 작다 (위로 올라간다)', () => {
    const { container } = render(
      <Sparkline data={[0, 1]} width={100} height={20} />
    );
    const points = pointsOf(container);
    const y0 = Number(points[0].split(',')[1]);
    const y1 = Number(points[1].split(',')[1]);
    expect(y1).toBeLessThan(y0);
  });

  test('점이 하나면 가로 직선을 그린다', () => {
    const { container } = render(
      <Sparkline data={[0.5]} width={100} height={20} />
    );
    const points = pointsOf(container);
    expect(points).toHaveLength(2);
    expect(points[0].split(',')[1]).toBe(points[1].split(',')[1]);
  });

  test('기본 aria-label에 평균 집중도를 담는다', () => {
    render(<Sparkline data={[0.5, 0.7]} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      '집중도 추이, 평균 60퍼센트'
    );
  });

  test('ariaLabel을 주면 그것을 쓴다', () => {
    render(<Sparkline data={[0.5]} ariaLabel="12분간 추이" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', '12분간 추이');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `CI=true npx react-scripts test --testPathPattern=Sparkline`
Expected: FAIL — `Cannot find module './Sparkline'`

- [ ] **Step 3: 컴포넌트 구현**

`src/components/ui/Sparkline.js`:

```javascript
import React from 'react';
import { focusLevel } from './ScoreRing';
import './Sparkline.css';

const STROKE = 1.5;

export function Sparkline({ data, width = 96, height = 24, ariaLabel }) {
  if (!data || data.length === 0) {
    return null;
  }

  // 선 굵기의 절반만큼 위아래를 비워야 최대·최소값에서 선이 잘리지 않는다.
  const pad = STROKE / 2;
  const usable = height - STROKE;
  const toY = (v) => pad + (1 - Math.max(0, Math.min(1, v))) * usable;

  const points =
    data.length === 1
      ? `0,${toY(data[0])} ${width},${toY(data[0])}`
      : data
          .map((v, i) => `${(i / (data.length - 1)) * width},${toY(v)}`)
          .join(' ');

  const average = data.reduce((sum, v) => sum + v, 0) / data.length;
  const level = focusLevel(average * 100);

  return (
    <svg
      className={`sparkline sparkline--${level}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={
        ariaLabel ?? `집중도 추이, 평균 ${Math.round(average * 100)}퍼센트`
      }
    >
      <polyline className="sparkline__line" points={points} />
    </svg>
  );
}

export default Sparkline;
```

- [ ] **Step 4: 스타일 구현**

`src/components/ui/Sparkline.css`:

```css
.sparkline {
  display: block;
  overflow: visible;
}

.sparkline__line {
  fill: none;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.sparkline--high .sparkline__line {
  stroke: var(--color-focus-high);
}
.sparkline--mid .sparkline__line {
  stroke: var(--color-focus-mid);
}
.sparkline--low .sparkline__line {
  stroke: var(--color-focus-low);
}
.sparkline--poor .sparkline__line {
  stroke: var(--color-focus-poor);
}
```

`preserveAspectRatio="none"`으로 늘렸을 때 선 굵기가 왜곡되므로 `vector-effect: non-scaling-stroke`로 고정한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `CI=true npx react-scripts test --testPathPattern=Sparkline`
Expected: PASS (8 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/components/ui/Sparkline.js src/components/ui/Sparkline.css src/components/ui/Sparkline.test.js
git commit -m "feat: 집중도 추이 Sparkline 추가"
```

---

### Task 4: `Skeleton` + `ReasonBadge` 컴포넌트

두 컴포넌트를 한 태스크로 묶는다. 둘 다 작고, 상태가 없으며, 서로 의존하지 않는다.

**Files:**
- Create: `src/components/ui/Skeleton.js`, `src/components/ui/Skeleton.css`, `src/components/ui/Skeleton.test.js`
- Create: `src/components/ui/ReasonBadge.js`, `src/components/ui/ReasonBadge.css`, `src/components/ui/ReasonBadge.test.js`

**Interfaces:**
- Consumes: 태스크 1의 `--color-reason-*`, `--font-mono`, `--tracking-data`, `--ease-in-out`
- Produces:
  - `export function Skeleton({ variant, count })` — `variant`는 `'text' | 'card' | 'metric'`(기본 `'text'`), `count` 기본 1
  - `export function ReasonBadge({ reason, ratio })` — `reason`은 `focusTracker`의 REASON 문자열, `ratio`는 0~1 (선택)
  - `export const REASON_LABELS` — reason → 한글 라벨 맵. 태스크 5~8에서는 쓰지 않지만 후속 서브프로젝트가 쓴다

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/ui/Skeleton.test.js`:

```javascript
import React from 'react';
import { render, screen } from '@testing-library/react';
import Skeleton from './Skeleton';

describe('Skeleton', () => {
  test('기본은 한 줄', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelectorAll('.skeleton__item')).toHaveLength(1);
  });

  test('count만큼 반복한다', () => {
    const { container } = render(<Skeleton variant="card" count={3} />);
    expect(container.querySelectorAll('.skeleton__item')).toHaveLength(3);
  });

  test('variant를 클래스로 반영한다', () => {
    const { container } = render(<Skeleton variant="metric" />);
    expect(
      container.querySelector('.skeleton__item--metric')
    ).toBeInTheDocument();
  });

  test('로딩 중임을 스크린리더에 한 번만 알린다', () => {
    render(<Skeleton count={3} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('불러오는 중')).toBeInTheDocument();
  });
});
```

`src/components/ui/ReasonBadge.test.js`:

```javascript
import React from 'react';
import { render, screen } from '@testing-library/react';
import ReasonBadge, { REASON_LABELS } from './ReasonBadge';

describe('ReasonBadge', () => {
  test('여섯 가지 원인 모두에 한글 라벨이 있다', () => {
    expect(Object.keys(REASON_LABELS).sort()).toEqual([
      'absent',
      'eyes_closed',
      'focused',
      'head_turned',
      'looking_down',
      'looking_up',
    ]);
  });

  test('색과 함께 항상 한글 라벨을 표시한다', () => {
    render(<ReasonBadge reason="absent" />);
    expect(screen.getByText('자리 비움')).toBeInTheDocument();
  });

  test('reason을 하이픈 클래스로 바꾼다', () => {
    const { container } = render(<ReasonBadge reason="eyes_closed" />);
    expect(
      container.querySelector('.reason-badge--eyes-closed')
    ).toBeInTheDocument();
  });

  test('ratio를 주면 백분율로 표시한다', () => {
    render(<ReasonBadge reason="focused" ratio={0.42} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  test('ratio가 없으면 백분율을 표시하지 않는다', () => {
    const { container } = render(<ReasonBadge reason="focused" />);
    expect(container.querySelector('.reason-badge__ratio')).toBeNull();
  });

  test('모르는 reason이면 아무것도 그리지 않는다', () => {
    const { container } = render(<ReasonBadge reason="unknown_reason" />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `CI=true npx react-scripts test --testPathPattern="Skeleton|ReasonBadge"`
Expected: FAIL — 두 모듈 모두 `Cannot find module`

- [ ] **Step 3: `Skeleton` 구현**

`src/components/ui/Skeleton.js`:

```javascript
import React from 'react';
import './Skeleton.css';

export function Skeleton({ variant = 'text', count = 1 }) {
  return (
    <div className="skeleton" role="status" aria-busy="true">
      <span className="skeleton__sr">불러오는 중</span>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`skeleton__item skeleton__item--${variant}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export default Skeleton;
```

`role="status"`는 암묵적으로 `aria-live="polite"`를 가지므로 별도 지정하지 않는다. 각 항목에 `aria-hidden`을 주어 스크린리더가 "불러오는 중"을 한 번만 읽게 한다.

`src/components/ui/Skeleton.css`:

```css
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
}

.skeleton__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.skeleton__item {
  background-color: var(--color-surface-alt);
  border-radius: var(--radius-md);
  animation: skeleton-pulse 1.4s var(--ease-in-out) infinite;
}

.skeleton__item--text {
  height: 1rem;
  border-radius: var(--radius-sm);
}

.skeleton__item--card {
  height: 5.5rem;
  border-radius: var(--radius-lg);
}

.skeleton__item--metric {
  height: 12.5rem;
  border-radius: var(--radius-lg);
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.85;
  }
}
```

`opacity`만 애니메이션한다.

- [ ] **Step 4: `ReasonBadge` 구현**

`src/components/ui/ReasonBadge.js`:

```javascript
import React from 'react';
import './ReasonBadge.css';

export const REASON_LABELS = {
  absent: '자리 비움',
  eyes_closed: '눈 감김',
  focused: '집중',
  head_turned: '고개 돌림',
  looking_down: '아래 보기',
  looking_up: '위 보기',
};

export function ReasonBadge({ reason, ratio }) {
  const label = REASON_LABELS[reason];
  if (!label) {
    return null;
  }

  return (
    <span className={`reason-badge reason-badge--${reason.replace(/_/g, '-')}`}>
      <span className="reason-badge__dot" aria-hidden="true" />
      <span className="reason-badge__label">{label}</span>
      {ratio !== undefined && ratio !== null && (
        <span className="reason-badge__ratio">{Math.round(ratio * 100)}%</span>
      )}
    </span>
  );
}

export default ReasonBadge;
```

`REASON_LABELS`에 없는 값이면 `null`을 반환한다. 판정 로직이 새 원인을 추가했는데 배지가 따라오지 않았을 때, 정체불명의 빈 배지를 그리는 것보다 아무것도 안 그리는 편이 낫다.

`src/components/ui/ReasonBadge.css`:

```css
.reason-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  color: var(--color-text);
  white-space: nowrap;
}

.reason-badge__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  background-color: var(--reason-color, var(--color-text-muted));
  flex-shrink: 0;
}

.reason-badge__ratio {
  font-family: var(--font-mono);
  letter-spacing: var(--tracking-data);
  color: var(--color-text-muted);
}

.reason-badge--focused {
  --reason-color: var(--color-reason-focused);
}
.reason-badge--looking-down {
  --reason-color: var(--color-reason-looking-down);
}
.reason-badge--head-turned {
  --reason-color: var(--color-reason-head-turned);
}
.reason-badge--looking-up {
  --reason-color: var(--color-reason-looking-up);
}
.reason-badge--eyes-closed {
  --reason-color: var(--color-reason-eyes-closed);
}
.reason-badge--absent {
  --reason-color: var(--color-reason-absent);
}
```

점 색은 보조 신호이고 **한글 라벨이 실제 정보 전달자**다. 색각 이상 사용자도 라벨만으로 구분할 수 있다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `CI=true npx react-scripts test --testPathPattern="Skeleton|ReasonBadge"`
Expected: PASS (10 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/components/ui/Skeleton.js src/components/ui/Skeleton.css src/components/ui/Skeleton.test.js src/components/ui/ReasonBadge.js src/components/ui/ReasonBadge.css src/components/ui/ReasonBadge.test.js
git commit -m "feat: Skeleton과 ReasonBadge 공용 컴포넌트 추가"
```

---

### Task 5: `Mypage` 개편

**Files:**
- Modify: `src/components/Mypage.js`
- Modify: `src/components/Mypage.css`

**Interfaces:**
- Consumes: `ScoreRing`·`focusLevel`(태스크 2), `Sparkline`(태스크 3), `Skeleton`(태스크 4), 태스크 1의 토큰 전부
- Produces: 없음 — 화면 종단

`Mypage.js`는 `react-router-dom`을 import 하므로 **Jest 테스트를 작성하지 않는다**(TS-003). 검증은 빌드 + 브라우저다.

- [ ] **Step 1: 현재 파일 읽기**

`src/components/Mypage.js`와 `src/components/Mypage.css`를 끝까지 읽는다. 기존 데이터 로딩 로직(`supabase.from(...).select(...)`), 상태 변수 이름, 라우팅 핸들러, 실제 CSS 클래스 이름을 파악한다. **이 태스크에서 쿼리·상태 로직을 바꾸지 않는다.** 이미 가져오는 데이터를 다르게 그릴 뿐이다.

아래 Step들의 JSX는 **패턴 예시**다. 클래스 이름과 변수 이름은 Step 1에서 읽은 실제 코드에 맞춘다.

기존 쿼리가 `timeline`을 select 하지 않는다면 `Sparkline`에 넘길 데이터가 없다. 그 경우 **스파크라인을 생략하고 점수 색상만 적용한 뒤, 보고서에 그 사실을 명시한다.** 쿼리에 컬럼을 추가하지 않는다 — Global Constraints가 금지한다.

- [ ] **Step 2: 로딩 상태를 `Skeleton`으로 교체**

현재 `isLoading`일 때 빈 `<div>`를 반환해 화면이 몇 초간 완전히 비어 고장난 것처럼 보인다. 실제 콘텐츠와 같은 자리·높이를 차지하도록 바꾼다:

```jsx
import Skeleton from './ui/Skeleton';

if (isLoading) {
  return (
    <div className="mypage">
      <main className="mypage__main">
        <Skeleton variant="metric" count={1} />
        <Skeleton variant="card" count={3} />
      </main>
    </div>
  );
}
```

바깥 래퍼 클래스는 실제 렌더 트리의 것과 일치시켜야 로드 완료 시 레이아웃이 튀지 않는다.

- [ ] **Step 3: 최상단 요약 헤로 추가**

화면에서 가장 큰 요소가 집중도 수치여야 한다. 이미 가져온 세션 목록에서 요약값을 계산해 `ScoreRing`(`size="lg"`)으로 표시하고, 학습 시간·세션 수를 그 옆에 작게 둔다.

```jsx
import ScoreRing from './ui/ScoreRing';

<section className="mypage__summary" aria-labelledby="mypage-summary-heading">
  <h2 id="mypage-summary-heading" className="mypage__summary-title">
    오늘의 집중
  </h2>
  {sessions.length === 0 ? (
    <p className="mypage__summary-empty">첫 세션을 시작해보세요</p>
  ) : (
    <div className="mypage__summary-body">
      <ScoreRing value={summaryScore} size="lg" />
      <dl className="mypage__summary-stats">
        <div>
          <dt>학습 시간</dt>
          <dd>{formatDuration(totalSeconds)}</dd>
        </div>
        <div>
          <dt>세션</dt>
          <dd>{sessions.length}</dd>
        </div>
      </dl>
    </div>
  )}
</section>
```

빈 상태는 **같은 자리**에 둔다. 데이터 유무에 따라 레이아웃이 재배치되면 안 된다. 통계 수치는 `--font-mono` + `--tracking-data`로 렌더한다.

- [ ] **Step 4: 최근 기록에 색과 추이 적용**

지금은 `2026. 8. 5. · 0%`와 `· 100%`가 시각적으로 완전히 동일하다. 점수에 `focusLevel` 기반 색과 모노스페이스를 적용하고, `timeline`이 있으면 `Sparkline`을 붙인다.

```jsx
import { focusLevel } from './ui/ScoreRing';
import Sparkline from './ui/Sparkline';

<span
  className={`mypage__record-score mypage__record-score--${focusLevel(
    session.focus_score
  )}`}
>
  {session.focus_score}%
</span>
{session.timeline?.length > 0 && (
  <Sparkline data={session.timeline.map((b) => b.focus_ratio)} />
)}
```

```css
.mypage__record-score {
  font-family: var(--font-mono);
  letter-spacing: var(--tracking-data);
  font-variant-numeric: tabular-nums;
}
.mypage__record-score--high { color: var(--color-focus-high); }
.mypage__record-score--mid  { color: var(--color-focus-mid); }
.mypage__record-score--low  { color: var(--color-focus-low); }
.mypage__record-score--poor { color: var(--color-focus-poor); }
```

- [ ] **Step 5: 간격으로 위계를 만들고 빠른 실행을 축소**

- 섹션 사이는 `var(--space-12)`, 섹션 내부 관련 요소는 `var(--space-2)`~`var(--space-4)`. **모든 곳에 같은 패딩을 주지 않는다**
- 빠른 실행 4개 카드가 최근 기록과 같은 비중을 차지할 이유가 없다. 아이콘 + 라벨의 작은 행으로 줄인다. 단 **터치 대상은 `min-height: 44px`를 유지**한다
- 최근 기록은 좁은 화면에서 1열로 떨어뜨린다: `grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr))`. `min(100%, ...)`가 없으면 320px에서 가로 스크롤이 생긴다
- 상단 AI 상태 카드의 링에 호흡 애니메이션을 넣는다 — `opacity`/`transform`만:

```css
@keyframes mypage-breathe {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50%      { opacity: 1;    transform: scale(1.04); }
}
.mypage__ai-ring {
  animation: mypage-breathe 3s var(--ease-in-out) infinite;
}
```

- [ ] **Step 6: 빌드 및 기존 테스트 확인**

Run: `npm run build`
Expected: 컴파일 성공

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS — 기존 테스트가 깨지지 않아야 한다

- [ ] **Step 7: 브라우저 확인**

`npm start` 후 `/mypage`에서:
- 로딩 중 스켈레톤이 보이고, 로드 완료 시 레이아웃이 튀지 않는다
- 점수가 다른 세션들이 서로 다른 색으로 보인다
- 320 / 768 / 1440 폭에서 가로 스크롤이 없다

- [ ] **Step 8: 커밋**

```bash
git add src/components/Mypage.js src/components/Mypage.css
git commit -m "feat: Mypage에 계측 장비 디자인 적용"
```

---

### Task 6: `Save` 개편

**Files:**
- Modify: `src/components/Save.js`
- Modify: `src/components/Save.css`

**Interfaces:**
- Consumes: `focusLevel`(태스크 2), `Sparkline`(태스크 3), `Skeleton`(태스크 4)
- Produces: 태스크 7이 이 화면의 시각 언어(행 레이아웃, 점수 표기, hover 처리)를 그대로 따른다. 클래스 이름과 구조를 일관되게 만든다

`react-router-dom`을 import 하므로 Jest 테스트를 작성하지 않는다.

- [ ] **Step 1: 현재 파일 읽기**

`src/components/Save.js`, `src/components/Save.css`를 끝까지 읽는다. 쿼리가 `timeline`을 select 하는지 확인한다. 하지 않으면 태스크 5와 같은 규칙을 따른다 — 스파크라인을 생략하고 보고한다. **쿼리를 수정하지 않는다.** 아래 JSX는 패턴 예시이며 클래스·변수 이름은 실제 코드에 맞춘다.

- [ ] **Step 2: 로딩 시 `Skeleton` 렌더**

```jsx
import Skeleton from './ui/Skeleton';

if (isLoading) {
  return (
    <div className="save">
      <main className="save__main">
        <Skeleton variant="card" count={3} />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: 각 행에 점수 색 + 모노스페이스 + 스파크라인**

점수를 모노스페이스로 렌더해 **자릿수가 달라도 세로로 정렬되게** 한다. `0%`, `7%`, `100%`가 뒤섞여도 열이 흔들리지 않아야 한다.

```jsx
import { focusLevel } from './ui/ScoreRing';
import Sparkline from './ui/Sparkline';

<span className={`save__score save__score--${focusLevel(session.focus_score)}`}>
  {session.focus_score}%
</span>
{session.timeline?.length > 0 && (
  <Sparkline
    data={session.timeline.map((b) => b.focus_ratio)}
    width={72}
    height={20}
  />
)}
```

```css
.save__score {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  letter-spacing: var(--tracking-data);
  font-variant-numeric: tabular-nums;
  min-width: 4ch;
  text-align: right;
  display: inline-block;
}
.save__score--high { color: var(--color-focus-high); }
.save__score--mid  { color: var(--color-focus-mid); }
.save__score--low  { color: var(--color-focus-low); }
.save__score--poor { color: var(--color-focus-poor); }
```

정렬은 `min-width: 4ch` + `text-align: right`로 만든다. 문자열에 공백을 채워 넣지 않는다 — HTML이 공백을 접어 정렬이 깨지고, 스크린리더가 값을 이상하게 읽는다.

- [ ] **Step 4: 행 hover / focus-visible 상태**

```css
.save__row {
  transition: transform var(--duration-fast) var(--ease-out-expo),
    border-color var(--duration-fast) var(--ease-out-expo);
}
.save__row:hover {
  transform: translateY(-2px);
  border-color: var(--color-border-strong);
}
.save__row:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

기존에 `:focus-visible` 스타일이 있으면 지우지 않는다. `transform`과 `border-color`만 전이시킨다.

- [ ] **Step 5: 빌드 및 테스트 확인**

Run: `npm run build`
Expected: 컴파일 성공

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS

- [ ] **Step 6: 브라우저 확인**

`/save`에서 점수 색이 구간별로 다르고, 자릿수가 다른 점수들이 세로로 정렬되며, 320px에서 가로 스크롤이 없는지 확인한다.

- [ ] **Step 7: 커밋**

```bash
git add src/components/Save.js src/components/Save.css
git commit -m "feat: Save 목록에 계측 장비 디자인 적용"
```

---

### Task 7: `Trash` / `Trashread` 개편

**Files:**
- Modify: `src/components/Trash.js`, `src/components/Trash.css`
- Modify: `src/components/Trashread.js`, `src/components/TrashDetail.css`

**Interfaces:**
- Consumes: 태스크 6이 `Save`에 세운 행 레이아웃·점수 표기·hover 패턴, `Skeleton`(태스크 4), `focusLevel`(태스크 2)
- Produces: 없음 — 화면 종단

`react-router-dom`을 import 하므로 Jest 테스트를 작성하지 않는다.

- [ ] **Step 1: 현재 파일과 태스크 6 결과 읽기**

`Trash.js`, `Trash.css`, `Trashread.js`, `TrashDetail.css`, 그리고 태스크 6에서 완성된 `Save.js`/`Save.css`를 읽는다. `Save`의 시각 언어를 그대로 가져오되 삭제된 항목임이 드러나야 한다. 아래 JSX·CSS는 패턴 예시이며 클래스 이름은 실제 코드에 맞춘다.

- [ ] **Step 2: 삭제된 항목의 채도 낮추기**

```css
.trash__row {
  opacity: 0.8;
  transition: opacity var(--duration-fast) var(--ease-out-expo),
    transform var(--duration-fast) var(--ease-out-expo);
}
.trash__row:hover,
.trash__row:focus-within {
  opacity: 1;
  transform: translateY(-2px);
}
```

`opacity`만 쓴다. 점수 색 토큰은 `Save`와 동일하게 유지한다 — 삭제 항목이라고 다른 색 체계를 쓰면 학습된 의미가 깨진다.

**`opacity` 값이 본문 대비비 4.5:1을 깨뜨리지 않는지 확인한다.** 미달이면 값을 올린다. 대비비 기준이 시각 효과보다 우선한다.

- [ ] **Step 3: 만료 임박도를 색으로 표현**

"N일 후 자동 삭제"에서 남은 일수가 적을수록 긴급해 보이게 한다. **색만으로 전달하지 않는다 — 남은 일수 텍스트가 항상 함께 있다.**

```jsx
const expiryLevel = (daysLeft) => {
  if (daysLeft <= 3) return 'poor';
  if (daysLeft <= 7) return 'low';
  return 'mid';
};

<span className={`trash__expiry trash__expiry--${expiryLevel(daysLeft)}`}>
  {daysLeft}일 후 자동 삭제
</span>
```

```css
.trash__expiry {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  letter-spacing: var(--tracking-data);
}
.trash__expiry--mid  { color: var(--color-focus-mid); }
.trash__expiry--low  { color: var(--color-focus-low); }
.trash__expiry--poor { color: var(--color-focus-poor); }
```

남은 일수 계산 로직이 이미 있으면 그것을 쓴다. **새로 만들지 않는다.**

- [ ] **Step 4: 로딩 시 `Skeleton`**

두 화면 모두 `isLoading` 분기를 `Skeleton`으로 바꾼다. `Trash`는 `variant="card" count={3}`, `Trashread`는 화면 구조에 맞춰 조합한다.

- [ ] **Step 5: 빌드 및 테스트 확인**

Run: `npm run build`
Expected: 컴파일 성공

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS

- [ ] **Step 6: 브라우저 확인**

`/trash`와 휴지통 상세에서 삭제 항목이 흐리게 보이되 읽을 수 있고, 만료 임박 항목이 눈에 띄며, 320px에서 가로 스크롤이 없는지 확인한다.

- [ ] **Step 7: 커밋**

```bash
git add src/components/Trash.js src/components/Trash.css src/components/Trashread.js src/components/TrashDetail.css
git commit -m "feat: 휴지통 화면에 계측 장비 디자인 적용"
```

---

### Task 8: `Home` 개편

**Files:**
- Modify: `src/components/Home.js`
- Modify: `src/components/Home.css`

**Interfaces:**
- Consumes: `ScoreRing`(태스크 2), `Sparkline`(태스크 3), 태스크 1의 토큰
- Produces: 없음 — 화면 종단

`react-router-dom`을 import 하므로 Jest 테스트를 작성하지 않는다.

- [ ] **Step 1: 현재 파일 읽기**

`src/components/Home.js`, `src/components/Home.css`를 끝까지 읽는다. 히어로의 영문 대형 타이포와 하단 카드 3개의 현재 구조, 참조 중인 이미지 파일명을 파악한다. 아래 JSX·CSS는 패턴 예시이며 클래스 이름은 실제 코드에 맞춘다.

- [ ] **Step 2: 히어로 하단 이미지를 제품 미리보기로 교체**

스톡 이미지를 지우고 그 자리에 `ScoreRing` + `Sparkline`을 더미 데이터로 정적 렌더한다. 첫 화면에서 계측 장비 성격이 드러나야 한다.

```jsx
import ScoreRing from './ui/ScoreRing';
import Sparkline from './ui/Sparkline';

const PREVIEW_TREND = [0.4, 0.62, 0.55, 0.78, 0.83, 0.71, 0.9, 0.86];

<figure className="home__preview">
  <ScoreRing value={82} size="lg" label="종합 집중도" />
  <Sparkline
    data={PREVIEW_TREND}
    width={280}
    height={64}
    ariaLabel="시간대별 집중도 추이 예시"
  />
  <figcaption className="home__preview-caption">
    리포트 화면 예시입니다
  </figcaption>
</figure>
```

미리보기임이 드러나야 한다 — 실제 사용자 데이터로 오해되지 않도록 캡션을 반드시 둔다.

교체 후 **더 이상 참조되지 않는 이미지 파일이 생기면 삭제하지 말고 보고서에 목록으로 남긴다.** 다른 화면이 같은 파일을 쓰고 있을 수 있다.

- [ ] **Step 3: 하단 3개 균일 카드를 비균일 구성으로**

집중도 분석 카드가 가장 크고 나머지는 작게. CSS Grid로:

```css
.home__features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--space-6);
}
.home__feature {
  border-radius: var(--radius-md);
  padding: var(--space-6);
}
.home__feature--primary {
  grid-column: span 2;
  border-radius: var(--radius-lg);
  padding: var(--space-8);
}
@media (max-width: 767px) {
  .home__feature--primary {
    grid-column: span 1;
  }
}
```

`minmax(min(100%, 18rem), 1fr)`에서 `min(100%, ...)`가 없으면 320px에서 가로 스크롤이 생긴다. 카드마다 반경·패딩을 동일하게 주지 않는다.

- [ ] **Step 4: 스크롤 진입 모션**

`IntersectionObserver`만 쓴다. **스크롤 이벤트 핸들러를 쓰지 않는다.**

```jsx
import { useEffect, useRef } from 'react';

function useRevealOnScroll() {
  const ref = useRef(null);

  useEffect(() => {
    const targets = ref.current?.querySelectorAll('[data-reveal]');
    if (!targets || targets.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  return ref;
}
```

`Home` 컴포넌트에서 `const revealRef = useRevealOnScroll();`로 쓰고 최상위 요소에 `ref={revealRef}`를 건다. 나타나게 할 요소에는 `data-reveal` 속성을 붙인다.

```css
[data-reveal] {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity var(--duration-slow) var(--ease-out-expo),
    transform var(--duration-slow) var(--ease-out-expo);
}
[data-reveal].is-revealed {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  [data-reveal] {
    opacity: 1;
    transform: none;
  }
}
```

`prefers-reduced-motion` 블록이 **여기서 별도로 필요한 이유**: `tokens.css`의 전역 블록은 duration만 0.01ms로 줄인다. 그것만으로는 `is-revealed`가 붙기 전 요소가 `opacity: 0`이라 보이지 않는다. `IntersectionObserver`가 어떤 이유로든 콜백을 호출하지 않으면 콘텐츠가 영구히 숨는다 — 초기 상태 자체를 무력화해야 안전하다.

- [ ] **Step 5: 빌드 및 테스트 확인**

Run: `npm run build`
Expected: 컴파일 성공

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS

- [ ] **Step 6: 브라우저 확인**

`/`에서:
- 히어로 아래에 링과 스파크라인이 보인다
- 스크롤 시 하단 카드가 나타난다
- 320 / 375 / 768 / 1024 / 1440에서 가로 스크롤이 없다
- OS 설정에서 "동작 줄이기"를 켠 뒤 새로고침하면 모든 콘텐츠가 즉시 보인다

- [ ] **Step 7: 커밋**

```bash
git add src/components/Home.js src/components/Home.css
git commit -m "feat: Home에 계측 장비 디자인 적용"
```

---

## 최종 검증 (전체 태스크 완료 후, 컨트롤러가 수행)

설계 문서의 검증 항목을 브랜치 단위로 확인한다.

- 320 / 375 / 768 / 1024 / 1440에서 Mypage·Save·Trash·Trashread·Home 스크린샷, 가로 스크롤 없음
- 집중도 0% / 50% / 100% 세 경우에 `ScoreRing`과 점수 색이 서로 다르게 보이는지 (설계 문서 배경 2번 문제 해소)
- 데이터가 없는 계정에서 각 화면의 빈 상태 확인
- 네트워크를 느리게 제한한 상태로 Mypage·Save 진입 → `Skeleton` 노출, 로드 완료 시 레이아웃 튐 없음 (배경 4번 문제 해소)
- 키보드만으로 전체 플로우 수행, 모든 요소에서 포커스 링 보임
- `prefers-reduced-motion: reduce`에서 애니메이션 정지, Home 콘텐츠가 숨지 않음
- 신규 색 조합 대비비 측정: 본문 4.5:1, 큰 텍스트 3:1, UI 경계·아이콘 3:1
- 브라우저 확대 200%에서 레이아웃 유지
- `npm run build` 성공 및 번들 크기 증가폭 확인 (차트 라이브러리 미도입 확인)
- **`Read.js`, `StartLearning.js`가 diff에 포함되지 않았는지 확인** — 범위 밖이다
