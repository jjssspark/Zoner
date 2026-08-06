# 빠른 실행 HUD 타일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mypage의 "빠른 실행"을 작은 알약 4개에서 HUD 질감의 큰 2×2 타일 4개로 재설계하고, 이미 로드된 세션 데이터로 각 타일에 살아있는 보조 정보를 붙인다.

**Architecture:** 순수 계산 함수를 `src/lib/quickActions.js`로 분리해 `react-router-dom` 없이 테스트한다(이 저장소의 Jest 리졸버 제약 회피). `Mypage.js`는 그 함수를 호출해 모듈 스코프 `QuickActionTile` 컴포넌트에 값을 넘긴다. 시각 효과는 전부 CSS 의사요소로 구현하며 새 JS 의존성이 없다.

**Tech Stack:** React 18 (CRA), CSS 커스텀 프로퍼티, Jest

**Spec:** `docs/superpowers/specs/2026-08-06-zoner-quick-actions-design.md`

## Global Constraints

- **새 토큰을 만들지 않는다.** `src/styles/tokens.css`는 수정 금지. 기존 의미 토큰만 조합한다.
- **Supabase 쿼리 변경은 Task 2에 명시된 count 쿼리 추가 하나로 제한한다.** 기존 세션 쿼리의 select/order/limit은 그대로 둔다. 다른 테이블·다른 컬럼을 추가하지 않는다.
- **다른 화면을 건드리지 않는다.** Home, Save, Trash, Trashread, StartLearning, AiChat 파일은 diff에 나타나면 안 된다.
- **컴포넌트에 하드코딩된 색을 쓰지 않는다.** 모든 색은 `var(--color-*)` 참조. 단 격자 텍스처의 알파 조정은 예외로 허용한다(아래 Task 3에 정확한 값이 있다).
- **애니메이션은 `transform`·`opacity`·`filter`만.** `width`/`height`/`top`/`left`/`margin`/`padding`은 애니메이션 금지.
- `:hover`와 `:focus-visible`은 **동일한** 시각 효과를 발동해야 한다.
- `prefers-reduced-motion: reduce`에서 스캔 라인은 비활성, 브래킷은 이동 없이 나타나기만 한다.
- **`recentSessions`는 `.limit(3)`이 걸려 있다.** `recentSessions.length`를 총 세션 수로 쓰면 안 된다.
- 테스트 실행은 `CI=true npx react-scripts test --watchAll=false`. 빌드 확인은 `npx react-scripts build` (`CI=true`는 기존 `UserGuide.js` lint 부채로 실패하므로 쓰지 않는다).
- 커밋 메시지는 한국어, conventional commit 형식. Co-Authored-By 등 attribution 푸터를 붙이지 않는다.

## File Structure

| 파일 | 책임 |
|---|---|
| `src/lib/quickActions.js` (신규) | 세션 배열 → 타일 보조 문구/등급 계산. 순수 함수만. React·router import 없음 |
| `src/lib/quickActions.test.js` (신규) | 위 함수의 단위 테스트 |
| `src/components/Mypage.js` (수정) | `QUICK_ACTIONS` 상수 확장, `QuickActionTile` 모듈 스코프 컴포넌트 추가, 빠른 실행 섹션 마크업 교체 |
| `src/components/Mypage.css` (수정) | `.quick-action*` 규칙을 타일 + HUD 효과로 교체 |

---

### Task 1: 보조 문구 계산 함수

**Files:**
- Create: `src/lib/quickActions.js`
- Test: `src/lib/quickActions.test.js`

**Interfaces:**
- Consumes: `focusLevel` from `src/components/ui/ScoreRing.js` — 이미 존재한다. `export function focusLevel(value)`, 0~100 숫자를 받아 `'high'|'mid'|'low'|'poor'`를 반환한다. 경계는 `>=80 high`, `>=50 mid`, `>=30 low`, 그 미만 `poor`.
- Produces:
  - `buildQuickActionMeta(recentSessions, totalSessions)` → `{ startLearning: {text, level}, records: {text, level} }`
    - `recentSessions`: 세션 배열 또는 `undefined`
    - `totalSessions`: 총 세션 수(정수) 또는 `null`(쿼리 실패·미도착)
    - `level`은 `'high'|'mid'|'low'|'poor'|null`. `null`이면 강조색 없이 muted로 렌더한다.
    - `records.level`은 항상 `null`이다. 총계에는 집중도 등급 개념이 없다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/lib/quickActions.test.js` 전체 내용:

```javascript
import { buildQuickActionMeta } from './quickActions';

const session = (score) => [
  { id: 'a', started_at: '2026-08-05T13:20:00.000Z', focus_score: score },
];

describe('buildQuickActionMeta — 학습 시작 타일', () => {
  test('세션이 없으면 빈 상태 문구를 쓴다', () => {
    expect(buildQuickActionMeta([], 0).startLearning).toEqual({
      text: '첫 세션을 시작하세요',
      level: null,
    });
  });

  test('recentSessions가 undefined여도 빈 상태로 처리한다', () => {
    expect(buildQuickActionMeta(undefined, null).startLearning.level).toBeNull();
  });

  test('가장 최근 세션의 점수를 쓴다', () => {
    const meta = buildQuickActionMeta(
      [
        { id: 'a', started_at: '2026-08-05T13:20:00.000Z', focus_score: 82 },
        { id: 'b', started_at: '2026-08-01T09:00:00.000Z', focus_score: 40 },
      ],
      2
    );
    expect(meta.startLearning).toEqual({ text: '마지막 세션 82%', level: 'high' });
  });

  test('점수를 focusLevel 경계대로 등급화한다', () => {
    const at = (score) => buildQuickActionMeta(session(score), 1).startLearning.level;
    expect(at(80)).toBe('high');
    expect(at(79)).toBe('mid');
    expect(at(50)).toBe('mid');
    expect(at(49)).toBe('low');
    expect(at(30)).toBe('low');
    expect(at(29)).toBe('poor');
  });

  test('focus_score가 null이면 빈 상태로 떨어진다', () => {
    expect(buildQuickActionMeta(session(null), 1).startLearning).toEqual({
      text: '첫 세션을 시작하세요',
      level: null,
    });
  });

  test('점수를 정수로 반올림한다', () => {
    expect(buildQuickActionMeta(session(82.6), 1).startLearning.text).toBe(
      '마지막 세션 83%'
    );
  });
});

describe('buildQuickActionMeta — 학습 기록 타일', () => {
  test('총 세션 수를 그대로 쓴다', () => {
    expect(buildQuickActionMeta(session(82), 34).records).toEqual({
      text: '총 34세션',
      level: null,
    });
  });

  test('0이면 빈 상태 문구를 쓴다', () => {
    expect(buildQuickActionMeta([], 0).records.text).toBe('아직 기록이 없습니다');
  });

  test('count가 null이면 중립 문구로 떨어진다', () => {
    expect(buildQuickActionMeta(session(82), null).records.text).toBe('기록 전체 보기');
  });

  test('count가 undefined여도 중립 문구로 떨어진다', () => {
    expect(buildQuickActionMeta(session(82), undefined).records.text).toBe(
      '기록 전체 보기'
    );
  });

  test('recentSessions가 3건으로 잘려 있어도 총계를 따른다', () => {
    // recentSessions는 .limit(3)이 걸려 있으므로 length를 총계로 쓰면 안 된다.
    const three = [
      { id: 'a', started_at: '2026-08-05T00:00:00.000Z', focus_score: 82 },
      { id: 'b', started_at: '2026-08-04T00:00:00.000Z', focus_score: 60 },
      { id: 'c', started_at: '2026-08-03T00:00:00.000Z', focus_score: 40 },
    ];
    expect(buildQuickActionMeta(three, 34).records.text).toBe('총 34세션');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `CI=true npx react-scripts test src/lib/quickActions --watchAll=false`
Expected: FAIL — "Cannot find module './quickActions'"

- [ ] **Step 3: 최소 구현을 작성한다**

`src/lib/quickActions.js` 전체 내용:

```javascript
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
```

- [ ] **Step 4: 통과를 확인한다**

Run: `CI=true npx react-scripts test src/lib/quickActions --watchAll=false`
Expected: PASS — 11 tests

- [ ] **Step 5: 전체 스위트가 여전히 초록인지 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 8 스위트 전부 PASS, 80 tests (기존 69 + 신규 11). 실패 스위트가 있으면 멈추고 보고한다.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/quickActions.js src/lib/quickActions.test.js
git commit -m "feat: 빠른 실행 타일 보조 문구 계산 함수 추가"
```

---

### Task 2: 타일 마크업

**Files:**
- Modify: `src/components/Mypage.js` — `QUICK_ACTIONS` 상수(8-13행), 빠른 실행 섹션(244-266행)

**Interfaces:**
- Consumes: `buildQuickActionMeta(recentSessions)` from Task 1. 반환값은 `{ startLearning: {text, level}, records: {text, level} }`이고 `level`은 `'high'|'mid'|'low'|'poor'|null`이다.
- Produces: Task 3의 CSS가 붙을 클래스 계약 —
  - `.quick-actions__grid` (컨테이너)
  - `.quick-action` (타일 `<button>`)
  - `.quick-action__scan` (스캔 라인, 장식)
  - `.quick-action__icon` (아이콘 글리프, 장식)
  - `.quick-action__label` (라벨)
  - `.quick-action__meta` (보조 문구)
  - `.quick-action__meta--high` / `--mid` / `--low` / `--poor` (등급 색상, `level`이 있을 때만 추가)

**주의:** 기존 클래스명 `.quick-actions__list`를 `.quick-actions__grid`로 바꾼다. CSS는 Task 3에서 교체하므로 **이 태스크 직후에는 스타일이 깨져 보이는 것이 정상이다.** 그것을 이유로 CSS를 미리 손대지 마라.

- [ ] **Step 1: `QUICK_ACTIONS` 상수를 교체한다**

`src/components/Mypage.js` 8-13행을 아래로 교체:

```javascript
const QUICK_ACTIONS = [
  { label: 'AI 채팅', path: '/ai-chat', icon: '◈', metaKey: null, staticMeta: '학습 도우미와 대화' },
  { label: '학습 시작', path: '/start-learning', icon: '▶', metaKey: 'startLearning', staticMeta: null },
  { label: '학습 기록', path: '/save', icon: '◉', metaKey: 'records', staticMeta: null },
  { label: '휴지통', path: '/trash', icon: '⌦', metaKey: null, staticMeta: '삭제한 기록 복구' },
];
```

- [ ] **Step 2: import를 추가한다**

상단 import 블록에서 `import Skeleton from './ui/Skeleton';` **다음 줄**에 추가:

```javascript
import { buildQuickActionMeta } from '../lib/quickActions';
```

- [ ] **Step 3: `QuickActionTile` 컴포넌트를 모듈 스코프에 추가한다**

기존 `MypageTopbar` 함수 정의 **바로 위**에 삽입한다(이 파일은 이미 `MypageTopbar`를 모듈 스코프에 두는 관례를 쓴다):

```javascript
// 장식 요소(스캔 라인·아이콘)는 aria-hidden으로 빼고, 보조 문구는 aria-label에
// 합성해 넣는다. 그러지 않으면 스크린리더가 라벨과 수치를 별개 조각으로 읽는다.
function QuickActionTile({ action, meta, onSelect }) {
  const metaText = action.staticMeta || (meta ? meta.text : '');
  const level = meta ? meta.level : null;
  const metaClass = level
    ? `quick-action__meta quick-action__meta--${level}`
    : 'quick-action__meta';

  return (
    <button
      type="button"
      className="quick-action"
      onClick={onSelect}
      aria-label={metaText ? `${action.label}, ${metaText}` : action.label}
    >
      <span className="quick-action__scan" aria-hidden="true" />
      <span className="quick-action__icon" aria-hidden="true">
        {action.icon}
      </span>
      <span className="quick-action__label">{action.label}</span>
      {metaText && <span className={metaClass}>{metaText}</span>}
    </button>
  );
}
```

- [ ] **Step 4: 총 세션 수 state를 추가한다**

`recentSessions` state 선언 바로 아래에 추가한다:

```javascript
  const [totalSessions, setTotalSessions] = useState(null);
```

- [ ] **Step 5: count 쿼리를 기존 세션 쿼리와 병렬로 묶는다**

`Mypage.js:70-75`의 세션 쿼리 블록을 아래로 교체한다. **기존 쿼리의 select/order/limit은 한 글자도 바꾸지 않는다** — `Promise.all`로 감싸고 count 쿼리를 나란히 붙이기만 한다. 순차 await로 쓰면 왕복이 하나 늘어난다.

```javascript
      const [{ data: sessions }, { count: sessionCount }] = await Promise.all([
        supabase
          .from('active_study_sessions')
          .select('id, started_at, focus_score')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(3),
        supabase
          .from('active_study_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);
```

그리고 바로 아래 `if (isMounted) { … }` 블록에 한 줄을 추가한다:

```javascript
        setTotalSessions(typeof sessionCount === 'number' ? sessionCount : null);
```

- [ ] **Step 6: `quickActionMeta`를 컴포넌트 본문에서 계산한다**

`Mypage` 컴포넌트 본문 안, `return (` 직전에 추가한다. 두 state 선언 이후여야 한다:

```javascript
  const quickActionMeta = buildQuickActionMeta(recentSessions, totalSessions);
```

- [ ] **Step 7: 빠른 실행 섹션 마크업을 교체한다**

244-266행의 `<section aria-labelledby="quick-actions-heading" …>` 블록 전체를 아래로 교체:

```jsx
        <section
          aria-labelledby="quick-actions-heading"
          className="quick-actions"
        >
          <h2 id="quick-actions-heading" className="record-section__title">
            빠른 실행
          </h2>
          <div className="quick-actions__grid">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionTile
                key={action.path}
                action={action}
                meta={action.metaKey ? quickActionMeta[action.metaKey] : null}
                onSelect={() => navigate(action.path)}
              />
            ))}
          </div>
        </section>
```

- [ ] **Step 8: 테스트와 빌드를 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 8 스위트 PASS, 80 tests (마크업 변경이 순수 함수 테스트를 깨지 않아야 한다)

Run: `npx react-scripts build`
Expected: "Compiled successfully" (warning은 허용, error는 불가)

- [ ] **Step 9: 커밋**

```bash
git add src/components/Mypage.js
git commit -m "feat: 빠른 실행을 HUD 타일 마크업으로 교체"
```

---

### Task 3: HUD 스타일

**Files:**
- Modify: `src/components/Mypage.css` — `.quick-actions*` 규칙 (462-507행)

**Interfaces:**
- Consumes: Task 2가 만든 클래스 계약 (`.quick-actions__grid`, `.quick-action`, `.quick-action__scan`, `.quick-action__icon`, `.quick-action__label`, `.quick-action__meta`, `.quick-action__meta--high|--mid|--low|--poor`)
- Produces: 없음 (최종 태스크)

- [ ] **Step 1: 기존 규칙을 교체한다**

`src/components/Mypage.css`의 462행 `.quick-actions {`부터 507행 `.quick-action:hover .quick-action__icon { … }`의 닫는 중괄호까지를 아래 전체로 교체:

```css
.quick-actions {
  margin-bottom: var(--space-12);
}

.quick-actions__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
  max-width: 720px;
}

.quick-action {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: 140px;
  padding: var(--space-6);
  background-color: var(--color-surface);
  background-image: repeating-linear-gradient(
      0deg,
      oklch(75% 0.14 200 / 0.03) 0 1px,
      transparent 1px 24px
    ),
    repeating-linear-gradient(
      90deg,
      oklch(75% 0.14 200 / 0.03) 0 1px,
      transparent 1px 24px
    );
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--duration-normal) var(--ease-out-expo),
    transform var(--duration-normal) var(--ease-out-expo);
}

/* 코너 브래킷 — 두 의사요소가 각각 대각선 두 모서리를 그린다.
   호버 시 translate로 바깥으로 벌어져 "조준선이 잠기는" 인상을 만든다. */
.quick-action::before,
.quick-action::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: var(--color-accent);
  border-style: solid;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out-expo),
    transform var(--duration-normal) var(--ease-out-expo);
}

.quick-action::before {
  top: 8px;
  left: 8px;
  border-width: 1px 0 0 1px;
}

.quick-action::after {
  right: 8px;
  bottom: 8px;
  border-width: 0 1px 1px 0;
}

.quick-action:hover,
.quick-action:focus-visible {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.quick-action:hover::before,
.quick-action:focus-visible::before {
  opacity: 1;
  transform: translate(-4px, -4px);
}

.quick-action:hover::after,
.quick-action:focus-visible::after {
  opacity: 1;
  transform: translate(4px, 4px);
}

.quick-action:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* 스캔 라인 — 호버당 1회만 통과한다. 상시 반복하면 타일 4개가 계속
   움직여 정작 집중도 요약에서 시선을 뺏는다. */
/* 요소를 타일 높이 전체(height: 100%)로 두고 2px 밴드는 배경으로 그린다.
   그래야 translateY(100%)가 "타일 높이만큼"이 되어, 타일이 min-height보다
   커져도 스캔이 중간에 멈추지 않는다. 고정 px를 쓰면 그 지점에서 끊긴다. */
.quick-action__scan {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: linear-gradient(
    90deg,
    transparent,
    var(--color-accent),
    transparent
  );
  background-size: 100% 2px;
  background-repeat: no-repeat;
  background-position: 0 0;
  opacity: 0;
  transform: translateY(-100%);
  pointer-events: none;
}

.quick-action:hover .quick-action__scan,
.quick-action:focus-visible .quick-action__scan {
  animation: quick-action-scan var(--duration-slow) var(--ease-out-expo) 1;
}

@keyframes quick-action-scan {
  0% {
    opacity: 0;
    transform: translateY(-2px);
  }
  15% {
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(100%);
  }
}

.quick-action__icon {
  font-size: var(--text-2xl);
  line-height: 1;
  color: var(--color-accent);
  transition: filter var(--duration-normal) var(--ease-out-expo),
    transform var(--duration-normal) var(--ease-out-expo);
}

.quick-action:hover .quick-action__icon,
.quick-action:focus-visible .quick-action__icon {
  filter: drop-shadow(0 0 6px var(--color-accent));
  transform: scale(1.08);
}

.quick-action__label {
  margin-top: auto;
  font-size: var(--text-lg);
  font-weight: 600;
}

.quick-action__meta {
  margin-top: var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.quick-action__meta--high {
  color: var(--color-focus-high);
}

.quick-action__meta--mid {
  color: var(--color-focus-mid);
}

.quick-action__meta--low {
  color: var(--color-focus-low);
}

.quick-action__meta--poor {
  color: var(--color-focus-poor);
}

@media (max-width: 480px) {
  .quick-actions__grid {
    grid-template-columns: 1fr;
  }
}

/* 정보는 유지하고 움직임만 제거한다. 브래킷이 나타나는 것 자체는
   호버/포커스 상태를 알리는 신호이므로 없애지 않는다. */
@media (prefers-reduced-motion: reduce) {
  .quick-action:hover,
  .quick-action:focus-visible {
    transform: none;
  }

  .quick-action:hover::before,
  .quick-action:focus-visible::before,
  .quick-action:hover::after,
  .quick-action:focus-visible::after {
    transform: none;
  }

  .quick-action:hover .quick-action__scan,
  .quick-action:focus-visible .quick-action__scan {
    animation: none;
    opacity: 0;
  }

  .quick-action:hover .quick-action__icon,
  .quick-action:focus-visible .quick-action__icon {
    transform: none;
  }
}
```

- [ ] **Step 2: 옛 클래스명이 남지 않았는지 확인한다**

Run: `grep -rn "quick-actions__list" src/`
Expected: 결과 0건. 남아 있으면 Task 2의 교체가 불완전한 것이므로 고친다.

Run: `grep -c "quick-action" src/components/Mypage.css`
Expected: 1 이상. CSS의 모든 `.quick-action*` 선택자가 `Mypage.js`에서 실제로 쓰이는 클래스와 대응해야 한다.

- [ ] **Step 3: 테스트와 빌드를 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 8 스위트 PASS, 80 tests

Run: `npx react-scripts build`
Expected: "Compiled successfully"

- [ ] **Step 4: 커밋**

```bash
git add src/components/Mypage.css
git commit -m "feat: 빠른 실행 타일에 HUD 스캔·코너 브래킷 적용"
```

---

## 최종 검증 (컨트롤러가 직접 수행)

dev 서버 `http://localhost:3000/mypage`에서 확인한다.

1. **호버와 키보드 포커스가 같은 효과를 낸다.** Tab으로 타일에 도달했을 때 브래킷·스캔·글로우가 마우스 호버와 동일하게 나오는지.
2. **`prefers-reduced-motion: reduce`에서** 스캔이 멈추고 브래킷은 여전히 나타나는지. 브래킷까지 사라지면 호버 신호가 통째로 없어진 것이므로 실패다.
3. **빈 상태.** 세션 0건일 때 "첫 세션을 시작하세요" / "아직 기록이 없습니다"가 나오고 `undefined`가 새지 않는지.
4. **`aria-label` 합성.** 타일의 `aria-label`이 "학습 시작, 마지막 세션 82%" 형태인지 DOM에서 직접 확인.
5. **480px 이하 1열 전환과 가로 스크롤 0.** 창 리사이즈가 자동화 환경에서 동작하지 않으므로(`outerWidth: 0`), 컨테이너 폭을 강제하는 방식으로 대체 검증한다.
6. **대비비.** 각 `--color-focus-*` 보조 문구가 타일 배경 대비 4.5:1을 넘는지. **캔버스 픽셀 판독으로 측정한다** — Chrome이 computed color를 `oklch()` 리터럴로 돌려주므로 정규식으로 숫자를 뽑으면 L/C/H를 R/G/B로 오독한다(TS-006).
7. **IntersectionObserver 관련 없음.** 이 블록은 리빌 대상이 아니므로 TS-007의 `location.reload()` 절차는 불필요하다.

## 트러블슈팅 기록

트러블슈팅은 **건별로 해결·검증 직후 즉시** `docs/TROUBLESHOOTING.md`에 기록한다. 작업 종료 시점에 몰아 쓰지 않는다. 기록 기준과 템플릿은 그 파일 상단을 따른다.
