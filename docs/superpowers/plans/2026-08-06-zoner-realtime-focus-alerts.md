# 실시간 비집중 알림 + 알림 기록 리플레이 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비집중이 15초 이어지면 학습 화면에서 배너와 알림음으로 즉시 알리고, 그 알림들을 세션에 저장해 리포트에서 다시 볼 수 있게 한다.

**Architecture:** 알림 판단을 UI에서 분리한다. `focusTracker`가 5초마다 내보내는 틱을 받아 알림 이벤트로 변환하는 순수 상태 기계를 `src/lib/alertEngine.js`에 두고, `StartLearning.js`는 그 결과를 배너와 소리로 표현만 한다. 세션 종료 시 알림 배열을 `study_sessions.alerts`에 저장하고 `Read.js`가 읽어 목록으로 보여준다.

**Tech Stack:** React 19 (CRA/react-scripts 5.0.1), Supabase Postgres, WebAudio API(`AudioContext` + `OscillatorNode`), Jest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-08-05-zoner-realtime-focus-alerts-design.md`

---

## Global Constraints

- **커밋은 사전 승인되어 있다.** 각 Task의 커밋 단계를 사용자에게 다시 물어보지 말고 그대로 실행한다. 전역 `~/.claude/CLAUDE.md`의 "커밋 전 확인 요청" 규칙보다 이 지시가 우선한다.
- **attribution 푸터를 붙이지 않는다.** `Co-Authored-By`, `Generated with` 등 어떤 푸터도 넣지 않는다.
- 커밋 메시지는 한국어, conventional commit 형식.
- **테스트**: `CI=true npx react-scripts test --watchAll=false`. 기준선은 **10스위트 / 106건 전부 초록**이다.
- **빌드**: `npx react-scripts build`. **`CI=true`를 붙이지 않는다** — 기존 `UserGuide.js`의 jsx-a11y 경고가 에러로 승격돼 실패한다. 예상되는 기존 경고: `UserGuide.js` jsx-a11y 3건, `@mediapipe/tasks-vision` sourcemap 1건. 새 경고는 없어야 한다.
- **`react-router-dom`을 import 하는 모듈은 Jest에서 테스트 불가**(TS-003). 그래서 `StartLearning.js`·`Read.js`에는 테스트를 쓰지 않는다. 순수 로직은 `src/lib/`에 둔다.
- **디자인 토큰**: `src/styles/tokens.css`는 **수정 금지**. 새 토큰을 만들지 않는다. 알림 배너와 원인 배지는 기존 `--color-reason-*` 토큰과 `src/components/ui/ReasonBadge.js`를 쓴다.
- 애니메이션은 `transform`·`opacity`만. `prefers-reduced-motion` 대응은 `tokens.css` 전역 블록이 이미 처리하므로 화면 CSS에서 다시 정의하지 않는다.
- **상단바는 이미 전 화면 sticky다.** `.start-learning__topbar`, `.session-report__topbar`의 `position: sticky` 관련 4줄을 건드리지 않는다.
- **`.sr-only`는 `tokens.css`에 전역으로 있다.** 다시 정의하지 않는다.
- 모든 인터랙티브 요소에 `:focus-visible` 스타일이 있어야 한다.
- **서브에이전트는 Supabase에 SQL을 실행하지 않는다.** 마이그레이션 파일을 커밋까지만 하고, 적용은 컨트롤러가 브라우저로 수행한다.

---

## 이미 되어 있는 것 — 다시 하지 마라

스펙 작성(2026-08-05) 이후 들어간 변경이 있다. 스펙 본문과 현재 코드가 다르면 **현재 코드가 맞다.**

- **웹캠 확대는 완료됐다.** 스펙 99-108행은 `.start-learning__main { max-width: clamp(560px, 72vw, 880px) }` + `.start-learning__video-wrap { max-height: 60vh }`를 제안하지만, 이후 커밋 `5fe84b3`에서 더 나은 구현이 들어갔다:
  - `.start-learning__main { max-width: 960px; }`
  - `.start-learning__video-wrap { width: min(100%, calc((58vh * 4) / 3), 880px); }`
  **이 두 규칙을 건드리지 마라.** 스펙의 제안값으로 되돌리면 회귀다.
- 디자인 시스템 선행 조건(스펙 142-144행)은 충족됐다. `tokens.css`의 `--color-reason-*` 6종과 `ReasonBadge` 컴포넌트가 이미 있다.

## 스펙이 놓친 것 — 이 계획에서 바로잡는다

**`active_study_sessions` 뷰에 `focus_breakdown`이 없다.** 스펙 124행은 "`focus_breakdown`은 이미 저장되고 있으나 화면에 나온 적이 없는 데이터"라며 `Read.js`의 `select`에 추가하면 된다고 본다. 그런데 `Read.js`는 테이블이 아니라 **뷰**에서 읽고(`Read.js:48`), 그 뷰는 컬럼을 고정 나열한다:

```sql
-- 20260805110000_pin_active_study_sessions_columns.sql (현재 배포된 정의)
create or replace view active_study_sessions with (security_invoker = true) as
select id, user_id, started_at, ended_at, duration_seconds, focus_score, timeline, created_at, deleted_at
from study_sessions where deleted_at is null;
```

`focus_breakdown`은 그 뒤 `20260805150000`에서 테이블에 추가됐지만 **뷰는 갱신되지 않았다.** 뷰를 고치지 않으면 `select`에 넣어도 읽히지 않는다. Task 3에서 `alerts`와 `focus_breakdown`을 **둘 다** 뷰에 넣는다.

## 스펙에 없는 결정 — 일시정지 처리

스펙은 일시정지를 다루지 않는다. `beginTicking`이 시작과 재개 양쪽에서 호출되므로(`StartLearning.js:135, 168, 178`), 아무 처리도 안 하면 일시정지를 사이에 두고 **연속 카운트가 그대로 이어지고 열린 알림이 일시정지 구간을 통째로 삼킨다.** 사용자가 의도적으로 멈춘 시간이 "비집중 80초"로 기록되는 것은 틀렸다.

그래서 엔진에 `reset(atMs)`를 하나 더 둔다(스펙 66-68행의 인터페이스에 추가). 일시정지 시 열린 알림을 그 시각으로 닫고 카운트를 0으로 만든다. 재개하면 처음부터 다시 3틱을 센다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/lib/alertEngine.js` (신규) | 틱 → 알림 이벤트 순수 상태 기계. React·router import 없음 |
| `src/lib/alertEngine.test.js` (신규) | 발화 규칙 단위 테스트 |
| `src/lib/alertSound.js` (신규) | 음소거 설정 저장/로드(localStorage) + WebAudio 톤 재생 |
| `src/lib/alertSound.test.js` (신규) | 음소거 설정 저장/로드 테스트 |
| `supabase/migrations/20260806140000_add_alerts_to_study_sessions.sql` (신규) | `alerts` 컬럼 + 뷰 재정의 |
| `src/components/StartLearning.js` (수정) | 엔진 연결, 배너, 음소거 토글, 저장 |
| `src/components/StartLearning.css` (수정) | 배너·음소거 버튼 스타일 |
| `src/components/Read.js` (수정) | `focus_breakdown` 막대 + 알림 목록 |
| `src/components/SessionReport.css` (수정) | 위 두 섹션 스타일 |

---

### Task 1: 알림 엔진

**Files:**
- Create: `src/lib/alertEngine.js`
- Test: `src/lib/alertEngine.test.js`

**Interfaces:**
- Consumes: `focusTracker`가 내보내는 틱 모양 `{ timestampMs: number, focused: boolean, reason: string }` (`src/lib/focusTracker.js:224`). `reason`은 `REASON` 6종 중 하나: `focused`, `looking_down`, `absent`, `head_turned`, `looking_up`, `eyes_closed`. 이 중 `focused`·`looking_down`이 집중으로 판정되므로 `tick.focused === true`로 온다.
- Produces:
  - `export const ALERT_CONSECUTIVE_TICKS = 3`
  - `export const ALERT_MESSAGES` — `reason` → 배너 문구 맵. Task 4가 쓴다.
  - `export function createAlertEngine({ consecutiveTicks, onAlert })` → `{ handleTick(tick), reset(atMs), finish(endedAtMs), getAlerts() }`
    - `onAlert({ started_at, reason })` — 발화 순간 1회 호출. Task 4가 배너·소리 트리거로 쓴다.
    - `finish(endedAtMs)`는 열린 알림을 닫고 **최종 배열을 반환한다.** Task 4가 그 반환값을 그대로 저장한다.
    - 저장 이벤트 모양: `{ started_at, ended_at, reason, duration_seconds }`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/lib/alertEngine.test.js` 전체 내용:

```javascript
import { createAlertEngine, ALERT_CONSECUTIVE_TICKS, ALERT_MESSAGES } from './alertEngine';

const T0 = Date.UTC(2026, 7, 6, 5, 0, 0); // 2026-08-06T05:00:00.000Z
const tick = (offsetSeconds, focused, reason) => ({
  timestampMs: T0 + offsetSeconds * 1000,
  focused,
  reason,
});
const unfocused = (s, reason = 'absent') => tick(s, false, reason);
const focusedTick = (s) => tick(s, true, 'focused');

describe('createAlertEngine — 발화 규칙', () => {
  test('2틱 비집중으로는 발화하지 않는다', () => {
    const onAlert = jest.fn();
    const engine = createAlertEngine({ onAlert });
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    expect(onAlert).not.toHaveBeenCalled();
  });

  test('3틱째에 정확히 1회 발화한다', () => {
    const onAlert = jest.fn();
    const engine = createAlertEngine({ onAlert });
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10));
    expect(onAlert).toHaveBeenCalledTimes(1);
    expect(onAlert).toHaveBeenCalledWith({
      started_at: new Date(T0 + 10000).toISOString(),
      reason: 'absent',
    });
  });

  test('기본 임계값은 ALERT_CONSECUTIVE_TICKS와 같다', () => {
    expect(ALERT_CONSECUTIVE_TICKS).toBe(3);
  });

  test('알림이 열린 동안에는 reason이 바뀌어도 재발화하지 않는다', () => {
    const onAlert = jest.fn();
    const engine = createAlertEngine({ onAlert });
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10, 'absent'));
    engine.handleTick(unfocused(15, 'head_turned'));
    engine.handleTick(unfocused(20, 'eyes_closed'));
    expect(onAlert).toHaveBeenCalledTimes(1);
  });

  test('저장되는 reason은 발화 시점의 값이다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0, 'head_turned'));
    engine.handleTick(unfocused(5, 'head_turned'));
    engine.handleTick(unfocused(10, 'absent'));
    engine.handleTick(unfocused(15, 'eyes_closed'));
    engine.handleTick(focusedTick(20));
    expect(engine.getAlerts()[0].reason).toBe('absent');
  });

  test('발화 전에 집중으로 돌아오면 카운트가 초기화된다', () => {
    const onAlert = jest.fn();
    const engine = createAlertEngine({ onAlert });
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(focusedTick(10));
    engine.handleTick(unfocused(15));
    engine.handleTick(unfocused(20));
    expect(onAlert).not.toHaveBeenCalled();
  });

  test('임계값을 주입할 수 있다', () => {
    const onAlert = jest.fn();
    const engine = createAlertEngine({ consecutiveTicks: 2, onAlert });
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    expect(onAlert).toHaveBeenCalledTimes(1);
  });

  test('onAlert를 주지 않아도 동작한다', () => {
    const engine = createAlertEngine({});
    expect(() => {
      engine.handleTick(unfocused(0));
      engine.handleTick(unfocused(5));
      engine.handleTick(unfocused(10));
    }).not.toThrow();
    expect(engine.getAlerts()).toEqual([]);
  });
});

describe('createAlertEngine — 이벤트 기록', () => {
  test('집중 복귀 시 ended_at과 duration_seconds가 채워진다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10));
    engine.handleTick(focusedTick(90));

    expect(engine.getAlerts()).toEqual([
      {
        started_at: new Date(T0 + 10000).toISOString(),
        ended_at: new Date(T0 + 90000).toISOString(),
        reason: 'absent',
        duration_seconds: 80,
      },
    ]);
  });

  test('비집중이 전혀 없으면 빈 배열이다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(focusedTick(0));
    engine.handleTick(focusedTick(5));
    expect(engine.finish(T0 + 10000)).toEqual([]);
  });

  test('발화하지 않은 짧은 비집중은 기록되지 않는다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(focusedTick(10));
    expect(engine.finish(T0 + 15000)).toEqual([]);
  });

  test('finish()가 열린 알림을 종료 시각으로 닫는다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10));

    const alerts = engine.finish(T0 + 40000);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ended_at).toBe(new Date(T0 + 40000).toISOString());
    expect(alerts[0].duration_seconds).toBe(30);
  });

  test('finish()는 최종 배열을 반환한다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10));
    expect(engine.finish(T0 + 20000)).toEqual(engine.getAlerts());
  });

  test('여러 번 이탈하면 순서대로 쌓인다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10, 'absent'));
    engine.handleTick(focusedTick(20));
    engine.handleTick(unfocused(30, 'eyes_closed'));
    engine.handleTick(unfocused(35, 'eyes_closed'));
    engine.handleTick(unfocused(40, 'eyes_closed'));
    engine.handleTick(focusedTick(50));

    const alerts = engine.getAlerts();
    expect(alerts.map((a) => a.reason)).toEqual(['absent', 'eyes_closed']);
    expect(alerts.map((a) => a.duration_seconds)).toEqual([10, 10]);
  });

  test('getAlerts()는 복사본을 반환해 외부 변형이 내부에 남지 않는다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10));
    engine.handleTick(focusedTick(20));

    engine.getAlerts().push({ bogus: true });
    expect(engine.getAlerts()).toHaveLength(1);
  });
});

describe('createAlertEngine — 일시정지(reset)', () => {
  test('reset()이 열린 알림을 그 시각으로 닫는다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.handleTick(unfocused(10));

    engine.reset(T0 + 25000);
    const alerts = engine.getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ended_at).toBe(new Date(T0 + 25000).toISOString());
    expect(alerts[0].duration_seconds).toBe(15);
  });

  test('reset() 후에는 카운트가 처음부터 다시 센다', () => {
    const onAlert = jest.fn();
    const engine = createAlertEngine({ onAlert });
    engine.handleTick(unfocused(0));
    engine.handleTick(unfocused(5));
    engine.reset(T0 + 6000);
    engine.handleTick(unfocused(60));
    engine.handleTick(unfocused(65));
    expect(onAlert).not.toHaveBeenCalled();
    engine.handleTick(unfocused(70));
    expect(onAlert).toHaveBeenCalledTimes(1);
  });

  test('열린 알림이 없을 때 reset()은 아무 기록도 남기지 않는다', () => {
    const engine = createAlertEngine({});
    engine.handleTick(unfocused(0));
    engine.reset(T0 + 3000);
    expect(engine.getAlerts()).toEqual([]);
  });
});

describe('ALERT_MESSAGES', () => {
  test('배너 대상 reason 4종에 문구가 있다', () => {
    expect(ALERT_MESSAGES).toEqual({
      absent: '자리를 비우셨나요?',
      head_turned: '화면에서 시선이 벗어났어요',
      looking_up: '집중이 흐트러진 것 같아요',
      eyes_closed: '졸고 계신가요? 잠깐 쉬어가세요',
    });
  });

  test('집중으로 판정되는 reason에는 문구가 없다', () => {
    expect(ALERT_MESSAGES.focused).toBeUndefined();
    expect(ALERT_MESSAGES.looking_down).toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/alertEngine.test.js`
Expected: FAIL — `Cannot find module './alertEngine'`

- [ ] **Step 3: 구현한다**

`src/lib/alertEngine.js` 전체 내용:

```javascript
// src/lib/alertEngine.js
// 비집중 틱을 알림 이벤트로 바꾸는 순수 상태 기계.
// UI에서 분리해 둔 이유는 두 가지다 — 발화 규칙을 단위 테스트로 고정하기 위해서,
// 그리고 react-router-dom을 import 하는 화면 파일은 이 저장소 Jest가 로드하지 못하기
// 때문이다(docs/TROUBLESHOOTING.md TS-003).

export const ALERT_CONSECUTIVE_TICKS = 3;

// 배너 문구. focused와 looking_down은 집중으로 판정되므로 대상이 아니다.
export const ALERT_MESSAGES = {
  absent: '자리를 비우셨나요?',
  head_turned: '화면에서 시선이 벗어났어요',
  looking_up: '집중이 흐트러진 것 같아요',
  eyes_closed: '졸고 계신가요? 잠깐 쉬어가세요',
};

export function createAlertEngine({
  consecutiveTicks = ALERT_CONSECUTIVE_TICKS,
  onAlert,
} = {}) {
  let unfocusedCount = 0;
  let openAlert = null;
  const alerts = [];

  const closeOpenAlert = (endedAtMs) => {
    if (!openAlert) return;
    alerts.push({
      started_at: openAlert.startedAt,
      ended_at: new Date(endedAtMs).toISOString(),
      reason: openAlert.reason,
      duration_seconds: Math.max(
        0,
        Math.round((endedAtMs - openAlert.startedAtMs) / 1000)
      ),
    });
    openAlert = null;
  };

  return {
    handleTick(tick) {
      if (tick.focused) {
        unfocusedCount = 0;
        closeOpenAlert(tick.timestampMs);
        return;
      }

      // 이미 열린 이탈의 연속이면 아무것도 하지 않는다. reason이 바뀌어도
      // 같은 이탈로 본다 — 자리를 비웠다 돌아오며 고개를 돌리는 것은 한 번의 이탈이고,
      // 두 건으로 세면 알림이 잦아지고 리포트도 부풀려진다.
      if (openAlert) return;

      unfocusedCount += 1;
      if (unfocusedCount < consecutiveTicks) return;

      openAlert = {
        startedAtMs: tick.timestampMs,
        startedAt: new Date(tick.timestampMs).toISOString(),
        reason: tick.reason,
      };

      if (onAlert) {
        onAlert({ started_at: openAlert.startedAt, reason: openAlert.reason });
      }
    },

    // 일시정지용. 사용자가 의도적으로 멈춘 시간은 비집중 구간이 아니므로
    // 열린 알림을 그 시각으로 닫고 카운트를 초기화한다.
    reset(atMs) {
      closeOpenAlert(atMs);
      unfocusedCount = 0;
    },

    finish(endedAtMs) {
      closeOpenAlert(endedAtMs);
      unfocusedCount = 0;
      return alerts.slice();
    },

    getAlerts() {
      return alerts.slice();
    },
  };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/alertEngine.test.js`
Expected: PASS — 20 passed

- [ ] **Step 5: 전체 테스트를 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 11 suites / 126 tests 전부 통과

- [ ] **Step 6: 커밋한다**

커밋은 사전 승인되어 있다. 사용자에게 묻지 말고 실행한다.

```bash
git add src/lib/alertEngine.js src/lib/alertEngine.test.js
git commit -m "feat: 비집중 알림 엔진 추가"
```

---

### Task 2: 음소거 설정 + 알림음

**Files:**
- Create: `src/lib/alertSound.js`
- Test: `src/lib/alertSound.test.js`

**Interfaces:**
- Consumes: 없음.
- Produces:
  - `export const ALERT_MUTED_STORAGE_KEY = 'zoner:alert-muted'`
  - `export function loadAlertMuted()` → boolean. 저장값이 없거나 `localStorage` 접근이 실패하면 `false`(소리 켜짐).
  - `export function saveAlertMuted(muted)` → void. 실패해도 던지지 않는다.
  - `export function playAlertTone(audioContext)` → void. `audioContext`가 없거나 재생이 실패하면 조용히 넘어간다. Task 4가 호출한다.

**주의:** 스펙 132행 — `AudioContext` 생성/재생 실패는 **조용히 건너뛰고 배너는 정상 표시**해야 한다. 알림 기능 전체가 소리 때문에 멈추면 안 된다. `playAlertTone`은 어떤 경우에도 예외를 밖으로 던지지 않는다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/lib/alertSound.test.js` 전체 내용:

```javascript
import {
  ALERT_MUTED_STORAGE_KEY,
  loadAlertMuted,
  saveAlertMuted,
  playAlertTone,
} from './alertSound';

describe('음소거 설정', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('저장된 값이 없으면 소리가 켜진 상태다', () => {
    expect(loadAlertMuted()).toBe(false);
  });

  test('음소거를 저장하면 그대로 읽힌다', () => {
    saveAlertMuted(true);
    expect(loadAlertMuted()).toBe(true);
  });

  test('음소거를 해제하면 그대로 읽힌다', () => {
    saveAlertMuted(true);
    saveAlertMuted(false);
    expect(loadAlertMuted()).toBe(false);
  });

  test('알 수 없는 값이 들어 있으면 소리가 켜진 것으로 본다', () => {
    window.localStorage.setItem(ALERT_MUTED_STORAGE_KEY, 'yes');
    expect(loadAlertMuted()).toBe(false);
  });

  test('localStorage 읽기가 실패해도 던지지 않고 기본값을 준다', () => {
    const spy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });
    expect(loadAlertMuted()).toBe(false);
    spy.mockRestore();
  });

  test('localStorage 쓰기가 실패해도 던지지 않는다', () => {
    const spy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    expect(() => saveAlertMuted(true)).not.toThrow();
    spy.mockRestore();
  });
});

describe('playAlertTone', () => {
  test('audioContext가 없으면 조용히 넘어간다', () => {
    expect(() => playAlertTone(null)).not.toThrow();
    expect(() => playAlertTone(undefined)).not.toThrow();
  });

  test('오실레이터를 만들어 짧게 재생한다', () => {
    const oscillator = {
      type: '',
      frequency: { setValueAtTime: jest.fn() },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
    const gain = {
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
      connect: jest.fn(),
    };
    const ctx = {
      currentTime: 0,
      destination: {},
      createOscillator: jest.fn(() => oscillator),
      createGain: jest.fn(() => gain),
    };

    playAlertTone(ctx);

    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(oscillator.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(ctx.destination);
    expect(oscillator.start).toHaveBeenCalledTimes(1);
    expect(oscillator.stop).toHaveBeenCalledTimes(1);
  });

  test('재생 중 예외가 나도 밖으로 던지지 않는다', () => {
    const ctx = {
      currentTime: 0,
      destination: {},
      createOscillator: () => {
        throw new Error('not allowed');
      },
      createGain: jest.fn(),
    };
    expect(() => playAlertTone(ctx)).not.toThrow();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/alertSound.test.js`
Expected: FAIL — `Cannot find module './alertSound'`

- [ ] **Step 3: 구현한다**

`src/lib/alertSound.js` 전체 내용:

```javascript
// src/lib/alertSound.js
// 알림음과 음소거 설정. 오디오 파일을 번들에 넣지 않으려고 WebAudio로 톤을 합성한다.
//
// 소리는 부가 기능이다. AudioContext 생성이나 재생이 실패해도(브라우저 미지원,
// 자동재생 정책 차단, 권한 거부) 예외를 밖으로 던지지 않는다 — 소리 때문에
// 배너까지 멈추면 알림 기능 자체가 무의미해진다.

export const ALERT_MUTED_STORAGE_KEY = 'zoner:alert-muted';

const TONE_FREQUENCY_HZ = 660;
const TONE_DURATION_SECONDS = 0.18;
const TONE_PEAK_GAIN = 0.12;

export function loadAlertMuted() {
  try {
    return window.localStorage.getItem(ALERT_MUTED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveAlertMuted(muted) {
  try {
    window.localStorage.setItem(ALERT_MUTED_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // 저장 실패는 무시한다. 이번 세션 동안만 설정이 유지된다.
  }
}

export function playAlertTone(audioContext) {
  if (!audioContext) return;

  try {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(TONE_FREQUENCY_HZ, now);

    // 뚝 끊기면 클릭음이 나므로 지수 감쇠로 끝낸다.
    gain.gain.setValueAtTime(TONE_PEAK_GAIN, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + TONE_DURATION_SECONDS);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + TONE_DURATION_SECONDS);
  } catch {
    // 재생 실패는 무시한다. 배너는 그대로 표시된다.
  }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/alertSound.test.js`
Expected: PASS — 9 passed

- [ ] **Step 5: 전체 테스트를 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 12 suites / 135 tests 전부 통과

- [ ] **Step 6: 커밋한다**

커밋은 사전 승인되어 있다. 사용자에게 묻지 말고 실행한다.

```bash
git add src/lib/alertSound.js src/lib/alertSound.test.js
git commit -m "feat: 알림음 합성과 음소거 설정 저장 추가"
```

---

### Task 3: `alerts` 컬럼 + `active_study_sessions` 뷰 재정의

**Files:**
- Create: `supabase/migrations/20260806140000_add_alerts_to_study_sessions.sql`

**Interfaces:**
- Consumes: 기존 `study_sessions` 테이블과 `active_study_sessions` 뷰.
- Produces: `study_sessions.alerts jsonb` (nullable), 그리고 `focus_breakdown`·`alerts`를 노출하는 뷰. Task 4가 쓰고 Task 5가 읽는다.

**결정적인 제약 — 뷰 컬럼 순서:**

Postgres의 `create or replace view`는 **기존 컬럼을 같은 이름·같은 순서로 유지한 채 끝에만 추가**할 수 있다. 중간에 끼워 넣으면 `cannot change name of view column ...` 로 실패한다.

현재 뷰의 컬럼 순서(`20260805110000`):
```
id, user_id, started_at, ended_at, duration_seconds, focus_score, timeline, created_at, deleted_at
```

따라서 새 컬럼 둘은 **`deleted_at` 뒤에** 붙여야 한다. `focus_breakdown`을 `timeline` 옆에 두고 싶어도 그렇게 쓰면 마이그레이션이 실패한다.

- [ ] **Step 1: 마이그레이션 SQL을 작성한다**

`supabase/migrations/20260806140000_add_alerts_to_study_sessions.sql` 전체 내용:

```sql
-- supabase/migrations/20260806140000_add_alerts_to_study_sessions.sql
--
-- 세션의 비집중 알림 구간을 저장한다. 기존 세션은 null로 남고, 리포트는
-- null을 렌더링하지 않으므로 깨지지 않는다.

alter table study_sessions add column alerts jsonb;

-- active_study_sessions 뷰는 컬럼을 고정 나열하므로 여기서 함께 갱신해야 한다.
-- focus_breakdown은 20260805150000에서 테이블에 추가됐지만 뷰에는 반영되지 않아
-- 지금까지 화면에서 읽을 수 없었다. alerts와 함께 이번에 노출한다.
--
-- ⚠️ create or replace view는 기존 컬럼의 이름과 순서를 바꿀 수 없다.
-- 새 컬럼은 반드시 기존 목록 "뒤에" 붙인다. 중간에 끼우면 실패한다.
create or replace view active_study_sessions with (security_invoker = true) as
select
  id,
  user_id,
  started_at,
  ended_at,
  duration_seconds,
  focus_score,
  timeline,
  created_at,
  deleted_at,
  focus_breakdown,
  alerts
from study_sessions
where deleted_at is null;
```

- [ ] **Step 2: 컬럼 순서를 눈으로 대조한다**

`supabase/migrations/20260805110000_pin_active_study_sessions_columns.sql`을 읽고, 방금 쓴 파일의 `select` 목록 **앞부분 9개**가 그 파일과 이름·순서까지 정확히 같은지 확인한다.

Expected: `id, user_id, started_at, ended_at, duration_seconds, focus_score, timeline, created_at, deleted_at`가 그 순서로 먼저 오고, 그 뒤에 `focus_breakdown, alerts`가 붙어 있다.

- [ ] **Step 3: 커밋한다**

커밋은 사전 승인되어 있다. 사용자에게 묻지 말고 실행한다. **SQL을 실행하지 마라** — Supabase 접근 권한이 없고, 적용은 컨트롤러가 한다.

```bash
git add supabase/migrations/20260806140000_add_alerts_to_study_sessions.sql
git commit -m "feat: study_sessions에 alerts 컬럼 추가 및 뷰 갱신"
```

**참고 — 컨트롤러가 적용 후 검증할 것:**

```sql
select column_name from information_schema.columns
where table_name = 'active_study_sessions' order by ordinal_position;
```
→ 11개, 마지막 두 개가 `focus_breakdown`, `alerts`.

```sql
select count(*) from active_study_sessions;
```
→ 적용 전과 같아야 한다(뷰 재정의로 행이 사라지지 않았는지).

---

### Task 4: 학습 화면 — 알림 배너·알림음·음소거 토글

**Files:**
- Modify: `src/components/StartLearning.js`
- Modify: `src/components/StartLearning.css`

**Interfaces:**
- Consumes:
  - Task 1의 `createAlertEngine`, `ALERT_MESSAGES`
  - Task 2의 `loadAlertMuted`, `saveAlertMuted`, `playAlertTone`
  - Task 3의 `study_sessions.alerts` 컬럼
  - 기존 `createFocusTracker`(`onTick`으로 `{ timestampMs, focused, reason }` 전달), `aggregateSession`
- Produces: 세션 insert에 `alerts` 배열. Task 5가 읽는다.

**연결 지점 (현재 코드 기준 행 번호):**

| 위치 | 할 일 |
|---|---|
| `beginTicking`의 `onTick` (145-148행) | `alertEngineRef.current?.handleTick(tick)` 추가. `tick.focused`면 배너를 내린다 |
| `handleStart` (165-169행) | 알림 엔진 생성 + `AudioContext` 생성 |
| `handlePause` (171-174행) | `alertEngineRef.current?.reset(Date.now())`, 배너 내림 |
| `handleStop` (181행~) | `finish(Date.now())` 결과를 insert의 `alerts`에 실음 |

**왜 엔진을 `beginTicking`이 아니라 `handleStart`에서 만드나:** `beginTicking`은 시작과 재개 양쪽에서 호출된다(168행, 178행). 거기서 만들면 재개할 때마다 엔진이 새로 생겨 그 전까지 쌓인 알림이 전부 사라진다.

**`AudioContext`를 `handleStart`에서 만드는 이유:** 브라우저 자동재생 정책상 사용자 제스처 이후에만 소리를 낼 수 있다. "시작" 버튼 클릭이 그 제스처다.

- [ ] **Step 1: import와 ref/state를 추가한다**

`src/components/StartLearning.js` 상단 import 블록에 추가한다(기존 import는 지우지 않는다):

```javascript
import { createAlertEngine, ALERT_MESSAGES } from '../lib/alertEngine';
import { loadAlertMuted, saveAlertMuted, playAlertTone } from '../lib/alertSound';
```

컴포넌트 안, 기존 `ticksRef` 선언 근처에 추가한다:

```javascript
  const alertEngineRef = useRef(null);
  const audioContextRef = useRef(null);
  const isMutedRef = useRef(false);
  const [activeAlert, setActiveAlert] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
```

`isMutedRef`가 따로 필요한 이유: `onAlert` 콜백은 `handleStart` 시점의 클로저에 갇히므로 그때의 `isMuted` 값을 계속 본다. ref로 최신 값을 읽어야 토글이 즉시 반영된다.

마운트 시 저장된 설정을 읽는 이펙트를 추가한다:

```javascript
  useEffect(() => {
    const muted = loadAlertMuted();
    setIsMuted(muted);
    isMutedRef.current = muted;
  }, []);
```

- [ ] **Step 2: 엔진과 오디오를 연결한다**

`beginTicking`의 `onTick`을 아래로 교체한다:

```javascript
      onTick: (tick) => {
        ticksRef.current.push(tick);
        setIsFocused(tick.focused);
        alertEngineRef.current?.handleTick(tick);
        // 배너는 자동 타이머로 닫지 않는다. 집중으로 돌아왔을 때만 내린다.
        if (tick.focused) {
          setActiveAlert(null);
        }
      },
```

`handleStart`를 아래로 교체한다:

```javascript
  const handleStart = () => {
    startedAtRef.current = new Date().toISOString();

    alertEngineRef.current = createAlertEngine({
      onAlert: (alert) => {
        setActiveAlert(alert);
        if (!isMutedRef.current) {
          playAlertTone(audioContextRef.current);
        }
      },
    });

    // 자동재생 정책상 AudioContext는 사용자 제스처 이후에만 소리를 낼 수 있다.
    // 시작 버튼 클릭이 그 제스처다. 생성 실패해도 배너는 정상 동작해야 하므로 삼킨다.
    if (!audioContextRef.current) {
      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (AudioContextCtor) {
          audioContextRef.current = new AudioContextCtor();
        }
      } catch {
        audioContextRef.current = null;
      }
    }

    setStatus(STATUS.RUNNING);
    beginTicking();
  };
```

`handlePause`를 아래로 교체한다:

```javascript
  const handlePause = () => {
    stopTicking();
    // 사용자가 의도적으로 멈춘 시간은 비집중 구간이 아니다. 열린 알림을 여기서 닫는다.
    alertEngineRef.current?.reset(Date.now());
    setActiveAlert(null);
    setStatus(STATUS.PAUSED);
  };
```

- [ ] **Step 3: 음소거 토글 핸들러를 추가한다**

`handlePause` 뒤에 추가한다:

```javascript
  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      saveAlertMuted(next);
      return next;
    });
  };
```

- [ ] **Step 4: `alerts`를 저장에 싣는다**

`handleStop`에서 `stopTicking();` 바로 다음 줄에 추가한다:

```javascript
    const alerts = alertEngineRef.current?.finish(Date.now()) ?? [];
```

그리고 `.insert({ ... })` 객체의 `focus_breakdown: focusBreakdown,` 다음 줄에 추가한다:

```javascript
          alerts,
```

- [ ] **Step 5: 배너와 음소거 버튼을 렌더한다**

웹캠 영상을 감싸는 `.start-learning__video-wrap` 요소 **안쪽 끝**(`</div>` 직전)에 배너를 추가한다:

```jsx
              {activeAlert && ALERT_MESSAGES[activeAlert.reason] && (
                <div className="start-learning__alert" role="alert">
                  <span className="start-learning__alert-icon" aria-hidden="true">
                    !
                  </span>
                  <span className="start-learning__alert-text">
                    {ALERT_MESSAGES[activeAlert.reason]}
                  </span>
                </div>
              )}
```

음소거 토글은 세션 컨트롤 버튼들이 있는 영역에 추가한다:

```jsx
              <button
                type="button"
                className="start-learning__mute"
                onClick={handleToggleMute}
                aria-pressed={isMuted}
              >
                {isMuted ? '알림음 켜기' : '알림음 끄기'}
              </button>
```

`aria-pressed`를 쓰는 이유: 이 버튼은 이동이 아니라 상태를 가진 토글이다. 문구도 함께 바뀌므로 색이나 아이콘에만 의존하지 않는다.

- [ ] **Step 6: 배너와 버튼 스타일을 추가한다**

먼저 `src/styles/tokens.css`를 열어 `--color-warning`이 정의돼 있는지 확인한다. **없으면** 아래 CSS의 `var(--color-warning, var(--color-danger))`를 `var(--color-danger)`로 바꿔 쓴다.

`src/components/StartLearning.css` **맨 끝**에 추가한다. **`.start-learning__main`과 `.start-learning__video-wrap`의 기존 크기 규칙은 건드리지 않는다.**

```css
/* ── 비집중 알림 배너 ───────────────────────────────────── */

.start-learning__alert {
  position: absolute;
  left: var(--space-4);
  right: var(--space-4);
  bottom: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-danger);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: var(--text-sm);
  box-shadow: var(--shadow-md);
  animation: start-learning-alert-in var(--duration-normal) var(--ease-out-expo);
}

.start-learning__alert-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-full);
  background-color: var(--color-danger);
  color: var(--color-bg);
  font-weight: 700;
}

.start-learning__alert-text {
  min-width: 0;
}

@keyframes start-learning-alert-in {
  from {
    opacity: 0;
    transform: translateY(0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.start-learning__mute {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.start-learning__mute:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.start-learning__mute:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 7: 테스트와 빌드를 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 12 suites / 135 tests 전부 통과 (이 파일에는 테스트가 없다 — 회귀만 확인)

Run: `npx react-scripts build`
Expected: 에러 없이 종료. 기존 경고(UserGuide.js jsx-a11y 3건, mediapipe 1건) 외 새 경고 없음.

- [ ] **Step 8: 커밋한다**

커밋은 사전 승인되어 있다. 사용자에게 묻지 말고 실행한다.

```bash
git add src/components/StartLearning.js src/components/StartLearning.css
git commit -m "feat: 학습 화면에 실시간 비집중 알림 배너와 알림음 추가"
```

---

### Task 5: 리포트 — 원인별 비율 + 알림 목록

**Files:**
- Modify: `src/components/Read.js`
- Modify: `src/components/SessionReport.css`

**Interfaces:**
- Consumes: Task 3의 뷰가 노출하는 `focus_breakdown`, `alerts`. 기존 `ReasonBadge`(`src/components/ui/ReasonBadge.js`, `{ reason, ratio }` prop, `REASON_LABELS` export).
- Produces: 없음. 마지막 코드 태스크다.

**깨뜨리면 안 되는 것:** 두 섹션 모두 값이 `null`이면 **렌더링하지 않는다.** 이 컬럼들이 생기기 전 세션이 많고, 그 리포트가 깨지면 안 된다. `focus_breakdown`은 객체, `alerts`는 배열이며 둘 다 `null`일 수 있다.

- [ ] **Step 1: `select`에 컬럼을 추가한다**

`src/components/Read.js:49`를 아래로 교체한다:

```javascript
        .select('id, started_at, duration_seconds, focus_score, timeline, focus_breakdown, alerts')
```

`.from('active_study_sessions')`는 그대로 둔다.

- [ ] **Step 2: import를 추가한다**

```javascript
import ReasonBadge, { REASON_LABELS } from './ui/ReasonBadge';
```

- [ ] **Step 3: 표시용 헬퍼를 모듈 스코프에 추가한다**

`Read.js` 안, 컴포넌트 함수 **바깥**에 둔다:

```javascript
// focus_breakdown은 { focused: 0.4, absent: 0.2, ... } 형태의 비율 맵이다.
// 값이 큰 순으로 정렬하되 0인 항목은 막대를 그리지 않는다.
const breakdownRows = (breakdown) =>
  Object.entries(breakdown || {})
    .filter(([reason, ratio]) => REASON_LABELS[reason] && ratio > 0)
    .sort((a, b) => b[1] - a[1]);

const formatDuration = (seconds) => {
  const total = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
};

const formatClock = (isoString) => {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};
```

- [ ] **Step 4: 두 섹션을 렌더한다**

기존 리포트 본문(점수·타임라인) 아래, `.session-report__main` 안에 추가한다. `session`은 이미 그 스코프에 있는 세션 객체다.

```jsx
            {breakdownRows(session.focus_breakdown).length > 0 && (
              <section className="session-report__section">
                <h2 className="session-report__section-title">원인별 비율</h2>
                <ul className="focus-breakdown">
                  {breakdownRows(session.focus_breakdown).map(([reason, ratio]) => (
                    <li key={reason} className="focus-breakdown__row">
                      <span className="focus-breakdown__label">
                        <ReasonBadge reason={reason} />
                      </span>
                      <span className="focus-breakdown__track">
                        <span
                          className={`focus-breakdown__bar focus-breakdown__bar--${reason.replace(
                            /_/g,
                            '-'
                          )}`}
                          style={{ width: `${Math.round(ratio * 100)}%` }}
                        />
                      </span>
                      <span className="focus-breakdown__value">
                        {Math.round(ratio * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {Array.isArray(session.alerts) && session.alerts.length > 0 && (
              <section className="session-report__section">
                <h2 className="session-report__section-title">
                  알림 기록 ({session.alerts.length}건)
                </h2>
                <ul className="alert-log">
                  {session.alerts.map((alert, index) => (
                    <li key={`${alert.started_at}-${index}`} className="alert-log__row">
                      <span className="alert-log__time">{formatClock(alert.started_at)}</span>
                      <ReasonBadge reason={alert.reason} />
                      <span className="alert-log__duration">
                        {formatDuration(alert.duration_seconds)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
```

- [ ] **Step 5: 스타일을 추가한다**

`src/components/SessionReport.css` 맨 끝에 추가한다:

```css
/* ── 원인별 비율 / 알림 기록 ─────────────────────────────── */

.session-report__section {
  margin-top: var(--space-8);
}

.session-report__section-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 var(--space-4);
}

.focus-breakdown,
.alert-log {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.focus-breakdown__row {
  display: grid;
  grid-template-columns: minmax(6rem, auto) minmax(0, 1fr) 3rem;
  align-items: center;
  gap: var(--space-3);
}

.focus-breakdown__track {
  height: 0.5rem;
  border-radius: var(--radius-full);
  background-color: var(--color-surface-alt);
  overflow: hidden;
}

.focus-breakdown__bar {
  display: block;
  height: 100%;
  border-radius: var(--radius-full);
  background-color: var(--color-text-muted);
}

.focus-breakdown__bar--focused {
  background-color: var(--color-reason-focused);
}
.focus-breakdown__bar--looking-down {
  background-color: var(--color-reason-looking-down);
}
.focus-breakdown__bar--head-turned {
  background-color: var(--color-reason-head-turned);
}
.focus-breakdown__bar--looking-up {
  background-color: var(--color-reason-looking-up);
}
.focus-breakdown__bar--eyes-closed {
  background-color: var(--color-reason-eyes-closed);
}
.focus-breakdown__bar--absent {
  background-color: var(--color-reason-absent);
}

.focus-breakdown__value {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.alert-log__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
}

.alert-log__time {
  font-size: var(--text-sm);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.alert-log__duration {
  margin-left: auto;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 6: 하드코딩된 색이 없는지 확인한다**

Run: `grep -nE '#[0-9a-fA-F]{3,8}|rgb\(|rgba\(' src/components/SessionReport.css`
Expected: 매치 0건.

- [ ] **Step 7: 테스트와 빌드를 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 12 suites / 135 tests 전부 통과

Run: `npx react-scripts build`
Expected: 에러 없이 종료. 새 경고 없음.

- [ ] **Step 8: 커밋한다**

커밋은 사전 승인되어 있다. 사용자에게 묻지 말고 실행한다.

```bash
git add src/components/Read.js src/components/SessionReport.css
git commit -m "feat: 리포트에 원인별 비율과 알림 기록 추가"
```

---

## 배포 (컨트롤러가 수행)

1. Supabase SQL Editor에서 Task 3의 마이그레이션 적용. **TS-001 우회법**: 키 입력 시뮬레이션 대신 `window.monaco.editor.getModels()[0].setValue(sql)`로 직접 주입한다(파일 원본 그대로, 평탄화 불필요).
2. 뷰 컬럼 11개와 마지막 두 개가 `focus_breakdown`, `alerts`인지 확인.
3. `select count(*) from active_study_sessions;`가 적용 전과 같은지 확인.

## 검증 (브라우저에서 직접)

**정적 리뷰는 실행을 대체하지 못한다.** 이 저장소에서 리뷰 3회를 통과한 코드가 브라우저에서 페이지를 멈춰 세운 적이 있다(TS-010).

1. 학습 시작 → **15초 이상 자리를 비우면** 배너가 뜨고 소리가 난다. 돌아오면 배너가 사라진다.
2. 배너가 떠 있는 동안 원인이 바뀌어도(자리비움 → 고개돌림) 배너가 다시 뜨거나 소리가 반복되지 않는다.
3. 음소거 토글 → 알림이 떠도 소리가 안 난다 → **새로고침해도 음소거가 유지된다.**
4. 일시정지 중에는 알림이 뜨지 않고, 재개 후 15초를 새로 센다.
5. 세션 종료 → 리포트에 **원인별 비율 막대**와 **알림 기록 목록**이 뜬다. 목록의 건수·원인이 화면에서 본 알림과 일치한다.
6. Supabase에서 `select alerts from study_sessions order by created_at desc limit 1;` → 화면 목록과 개수·원인 일치.
7. **`alerts`가 `null`인 기존 세션의 리포트가 정상 표시된다** (두 섹션이 아예 안 나오고 나머지는 그대로).
8. 320px에서 가로 스크롤 없음. 배너가 영상 밖으로 넘치지 않는다.
9. 키보드만으로 음소거 토글에 도달·조작 가능하고 포커스 링이 보인다.
10. 배너 대비비 4.5:1 이상. **TS-006 주의**: Chrome이 computed color를 `oklch()` 리터럴로 돌려준다. 정규식으로 숫자를 뽑지 말고 캔버스 픽셀 판독으로 브라우저에 변환시킨다.

## 트러블슈팅 기록

건별로 **해결·검증 직후 즉시** `docs/TROUBLESHOOTING.md`에 기록한다. 마지막 번호는 **TS-011**이므로 다음은 TS-012다.
