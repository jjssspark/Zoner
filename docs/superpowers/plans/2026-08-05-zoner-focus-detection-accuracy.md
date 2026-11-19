# 집중도 판정 정확도 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **상태 (2026-08-07 확인)**: 이 계획의 기능은 구현되어 코드베이스에 있다.
> **아래 체크박스는 실행 중에 갱신되지 않았다 — 진행 표시로 신뢰하지 말 것.**
> 미체크는 "안 했다"가 아니라 "표시를 안 했다"이다. 실제 반영 여부는 `src/`
> 코드와 테스트(214건 통과)로 확인한다.

**Goal:** 집중도 판정에 눈 감김·시선 방향 신호를 추가하고, 각 tick에 판정 원인(`reason`)을 남겨 후속 서브프로젝트가 쓸 수 있게 한다.

**Architecture:** 기존 MediaPipe `FaceLandmarker`에 `outputFaceBlendshapes: true` 옵션만 추가해 blendshape 52종을 함께 받는다. 판정 로직은 순수 함수로 유지해 웹캠 없이 단위 테스트한다. 세션 종료 시 원인별 비율(`focus_breakdown`)을 새 컬럼에 저장한다.

**Tech Stack:** React 19 (CRA), `@mediapipe/tasks-vision`(기존), Supabase Postgres.

## Global Constraints

- `reason` 문자열은 정확히 이 6개다: `focused`, `looking_down`, `absent`, `head_turned`, `looking_up`, `eyes_closed`. 디자인 시스템 스펙의 `--color-reason-*` 토큰 이름이 여기에 1:1로 묶여 있으므로 철자를 바꾸지 않는다.
- `focused: true`인 reason은 **`focused`와 `looking_down` 둘뿐이다.** `looking_down`을 집중으로 치는 것이 이 스펙의 핵심 결정이다(교재·필기를 딴짓으로 오판하지 않기 위함) — 비집중으로 바꾸지 않는다.
- 축별 규칙: **yaw 초과 = 비집중**, **pitch 아래 = 집중(`looking_down`)**, **pitch 위 = 비집중(`looking_up`)**. 기존 코드처럼 `Math.abs(pitch)`로 위아래를 묶지 않는다.
- 판정 우선순위는 `absent` → `eyes_closed` → `head_turned` → `looking_up` → `looking_down` → `focused` 순이다.
- `eyes_closed`는 **연속 2회 tick** 모두 눈 감김일 때만 성립한다(깜빡임 오판 방지).
- 임계값 정확한 값: `maxYawDeg: 30`, `maxPitchUpDeg: 20`, `maxPitchDownDeg: 20`, `eyeBlinkThreshold: 0.5`, `eyeLookDownThreshold: 0.4`, `intervalMs: 5000`. 전부 한 객체(`THRESHOLDS`)에 모아 export 한다.
- blendshape는 **카테고리 이름으로 조회**한다(`'eyeBlinkLeft'` 등). 인덱스 번호를 하드코딩하지 않는다.
- blendshape가 없을 때(`faceBlendshapes`가 비었을 때) 눈·시선 판정을 건너뛰고 고개 방향만으로 동작한다. 세션을 막지 않는다.
- `focus_score`·`timeline`·`duration_seconds`의 계산 방식은 **변경하지 않는다.** 기존 리포트 화면(`Read.js`, `Trashread.js`)이 깨지면 안 된다.
- `focus_breakdown` 컬럼은 nullable이다. 기존 행은 `null`로 남는다.
- **TS-003 준수**: `react-router-dom`을 import하는 파일(`StartLearning.js`)에는 Jest 테스트를 작성하지 않는다(`docs/TROUBLESHOOTING.md` TS-003). 테스트는 `src/lib/focusTracker.js`만 대상으로 한다.
- 신규 npm 의존성 없음. MediaPipe 모델 URL·패키지 버전 변경 없음.

---

### Task 1: 판정 로직에 reason 도입

**Files:**
- Modify: `src/lib/focusTracker.js`
- Modify: `src/lib/focusTracker.test.js` (기존 3개 테스트가 `computeTickFocused`의 boolean 반환에 의존하므로 반드시 갱신)

**Interfaces:**
- Consumes: MediaPipe `FaceLandmarkerResult` — `faceLandmarks`, `facialTransformationMatrixes`, `faceBlendshapes`
- Produces (Task 2가 사용):
  - `THRESHOLDS` — 임계값 객체
  - `REASON` — reason 문자열 상수 객체
  - `computeTickFocused(result, wasEyesClosed, thresholds?) → { focused: boolean, reason: string }`
  - `isEyesClosed(result, thresholds?) → boolean`
  - `computeFocusBreakdown(ticks) → { [reason]: number }`
  - `createFocusTracker({videoEl, faceLandmarker, intervalMs?, onTick})` — `onTick`이 `{ timestampMs, focused, reason }`을 받는다
  - `aggregateSession(ticks, startedAt, endedAt) → { durationSeconds, focusScore, timeline, focusBreakdown }`
  - `loadFaceLandmarker()` — 시그니처 변경 없음

- [ ] **Step 1: 실패하는 테스트를 먼저 작성**

`src/lib/focusTracker.test.js`를 아래 내용으로 **전체 교체**한다. 기존 `computeTickFocused` 테스트 3건은 새 반환 형태에 맞게 고쳐 넣었다.

```javascript
import {
  computeYawPitchDegrees,
  computeTickFocused,
  isEyesClosed,
  computeFocusBreakdown,
  aggregateSession,
  REASON,
} from './focusTracker';

const identityMatrix = {
  data: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
};

const landmarks = [[{ x: 0.5, y: 0.5, z: 0 }]];

// X축 회전 행렬 (row-major). angle 부호가 pitch 부호를 결정한다.
const pitchMatrix = (angleRad) => ({
  data: [
    1, 0, 0, 0,
    0, Math.cos(angleRad), -Math.sin(angleRad), 0,
    0, Math.sin(angleRad), Math.cos(angleRad), 0,
    0, 0, 0, 1,
  ],
});

const yawMatrix = (angleRad) => ({
  data: [
    Math.cos(angleRad), 0, Math.sin(angleRad), 0,
    0, 1, 0, 0,
    -Math.sin(angleRad), 0, Math.cos(angleRad), 0,
    0, 0, 0, 1,
  ],
});

const blendshapes = (entries) => [
  {
    categories: Object.entries(entries).map(([categoryName, score]) => ({
      categoryName,
      score,
    })),
  },
];

describe('computeYawPitchDegrees', () => {
  test('identity matrix returns zero yaw and pitch', () => {
    const { yaw, pitch } = computeYawPitchDegrees(identityMatrix.data);
    expect(yaw).toBeCloseTo(0);
    expect(pitch).toBeCloseTo(0);
  });
});

describe('isEyesClosed', () => {
  test('returns true when both eye blink scores exceed the threshold', () => {
    const result = {
      faceLandmarks: landmarks,
      facialTransformationMatrixes: [identityMatrix],
      faceBlendshapes: blendshapes({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.85 }),
    };
    expect(isEyesClosed(result)).toBe(true);
  });

  test('returns false when only one eye is closed', () => {
    const result = {
      faceLandmarks: landmarks,
      facialTransformationMatrixes: [identityMatrix],
      faceBlendshapes: blendshapes({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.1 }),
    };
    expect(isEyesClosed(result)).toBe(false);
  });

  test('returns false when blendshapes are unavailable', () => {
    const result = {
      faceLandmarks: landmarks,
      facialTransformationMatrixes: [identityMatrix],
      faceBlendshapes: [],
    };
    expect(isEyesClosed(result)).toBe(false);
  });
});

describe('computeTickFocused', () => {
  test('reports absent when no face is detected', () => {
    const result = { faceLandmarks: [], facialTransformationMatrixes: [] };
    expect(computeTickFocused(result, false)).toEqual({
      focused: false,
      reason: REASON.ABSENT,
    });
  });

  test('reports focused when facing the camera straight on', () => {
    const result = {
      faceLandmarks: landmarks,
      facialTransformationMatrixes: [identityMatrix],
    };
    expect(computeTickFocused(result, false)).toEqual({
      focused: true,
      reason: REASON.FOCUSED,
    });
  });

  test('reports head_turned when yaw exceeds the threshold', () => {
    const result = {
      faceLandmarks: landmarks,
      facialTransformationMatrixes: [yawMatrix(Math.PI / 4)],
    };
    expect(computeTickFocused(result, false)).toEqual({
      focused: false,
      reason: REASON.HEAD_TURNED,
    });
  });

  test('reports looking_down (still focused) when pitch tilts down past the threshold', () => {
    // pitch = -asin(m21) 이므로 +45deg 회전은 pitch를 음수로 만든다 = 아래
    const result = {
      faceLandmarks: landmarks,
      facialTransformationMatrixes: [pitchMatrix(Math.PI / 4)],
    };
    expect(computeTickFocused(result, false)).toEqual({
      focused: true,
      reason: REASON.LOOKING_DOWN,
    });
  });

  test('reports looking_up when pitch tilts up past the threshold', () => {
    const result = {
      faceLandmarks: landmarks,
      facialTransformationMatrixes: [pitchMatrix(-Math.PI / 4)],
    };
    expect(computeTickFocused(result, false)).toEqual({
      focused: false,
      reason: REASON.LOOKING_UP,
    });
  });

  test('reports looking_down when gaze is down even though the head is level', () => {
    const result = {
      faceLandmarks: landmarks,
      facialTransformationMatrixes: [identityMatrix],
      faceBlendshapes: blendshapes({
        eyeLookDownLeft: 0.7,
        eyeLookDownRight: 0.6,
      }),
    };
    expect(computeTickFocused(result, false)).toEqual({
      focused: true,
      reason: REASON.LOOKING_DOWN,
    });
  });

  test('does not report eyes_closed on a single closed sample (blink)', () => {
    const result = {
      faceLandmarks: landmarks,
      facialTransformationMatrixes: [identityMatrix],
      faceBlendshapes: blendshapes({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 }),
    };
    expect(computeTickFocused(result, false).reason).not.toBe(
      REASON.EYES_CLOSED
    );
  });

  test('reports eyes_closed when the previous tick was also closed', () => {
    const result = {
      faceLandmarks: landmarks,
      facialTransformationMatrixes: [identityMatrix],
      faceBlendshapes: blendshapes({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 }),
    };
    expect(computeTickFocused(result, true)).toEqual({
      focused: false,
      reason: REASON.EYES_CLOSED,
    });
  });

  test('prioritises eyes_closed over head_turned', () => {
    const result = {
      faceLandmarks: landmarks,
      facialTransformationMatrixes: [yawMatrix(Math.PI / 4)],
      faceBlendshapes: blendshapes({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 }),
    };
    expect(computeTickFocused(result, true).reason).toBe(REASON.EYES_CLOSED);
  });

  test('falls back to head direction only when blendshapes are missing', () => {
    const result = {
      faceLandmarks: landmarks,
      facialTransformationMatrixes: [identityMatrix],
      faceBlendshapes: [],
    };
    expect(computeTickFocused(result, true)).toEqual({
      focused: true,
      reason: REASON.FOCUSED,
    });
  });
});

describe('computeFocusBreakdown', () => {
  test('computes the ratio of each reason', () => {
    const ticks = [
      { reason: REASON.FOCUSED },
      { reason: REASON.FOCUSED },
      { reason: REASON.LOOKING_DOWN },
      { reason: REASON.ABSENT },
    ];
    expect(computeFocusBreakdown(ticks)).toEqual({
      focused: 0.5,
      looking_down: 0.25,
      absent: 0.25,
      head_turned: 0,
      looking_up: 0,
      eyes_closed: 0,
    });
  });

  test('returns all zeros when there are no ticks', () => {
    expect(computeFocusBreakdown([])).toEqual({
      focused: 0,
      looking_down: 0,
      absent: 0,
      head_turned: 0,
      looking_up: 0,
      eyes_closed: 0,
    });
  });
});

describe('aggregateSession', () => {
  test('computes duration, focus score, timeline, and breakdown', () => {
    const startedAt = '2026-08-05T10:00:00.000Z';
    const endedAt = '2026-08-05T10:02:00.000Z';
    const startMs = new Date(startedAt).getTime();

    const ticks = [
      { timestampMs: startMs + 0, focused: true, reason: REASON.FOCUSED },
      { timestampMs: startMs + 5000, focused: true, reason: REASON.FOCUSED },
      { timestampMs: startMs + 65000, focused: false, reason: REASON.ABSENT },
      {
        timestampMs: startMs + 70000,
        focused: true,
        reason: REASON.LOOKING_DOWN,
      },
    ];

    const result = aggregateSession(ticks, startedAt, endedAt);

    expect(result.durationSeconds).toBe(120);
    expect(result.focusScore).toBe(75);
    expect(result.timeline).toEqual([
      { minute: 0, focus_ratio: 1 },
      { minute: 1, focus_ratio: 0.5 },
    ]);
    expect(result.focusBreakdown.focused).toBe(0.5);
    expect(result.focusBreakdown.absent).toBe(0.25);
    expect(result.focusBreakdown.looking_down).toBe(0.25);
  });

  test('returns focus score of 0 when there are no ticks', () => {
    const result = aggregateSession(
      [],
      '2026-08-05T10:00:00.000Z',
      '2026-08-05T10:00:10.000Z'
    );
    expect(result.focusScore).toBe(0);
    expect(result.timeline).toEqual([]);
    expect(result.focusBreakdown.focused).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `CI=true npx react-scripts test src/lib/focusTracker.test.js --watchAll=false`
Expected: FAIL — `REASON`, `isEyesClosed`, `computeFocusBreakdown`이 아직 export되지 않았고 `computeTickFocused`가 boolean을 반환한다.

- [ ] **Step 3: `focusTracker.js` 구현**

`src/lib/focusTracker.js`의 상단(파일 시작 ~ `aggregateSession` 직전)을 아래로 교체한다. `aggregateSession` 이후는 Step 4에서 다룬다.

```javascript
const toDeg = (rad) => (rad * 180) / Math.PI;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const REASON = {
  FOCUSED: 'focused',
  LOOKING_DOWN: 'looking_down',
  ABSENT: 'absent',
  HEAD_TURNED: 'head_turned',
  LOOKING_UP: 'looking_up',
  EYES_CLOSED: 'eyes_closed',
};

// 집중으로 집계하는 reason. looking_down이 여기 있는 이유는 얼굴만 보는
// 모델로 교재와 휴대폰을 구분할 수 없기 때문 - 공부 중인 사용자를 딴짓으로
// 오판하는 쪽이 반대 방향 오차보다 비용이 크다.
const FOCUSED_REASONS = [REASON.FOCUSED, REASON.LOOKING_DOWN];

export const THRESHOLDS = {
  maxYawDeg: 30,
  maxPitchUpDeg: 20,
  maxPitchDownDeg: 20,
  eyeBlinkThreshold: 0.5,
  eyeLookDownThreshold: 0.4,
};

export function computeYawPitchDegrees(matrixData) {
  const yaw = toDeg(Math.atan2(matrixData[8], matrixData[10]));
  const pitch = toDeg(Math.asin(-clamp(matrixData[9], -1, 1)));
  return { yaw, pitch };
}

function getBlendshapeScore(result, categoryName) {
  const shapes = result.faceBlendshapes;
  if (!shapes || shapes.length === 0) {
    return null;
  }
  const category = shapes[0].categories.find(
    (item) => item.categoryName === categoryName
  );
  return category ? category.score : null;
}

export function isEyesClosed(result, thresholds = THRESHOLDS) {
  const left = getBlendshapeScore(result, 'eyeBlinkLeft');
  const right = getBlendshapeScore(result, 'eyeBlinkRight');
  if (left === null || right === null) {
    return false;
  }
  return (
    left > thresholds.eyeBlinkThreshold && right > thresholds.eyeBlinkThreshold
  );
}

function isGazeDown(result, thresholds) {
  const left = getBlendshapeScore(result, 'eyeLookDownLeft');
  const right = getBlendshapeScore(result, 'eyeLookDownRight');
  if (left === null || right === null) {
    return false;
  }
  return (left + right) / 2 > thresholds.eyeLookDownThreshold;
}

function computeTickReason(result, wasEyesClosed, thresholds) {
  const { faceLandmarks, facialTransformationMatrixes } = result;

  if (!faceLandmarks || faceLandmarks.length === 0) {
    return REASON.ABSENT;
  }

  // 깜빡임(0.1~0.4초)과 졸음을 5초 샘플링으로 구분할 수 없으므로,
  // 연속 2회 감겨 있을 때만 졸음으로 본다.
  if (wasEyesClosed && isEyesClosed(result, thresholds)) {
    return REASON.EYES_CLOSED;
  }

  if (
    !facialTransformationMatrixes ||
    facialTransformationMatrixes.length === 0
  ) {
    return isGazeDown(result, thresholds)
      ? REASON.LOOKING_DOWN
      : REASON.FOCUSED;
  }

  const { yaw, pitch } = computeYawPitchDegrees(
    facialTransformationMatrixes[0].data
  );

  if (Math.abs(yaw) > thresholds.maxYawDeg) {
    return REASON.HEAD_TURNED;
  }
  if (pitch > thresholds.maxPitchUpDeg) {
    return REASON.LOOKING_UP;
  }
  if (pitch < -thresholds.maxPitchDownDeg) {
    return REASON.LOOKING_DOWN;
  }
  if (isGazeDown(result, thresholds)) {
    return REASON.LOOKING_DOWN;
  }

  return REASON.FOCUSED;
}

export function computeTickFocused(
  result,
  wasEyesClosed,
  thresholds = THRESHOLDS
) {
  const reason = computeTickReason(result, wasEyesClosed, thresholds);
  return { focused: FOCUSED_REASONS.includes(reason), reason };
}

export function computeFocusBreakdown(ticks) {
  const counts = {
    focused: 0,
    looking_down: 0,
    absent: 0,
    head_turned: 0,
    looking_up: 0,
    eyes_closed: 0,
  };

  ticks.forEach((tick) => {
    if (Object.prototype.hasOwnProperty.call(counts, tick.reason)) {
      counts[tick.reason] += 1;
    }
  });

  if (ticks.length === 0) {
    return counts;
  }

  const breakdown = {};
  Object.keys(counts).forEach((key) => {
    breakdown[key] = Math.round((counts[key] / ticks.length) * 100) / 100;
  });
  return breakdown;
}
```

- [ ] **Step 4: `aggregateSession`·`loadFaceLandmarker`·`createFocusTracker` 갱신**

같은 파일에서 세 곳을 고친다.

`aggregateSession`은 마지막 `return`만 바뀐다:

```javascript
  return {
    durationSeconds,
    focusScore,
    timeline,
    focusBreakdown: computeFocusBreakdown(ticks),
  };
```

`loadFaceLandmarker`의 `createFromOptions` 호출에 옵션 한 줄을 추가한다:

```javascript
    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      outputFacialTransformationMatrixes: true,
      outputFaceBlendshapes: true,
      numFaces: 1,
    });
```

`createFocusTracker`는 직전 tick의 눈 감김 상태를 클로저에 유지한다:

```javascript
export function createFocusTracker({
  videoEl,
  faceLandmarker,
  intervalMs = 5000,
  onTick,
}) {
  let wasEyesClosed = false;

  const timerId = window.setInterval(() => {
    const result = faceLandmarker.detectForVideo(videoEl, performance.now());
    const { focused, reason } = computeTickFocused(result, wasEyesClosed);
    wasEyesClosed = isEyesClosed(result);
    onTick({ timestampMs: Date.now(), focused, reason });
  }, intervalMs);

  return {
    stop() {
      window.clearInterval(timerId);
    },
  };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `CI=true npx react-scripts test src/lib --watchAll=false`
Expected: PASS — `focusTracker.test.js`의 신규·갱신 테스트 전부 통과, `trash.test.js`·`aiChat.test.js` 회귀 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/focusTracker.js src/lib/focusTracker.test.js
git commit -m "feat: 집중도 판정에 눈 감김·시선 신호와 판정 원인 추가"
```

---

### Task 2: breakdown 저장 및 실제 웹캠 검증

**Files:**
- Create: `supabase/migrations/20260805150000_add_focus_breakdown_to_study_sessions.sql`
- Modify: `src/components/StartLearning.js`

**Interfaces:**
- Consumes (Task 1이 제공): `aggregateSession()`의 반환에 추가된 `focusBreakdown`
- Produces: `study_sessions.focus_breakdown` 컬럼에 저장된 원인별 비율. 서브프로젝트 3(리포트)이 이 값을 읽는다

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/20260805150000_add_focus_breakdown_to_study_sessions.sql`:

```sql
alter table study_sessions add column focus_breakdown jsonb;
```

- [ ] **Step 2: Supabase에 마이그레이션 적용**

Supabase Dashboard → SQL Editor에서 위 SQL을 실행한다.

**중요**: `docs/TROUBLESHOOTING.md`의 TS-001 — Monaco 에디터가 괄호를 자동 완성해 여러 줄 SQL이 깨진다. 위 SQL은 한 줄이므로 그대로 붙여넣으면 되지만, 여러 줄로 나누지 말 것.

적용 후 확인:

```sql
select column_name, data_type, is_nullable from information_schema.columns where table_name = 'study_sessions' and column_name = 'focus_breakdown';
```

Expected: `focus_breakdown | jsonb | YES` 한 행.

- [ ] **Step 3: `StartLearning.js`에서 breakdown 저장**

`handleStop` 안의 `aggregateSession` 구조분해에 `focusBreakdown`을 추가한다:

```javascript
    const { focusScore, timeline, focusBreakdown } = aggregateSession(
      ticksRef.current,
      startedAtRef.current,
      endedAt
    );
```

insert 객체에 컬럼 한 줄을 추가한다:

```javascript
      .insert({
        user_id: user.id,
        started_at: startedAtRef.current,
        ended_at: endedAt,
        duration_seconds: Math.round(accumulatedMsRef.current / 1000),
        focus_score: focusScore,
        timeline,
        focus_breakdown: focusBreakdown,
      })
```

`duration_seconds` 줄은 기존 코드 그대로다 — 바꾸지 말 것. 위는 추가 위치를 보여주기 위해 함께 인용한 것이다.

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공. 경고 집합이 이전과 동일해야 한다(기존: mediapipe source map, redundant alt).

- [ ] **Step 5: 브라우저 실측 검증**

`npm start` 후 `/start-learning`에서 로그인 상태로 확인한다. TS-003 때문에 이 화면은 Jest로 커버할 수 없으므로 실측이 유일한 검증 수단이다.

**pitch 부호 확인 (가장 중요)** — MediaPipe의 pitch 부호 규약을 문서로 확정할 수 없어 단위 테스트만으로는 실제 방향과의 대응을 보장할 수 없다. 반드시 눈으로 확인한다:

1. 세션을 시작하고 **고개를 아래로** 숙인다 → 상태 점이 **초록(집중)**을 유지해야 한다
2. **고개를 위로** 든다 → 상태 점이 **빨강(비집중)**으로 바뀌어야 한다

**둘이 반대로 나오면** `focusTracker.js`의 `computeTickReason`에서 아래 두 블록의 비교 방향을 서로 바꾼다:

```javascript
  if (pitch > thresholds.maxPitchUpDeg) {
    return REASON.LOOKING_UP;
  }
  if (pitch < -thresholds.maxPitchDownDeg) {
    return REASON.LOOKING_DOWN;
  }
```

부호를 바꿨다면 Task 1의 `pitchMatrix` 테스트 두 개(`looking_down`/`looking_up`)도 함께 뒤집어 다시 통과시킨다.

**나머지 판정 확인:**

3. 고개를 **좌우로** 45° 돌린다 → 빨강(`head_turned`)
4. 화면 **밖으로 벗어난다** → 빨강(`absent`)
5. **눈을 5초만** 감는다 → 졸음으로 잡히지 않아야 한다(초록 유지 또는 다른 원인)
6. **눈을 15초 이상** 감고 있는다 → 빨강으로 바뀌어야 한다(`eyes_closed`)
7. **고개는 정면인 채 시선만 아래로** 내린다 → 초록 유지(`looking_down`)
8. 콘솔에 새 에러가 없는지 확인

**저장 확인:**

9. 종료 후 Supabase Dashboard → Table Editor → `study_sessions`에서 방금 행의 `focus_breakdown`이 채워졌는지 확인
10. 값들의 합이 1.0 근처(±0.03)인지 확인 — 각 값을 소수 둘째 자리로 반올림하므로 정확히 1.0이 아닐 수 있다. 설계 문서가 "합은 1.0이 된다"고 쓴 것은 반올림 오차를 감안한 근사 표현이다
11. 각 비율이 실제로 한 행동과 대응하는지 대략 확인

**회귀 확인:**

12. `/save`에서 기존 세션(`focus_breakdown`이 null인 행)을 열어 리포트 화면이 그대로 뜨는지 확인
13. `/trash`, `/trashread`도 동일하게 확인

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/20260805150000_add_focus_breakdown_to_study_sessions.sql src/components/StartLearning.js
git commit -m "feat: 세션 종료 시 판정 원인별 비율 저장"
```
