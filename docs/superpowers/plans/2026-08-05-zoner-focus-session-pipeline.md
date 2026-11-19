# Zoner 학습 세션 · 집중도 리포트 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (컨트롤러가 worktree 없이 main에서 직접 순차 실행, 비용 절감을 위해 서브에이전트 다중 디스패치 없음). Steps use checkbox (`- [ ]`) syntax for tracking.

> **상태 (2026-08-07 확인)**: 이 계획의 기능은 구현되어 코드베이스에 있다.
> **아래 체크박스는 실행 중에 갱신되지 않았다 — 진행 표시로 신뢰하지 말 것.**
> 미체크는 "안 했다"가 아니라 "표시를 안 했다"이다. 실제 반영 여부는 `src/`
> 코드와 테스트(214건 통과)로 확인한다.

**Goal:** Mypage의 "학습 시작" 버튼을 눌러 웹캠 기반 실시간 집중도 세션을 진행하고, 종료 시 결과가 저장되어 "학습 기록" 목록과 개별 리포트에서 실제 데이터로 확인되게 만든다.

**Architecture:** 프론트엔드(CRA)에서 Supabase를 직접 호출하는 기존 구조 그대로. 웹캠 프레임은 브라우저를 벗어나지 않고, `@mediapipe/tasks-vision`의 `FaceLandmarker`가 5초 간격으로 얼굴 방향을 분석해 집중/비집중 틱만 메모리에 쌓는다. 세션 종료 시 그 틱을 집계한 결과(종합 점수 + 1분 단위 타임라인)만 `study_sessions` 테이블에 저장한다.

**Tech Stack:** React 19, react-router-dom v7, Supabase(Postgres+Auth), `@mediapipe/tasks-vision`(신규 의존성).

## Global Constraints

- 웹캠 녹화 영상은 저장하지 않는다 — 집중도 데이터(점수+타임라인)만 저장
- 집중도 판정 간격: 5초
- 비집중 판정: 얼굴 미검출 **또는** yaw/pitch가 임계값(기본 `maxYawDeg: 30`, `maxPitchDeg: 20`) 초과
- `study_sessions` 스키마: `id uuid pk`, `user_id uuid`, `started_at timestamptz`, `ended_at timestamptz`, `duration_seconds int`, `focus_score int`, `timeline jsonb`, `created_at timestamptz`
- RLS: `auth.uid() = user_id` (select/insert만, delete는 휴지통 서브프로젝트 범위)
- `@mediapipe/tasks-vision`은 `/start-learning` 라우트에서만 동적 import (메인 번들에 포함 금지)
- 집중도 그래프는 SVG/div를 직접 구현 — 차트 라이브러리 추가하지 않음
- 세션 종료는 사용자의 수동 "종료" 버튼 클릭만 지원 — 고정 타이머 없음
- 퍼센트는 항상 "%" 표기 (기존 Mypage 규칙과 동일, "%p" 금지)

---

## Task 1: DB 마이그레이션 — `study_sessions` 테이블

**Files:**
- Create: `supabase/migrations/20260805090000_create_study_sessions.sql`

**Interfaces:**
- Produces: `study_sessions` 테이블 (컬럼은 Global Constraints 참고), RLS 정책 `study_sessions_select_own`, `study_sessions_insert_own`

- [ ] **Step 1: 마이그레이션 SQL 파일 작성**

```sql
-- supabase/migrations/20260805090000_create_study_sessions.sql

create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds int not null,
  focus_score int not null,
  timeline jsonb not null,
  created_at timestamptz not null default now()
);

alter table study_sessions enable row level security;

create policy "study_sessions_select_own"
  on study_sessions for select
  using (auth.uid() = user_id);

create policy "study_sessions_insert_own"
  on study_sessions for insert
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Supabase SQL Editor에서 실행**

프로젝트 `https://uptgtgckddgrnimuohwa.supabase.co`의 SQL Editor에 위 SQL을 그대로 붙여넣고 Run.

- [ ] **Step 3: 검증**

SQL Editor에서 순서대로 실행:

```sql
select * from study_sessions;
```
Expected: 에러 없이 빈 결과셋 (0 rows)

```sql
select policyname from pg_policies where tablename = 'study_sessions' order by policyname;
```
Expected: `study_sessions_insert_own`, `study_sessions_select_own` 2행

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260805090000_create_study_sessions.sql
git commit -m "feat: add study_sessions table with RLS"
```

---

## Task 2: `focusTracker.js` 순수 로직 (집중도 판정 + 집계)

**Files:**
- Create: `src/lib/focusTracker.js`
- Test: `src/lib/focusTracker.test.js`

**Interfaces:**
- Produces:
  - `computeYawPitchDegrees(matrixData: number[]): { yaw: number, pitch: number }` — `matrixData`는 MediaPipe `facialTransformationMatrixes[0].data` 형태의 16개 원소 row-major 4x4 행렬
  - `computeTickFocused(result: { faceLandmarks: any[], facialTransformationMatrixes: Array<{ data: number[] }> }, thresholds?: { maxYawDeg: number, maxPitchDeg: number }): boolean`
  - `aggregateSession(ticks: Array<{ timestampMs: number, focused: boolean }>, startedAt: string, endedAt: string): { durationSeconds: number, focusScore: number, timeline: Array<{ minute: number, focus_ratio: number }> }`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// src/lib/focusTracker.test.js
import {
  computeYawPitchDegrees,
  computeTickFocused,
  aggregateSession,
} from './focusTracker';

describe('computeYawPitchDegrees', () => {
  test('identity matrix returns zero yaw and pitch', () => {
    const identity = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
    const { yaw, pitch } = computeYawPitchDegrees(identity);
    expect(yaw).toBeCloseTo(0);
    expect(pitch).toBeCloseTo(0);
  });
});

describe('computeTickFocused', () => {
  const identityMatrix = {
    data: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  };

  test('returns false when no face is detected', () => {
    const result = { faceLandmarks: [], facialTransformationMatrixes: [] };
    expect(computeTickFocused(result)).toBe(false);
  });

  test('returns true when facing the camera straight on', () => {
    const result = {
      faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      facialTransformationMatrixes: [identityMatrix],
    };
    expect(computeTickFocused(result)).toBe(true);
  });

  test('returns false when yaw exceeds the threshold', () => {
    const angle = Math.PI / 4; // 45deg yaw rotation matrix (row-major)
    const yawMatrix = {
      data: [
        Math.cos(angle), 0, Math.sin(angle), 0,
        0, 1, 0, 0,
        -Math.sin(angle), 0, Math.cos(angle), 0,
        0, 0, 0, 1,
      ],
    };
    const result = {
      faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      facialTransformationMatrixes: [yawMatrix],
    };
    expect(computeTickFocused(result)).toBe(false);
  });
});

describe('aggregateSession', () => {
  test('computes duration, focus score, and per-minute timeline', () => {
    const startedAt = '2026-08-05T10:00:00.000Z';
    const endedAt = '2026-08-05T10:02:00.000Z';
    const startMs = new Date(startedAt).getTime();

    const ticks = [
      { timestampMs: startMs + 0, focused: true },
      { timestampMs: startMs + 5000, focused: true },
      { timestampMs: startMs + 65000, focused: false },
      { timestampMs: startMs + 70000, focused: true },
    ];

    const result = aggregateSession(ticks, startedAt, endedAt);

    expect(result.durationSeconds).toBe(120);
    expect(result.focusScore).toBe(75);
    expect(result.timeline).toEqual([
      { minute: 0, focus_ratio: 1 },
      { minute: 1, focus_ratio: 0.5 },
    ]);
  });

  test('returns focus score of 0 when there are no ticks', () => {
    const result = aggregateSession(
      [],
      '2026-08-05T10:00:00.000Z',
      '2026-08-05T10:00:10.000Z'
    );
    expect(result.focusScore).toBe(0);
    expect(result.timeline).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `CI=true npx react-scripts test src/lib/focusTracker --watchAll=false`
Expected: FAIL — `focusTracker.js` 모듈이 없어서 컴파일 에러

(주의: 프로젝트 전체 `npm test`는 react-router-dom v7 관련 별개 이슈(TS-014)로 깨져 있음. 위처럼 경로를 `src/lib/focusTracker`로 좁혀서 실행하면 `App.test.js`를 건드리지 않아 정상 동작한다 — 세션 중 직접 확인함.)

- [ ] **Step 3: 최소 구현 작성**

```js
// src/lib/focusTracker.js
const toDeg = (rad) => (rad * 180) / Math.PI;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function computeYawPitchDegrees(matrixData) {
  const yaw = toDeg(Math.atan2(matrixData[8], matrixData[10]));
  const pitch = toDeg(Math.asin(-clamp(matrixData[9], -1, 1)));
  return { yaw, pitch };
}

export function computeTickFocused(
  result,
  thresholds = { maxYawDeg: 30, maxPitchDeg: 20 }
) {
  const { faceLandmarks, facialTransformationMatrixes } = result;

  if (!faceLandmarks || faceLandmarks.length === 0) {
    return false;
  }

  if (
    !facialTransformationMatrixes ||
    facialTransformationMatrixes.length === 0
  ) {
    return true;
  }

  const { yaw, pitch } = computeYawPitchDegrees(
    facialTransformationMatrixes[0].data
  );
  return (
    Math.abs(yaw) <= thresholds.maxYawDeg &&
    Math.abs(pitch) <= thresholds.maxPitchDeg
  );
}

export function aggregateSession(ticks, startedAt, endedAt) {
  const durationSeconds = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
  );

  const focusedCount = ticks.filter((tick) => tick.focused).length;
  const focusScore =
    ticks.length === 0 ? 0 : Math.round((focusedCount / ticks.length) * 100);

  const startMs = new Date(startedAt).getTime();
  const buckets = new Map();

  ticks.forEach((tick) => {
    const minute = Math.floor((tick.timestampMs - startMs) / 60000);
    const bucket = buckets.get(minute) || { total: 0, focused: 0 };
    bucket.total += 1;
    if (tick.focused) {
      bucket.focused += 1;
    }
    buckets.set(minute, bucket);
  });

  const timeline = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([minute, bucket]) => ({
      minute,
      focus_ratio: Math.round((bucket.focused / bucket.total) * 100) / 100,
    }));

  return { durationSeconds, focusScore, timeline };
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `CI=true npx react-scripts test src/lib/focusTracker --watchAll=false`
Expected: PASS (7개 테스트 전부)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/focusTracker.js src/lib/focusTracker.test.js
git commit -m "feat: add pure focus-tracking scoring logic"
```

---

## Task 3: 학습 시작 화면 (`StartLearning`) + MediaPipe 연동

**Files:**
- Create: `src/components/StartLearning.js`
- Create: `src/components/StartLearning.css`
- Modify: `src/lib/focusTracker.js` (MediaPipe 연동 함수 추가)
- Modify: `src/App.js` (라우트 등록)
- Modify: `package.json` / `package-lock.json` (신규 의존성)

**Interfaces:**
- Consumes: `computeTickFocused`, `aggregateSession` (Task 2 시그니처 그대로)
- Produces:
  - `async function loadFaceLandmarker(): Promise<FaceLandmarker>` — 결과를 모듈 내부에 캐싱해 재호출 시 재사용
  - `function createFocusTracker({ videoEl: HTMLVideoElement, faceLandmarker: FaceLandmarker, intervalMs?: number, onTick: (tick: { timestampMs: number, focused: boolean }) => void }): { stop(): void }`
  - `StartLearning` 컴포넌트 (default export), 저장 성공 시 `navigate('/read?session=' + id)` 호출

- [ ] **Step 1: 패키지 설치**

```bash
npm install @mediapipe/tasks-vision
```

- [ ] **Step 2: `focusTracker.js`에 MediaPipe 연동 함수 추가**

`src/lib/focusTracker.js` 파일 끝에 추가 (기존 pure 함수는 그대로 둔다):

```js
let cachedFaceLandmarkerPromise = null;

export async function loadFaceLandmarker() {
  if (cachedFaceLandmarkerPromise) {
    return cachedFaceLandmarkerPromise;
  }

  cachedFaceLandmarkerPromise = (async () => {
    const { FaceLandmarker, FilesetResolver } = await import(
      '@mediapipe/tasks-vision'
    );

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );

    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      outputFacialTransformationMatrixes: true,
      numFaces: 1,
    });
  })();

  return cachedFaceLandmarkerPromise;
}

export function createFocusTracker({
  videoEl,
  faceLandmarker,
  intervalMs = 5000,
  onTick,
}) {
  const timerId = window.setInterval(() => {
    const result = faceLandmarker.detectForVideo(videoEl, performance.now());
    const focused = computeTickFocused(result);
    onTick({ timestampMs: Date.now(), focused });
  }, intervalMs);

  return {
    stop() {
      window.clearInterval(timerId);
    },
  };
}
```

- [ ] **Step 3: `StartLearning.js` 작성**

```jsx
// src/components/StartLearning.js
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import {
  loadFaceLandmarker,
  createFocusTracker,
  aggregateSession,
} from '../lib/focusTracker';
import './StartLearning.css';

const STATUS = {
  REQUESTING_CAMERA: 'requesting_camera',
  CAMERA_DENIED: 'camera_denied',
  LOADING_MODEL: 'loading_model',
  MODEL_ERROR: 'model_error',
  RUNNING: 'running',
  SAVING: 'saving',
  SAVE_ERROR: 'save_error',
};

const formatElapsed = (seconds) => {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
};

export const StartLearning = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const trackerRef = useRef(null);
  const ticksRef = useRef([]);
  const startedAtRef = useRef(null);

  const [status, setStatus] = useState(STATUS.REQUESTING_CAMERA);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    let stream;
    let elapsedTimerId;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (error) {
        setStatus(STATUS.CAMERA_DENIED);
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus(STATUS.LOADING_MODEL);

      let faceLandmarker;
      try {
        faceLandmarker = await loadFaceLandmarker();
      } catch (error) {
        setStatus(STATUS.MODEL_ERROR);
        return;
      }

      startedAtRef.current = new Date().toISOString();
      setStatus(STATUS.RUNNING);

      elapsedTimerId = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      trackerRef.current = createFocusTracker({
        videoEl: videoRef.current,
        faceLandmarker,
        onTick: (tick) => {
          ticksRef.current.push(tick);
          setIsFocused(tick.focused);
        },
      });
    };

    start();

    return () => {
      if (trackerRef.current) {
        trackerRef.current.stop();
      }
      if (elapsedTimerId) {
        window.clearInterval(elapsedTimerId);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleRetryCamera = () => {
    window.location.reload();
  };

  const handleStop = async () => {
    if (trackerRef.current) {
      trackerRef.current.stop();
    }

    setStatus(STATUS.SAVING);

    const endedAt = new Date().toISOString();
    const { durationSeconds, focusScore, timeline } = aggregateSession(
      ticksRef.current,
      startedAtRef.current,
      endedAt
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: user.id,
        started_at: startedAtRef.current,
        ended_at: endedAt,
        duration_seconds: durationSeconds,
        focus_score: focusScore,
        timeline,
      })
      .select('id')
      .single();

    if (error) {
      setStatus(STATUS.SAVE_ERROR);
      return;
    }

    navigate(`/read?session=${data.id}`);
  };

  return (
    <div className="start-learning">
      <header className="start-learning__topbar">
        <h1 className="start-learning__title">학습 시작</h1>
        <button
          type="button"
          className="start-learning__home"
          onClick={() => navigate('/mypage')}
        >
          HOME
        </button>
      </header>

      <main className="start-learning__main">
        {status === STATUS.CAMERA_DENIED && (
          <p className="start-learning__error" role="alert">
            카메라 권한이 필요합니다.{' '}
            <button type="button" onClick={handleRetryCamera}>
              다시 시도
            </button>
          </p>
        )}

        {status === STATUS.MODEL_ERROR && (
          <p className="start-learning__error" role="alert">
            AI 모델을 불러오지 못했습니다.{' '}
            <button type="button" onClick={handleRetryCamera}>
              다시 시도
            </button>
          </p>
        )}

        {status === STATUS.SAVE_ERROR && (
          <p className="start-learning__error" role="alert">
            저장에 실패했습니다. 네트워크를 확인하고 다시 시도해주세요.{' '}
            <button type="button" onClick={handleStop}>
              다시 저장
            </button>
          </p>
        )}

        <div className="start-learning__video-wrap">
          <video
            ref={videoRef}
            className="start-learning__video"
            muted
            playsInline
          />
          {status === STATUS.RUNNING && (
            <span
              className={`start-learning__status-dot ${
                isFocused ? 'is-focused' : 'is-unfocused'
              }`}
              aria-hidden="true"
            />
          )}
        </div>

        {(status === STATUS.RUNNING || status === STATUS.SAVING) && (
          <>
            <p className="start-learning__timer">
              {formatElapsed(elapsedSeconds)}
            </p>
            <p className="start-learning__status-text">
              {isFocused ? '집중 중' : '비집중 감지'}
            </p>
            <button
              type="button"
              className="start-learning__stop"
              onClick={handleStop}
              disabled={status === STATUS.SAVING}
            >
              {status === STATUS.SAVING ? '저장 중...' : '종료'}
            </button>
          </>
        )}
      </main>
    </div>
  );
};

export default StartLearning;
```

- [ ] **Step 4: `StartLearning.css` 작성**

```css
/* src/components/StartLearning.css */
.start-learning {
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.start-learning__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.start-learning__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  margin: 0;
}

.start-learning__home {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.start-learning__home:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.start-learning__home:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.start-learning__main {
  max-width: 560px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}

.start-learning__error {
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.start-learning__video-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.start-learning__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.start-learning__status-dot {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-surface);
}

.start-learning__status-dot.is-focused {
  background-color: var(--color-success);
}

.start-learning__status-dot.is-unfocused {
  background-color: var(--color-danger);
}

.start-learning__timer {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  margin: 0;
}

.start-learning__status-text {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin: 0;
}

.start-learning__stop {
  background-color: var(--color-danger);
  border: none;
  border-radius: var(--radius-full);
  color: white;
  font-size: var(--text-sm);
  font-weight: 700;
  padding: var(--space-3) var(--space-8);
  cursor: pointer;
}

.start-learning__stop:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.start-learning__stop:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 5: `App.js`에 라우트 등록**

`src/App.js`의 `import Mypage from './components/Mypage';` 아래에 추가:

```js
import StartLearning from './components/StartLearning';
```

`<Route path="/mypage" element={<Mypage />} />` 아래에 추가:

```jsx
<Route path="/start-learning" element={<StartLearning />} />
```

- [ ] **Step 6: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공 (기존 경고 외 신규 에러 없음), 빌드 후 `build/` 폴더 삭제

- [ ] **Step 7: 브라우저 수동 검증**

1. `npm start`로 개발 서버 기동, 로그인 상태로 `/start-learning` 접속
2. 카메라 권한 허용 → 미리보기 영상(좌우 반전) + 타이머가 도는지 확인
3. 몇 초 뒤 얼굴을 화면 밖으로 돌렸다가 5초 이상 유지 → 상태 텍스트가 "비집중 감지"로 바뀌고 점이 빨간색으로 바뀌는지 확인
4. "종료" 클릭 → Supabase 대시보드의 `study_sessions` 테이블에 새 row가 생겼는지 확인 (`focus_score`, `timeline` 값이 그럴듯한지)
5. `/read?session=...`로 리다이렉트되는지 확인 (Read.js는 아직 Task 4에서 재작성 전이라 기존 스캐폴드가 보이는 게 정상 — 이 단계에선 URL과 DB row만 확인)

- [ ] **Step 8: 커밋**

```bash
git add src/components/StartLearning.js src/components/StartLearning.css src/lib/focusTracker.js src/App.js package.json package-lock.json
git commit -m "feat: add live focus-tracking session screen"
```

---

## Task 4: 학습 기록 목록(`Save`) + 리포트 상세(`Read`) 재작성

**Files:**
- Modify: `src/components/Save.js` (전면 재작성)
- Modify: `src/components/Save.css` (전면 재작성)
- Modify: `src/components/Read.js` (전면 재작성, CSS import를 `./SessionReport.css`로 변경)
- Create: `src/components/SessionReport.css`
- Delete: `src/components/Save_report.js`, `src/components/Report_a.js`, `src/components/Report_a.css`
- Modify: `src/App.js` (삭제된 컴포넌트의 import/route 제거)

**Interfaces:**
- Consumes: `study_sessions` 스키마 (Task 1), 저장된 `timeline` 형태 (Task 2의 `aggregateSession` 반환값과 동일)

**주의:** `Save_report.js`는 지금 `./Save.css`를 같이 쓰고 있고 `Trashread.js`는 `./Read.css`를 같이 쓰고 있다 (둘 다 grep으로 확인함). `Save.css`는 `Save_report.js`를 이 태스크에서 같이 지우므로 전면 재작성해도 안전하지만, `Read.css`는 범위 밖인 `Trashread.js`가 계속 쓰기 때문에 건드리지 않는다 — `Read.js`는 새 파일 `SessionReport.css`를 쓰도록 import를 바꾼다.

- [ ] **Step 1: `Save.js` 전면 재작성**

```jsx
// src/components/Save.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import './Save.css';

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
};

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
};

export const Save = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSessions = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      const { data } = await supabase
        .from('study_sessions')
        .select('id, started_at, duration_seconds, focus_score')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (isMounted) {
        setSessions(data || []);
        setIsLoading(false);
      }
    };

    loadSessions();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (isLoading) {
    return <div className="save-page" />;
  }

  return (
    <div className="save-page">
      <header className="save-page__topbar">
        <h1 className="save-page__title">학습 기록</h1>
        <button
          type="button"
          className="save-page__home"
          onClick={() => navigate('/mypage')}
        >
          HOME
        </button>
      </header>

      <main className="save-page__main">
        {sessions.length === 0 ? (
          <p className="save-page__empty">아직 학습 세션이 없습니다.</p>
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className="session-card"
                  onClick={() => navigate(`/read?session=${session.id}`)}
                >
                  <span className="session-card__date">
                    {formatDate(session.started_at)}
                  </span>
                  <span className="session-card__duration">
                    {formatDuration(session.duration_seconds)}
                  </span>
                  <span className="session-card__score">
                    {session.focus_score}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default Save;
```

- [ ] **Step 2: `Save.css` 전면 교체**

```css
/* src/components/Save.css */
.save-page {
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.save-page__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.save-page__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  margin: 0;
}

.save-page__home {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.save-page__home:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.save-page__home:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.save-page__main {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.save-page__empty {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.session-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.session-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  width: 100%;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--text-sm);
  padding: var(--space-4);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--duration-normal) var(--ease-out-expo),
    transform var(--duration-normal) var(--ease-out-expo);
}

.session-card:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.session-card:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.session-card__date {
  color: var(--color-text-muted);
}

.session-card__score {
  font-weight: 700;
  color: var(--color-accent);
}
```

- [ ] **Step 3: `Read.js` 전면 재작성**

```jsx
// src/components/Read.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import './SessionReport.css';

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

export const Read = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      if (!sessionId) {
        if (isMounted) {
          setNotFound(true);
          setIsLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from('study_sessions')
        .select('id, started_at, duration_seconds, focus_score, timeline')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (isMounted) {
        if (data) {
          setSession(data);
        } else {
          setNotFound(true);
        }
        setIsLoading(false);
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [navigate, sessionId]);

  if (isLoading) {
    return <div className="session-report" />;
  }

  return (
    <div className="session-report">
      <header className="session-report__topbar">
        <h1 className="session-report__title">학습 리포트</h1>
        <button
          type="button"
          className="session-report__home"
          onClick={() => navigate('/save')}
        >
          목록으로
        </button>
      </header>

      <main className="session-report__main">
        {notFound ? (
          <p className="session-report__empty">
            해당 학습 세션을 찾을 수 없습니다.
          </p>
        ) : (
          <>
            <p className="session-report__date">
              {formatDate(session.started_at)}
            </p>
            <div className="session-report__score">
              <span className="session-report__score-value">
                {session.focus_score}%
              </span>
              <span className="session-report__score-label">종합 집중도</span>
            </div>

            <div
              className="focus-chart"
              role="img"
              aria-label={`시간대별 집중도 그래프. 종합 집중도 ${session.focus_score}%`}
            >
              <div className="focus-chart__track">
                {session.timeline.map((bucket) => (
                  <div
                    key={bucket.minute}
                    className="focus-chart__bar"
                    style={{ height: `${Math.round(bucket.focus_ratio * 100)}%` }}
                  />
                ))}
              </div>
              <div className="focus-chart__labels">
                {session.timeline.map((bucket) => (
                  <span key={bucket.minute} className="focus-chart__minute">
                    {bucket.minute}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Read;
```

- [ ] **Step 4: `SessionReport.css` 신설**

```css
/* src/components/SessionReport.css */
.session-report {
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.session-report__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.session-report__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  margin: 0;
}

.session-report__home {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.session-report__home:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.session-report__home:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.session-report__main {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.session-report__empty {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.session-report__date {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-4);
}

.session-report__score {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  margin-bottom: var(--space-8);
}

.session-report__score-value {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-accent);
}

.session-report__score-label {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.focus-chart {
  padding: var(--space-4);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.focus-chart__track {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  height: 150px;
}

.focus-chart__bar {
  width: 12px;
  min-width: 12px;
  min-height: 2px;
  background-color: var(--color-accent);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.focus-chart__labels {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.focus-chart__minute {
  width: 12px;
  min-width: 12px;
  text-align: center;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
```

- [ ] **Step 5: 폐기 파일 삭제**

```bash
git rm src/components/Save_report.js src/components/Report_a.js src/components/Report_a.css
```

- [ ] **Step 6: `App.js`에서 삭제된 컴포넌트 참조 제거**

`src/App.js`에서 다음 두 import 라인 삭제:
```js
import Report_a from './components/Report_a';
import Save_report from './components/Save_report';
```

다음 두 `<Route>` 라인 삭제:
```jsx
<Route path="/report_a" element={<Report_a />} />
<Route path="/save_report" element={<Save_report />} />
```

- [ ] **Step 7: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공, 삭제된 파일 관련 참조 에러 없음. 빌드 후 `build/` 폴더 삭제.

- [ ] **Step 8: 브라우저 수동 검증**

1. Task 3에서 만든 세션으로 `/save` 접속 → 방금 세션이 목록에 날짜·시간·점수로 표시되는지 확인
2. 클릭 → `/read?session=<id>`로 이동, 종합 점수와 시간대별 막대 그래프가 보이는지 확인
3. `/trashread`(범위 밖)가 여전히 기존 모습 그대로인지 확인 — `Read.css`를 건드리지 않았으므로 회귀가 없어야 함

- [ ] **Step 9: 커밋**

```bash
git add src/components/Save.js src/components/Save.css src/components/Read.js src/components/SessionReport.css src/App.js
git commit -m "feat: rebuild session list and report detail screens"
```

---

## Task 5: Mypage 연동 정리

**Files:**
- Modify: `src/components/Mypage.js`
- Modify: `src/components/Mypage.css`

**Interfaces:**
- Consumes: `/start-learning` 라우트 (Task 3), `/save`·`/read` 페이지 (Task 4), `study_sessions` 스키마 (Task 1)

- [ ] **Step 1: `QUICK_ACTIONS`에서 "학습 리포트" 항목 제거**

`src/components/Mypage.js`의 `QUICK_ACTIONS` 배열에서 다음 줄 삭제:
```js
  { label: '학습 리포트', path: '/save_report', icon: '▦' },
```

(`'학습 시작'` 항목은 이미 `path: '/start-learning'`으로 되어 있으므로 그대로 둔다.)

- [ ] **Step 2: 죽은 state를 실제 세션 데이터로 교체**

`learningVideos`/`reportVideos`/`addLearningVideo`/`addReportVideo` (어디서도 호출되지 않는 죽은 코드) 전체를 삭제하고 아래로 교체:

```js
const [recentSessions, setRecentSessions] = useState([]);
```

`loadUser` 함수 안에서 프로필 조회 다음에 세션 조회를 추가:

```js
const { data: sessions } = await supabase
  .from('study_sessions')
  .select('id, started_at, focus_score')
  .eq('user_id', user.id)
  .order('started_at', { ascending: false })
  .limit(3);
```

`if (isMounted)` 블록에 `setRecentSessions(sessions || []);` 추가.

- [ ] **Step 3: "최근 리포트" `<section>` 전체 삭제**

`aria-labelledby="recent-reports-heading"`인 `<section>` 블록 전체를 JSX에서 삭제.

- [ ] **Step 4: "최근 기록" `<section>`을 실제 데이터로 교체**

```jsx
<section
  aria-labelledby="recent-records-heading"
  className="record-section"
>
  <div className="record-section__header">
    <div>
      <h2 id="recent-records-heading" className="record-section__title">
        최근 기록
      </h2>
      <p className="record-section__desc">
        {recentSessions.length > 0
          ? `최근 학습 세션 ${recentSessions.length}개`
          : '아직 학습 세션이 없습니다.'}
      </p>
    </div>
    <button
      type="button"
      className="record-section__link"
      onClick={() => navigate('/save')}
    >
      <span>전체 기록 보기</span>
      <span className="record-section__arrow" aria-hidden="true">
        →
      </span>
    </button>
  </div>
  <div className="record-grid">
    {recentSessions.length > 0 ? (
      recentSessions.map((session) => (
        <button
          key={session.id}
          type="button"
          className="record-card"
          onClick={() => navigate(`/read?session=${session.id}`)}
        >
          {new Date(session.started_at).toLocaleDateString('ko-KR')} ·{' '}
          {session.focus_score}%
        </button>
      ))
    ) : (
      <p className="record-grid__empty">학습 세션이 없습니다.</p>
    )}
  </div>
</section>
```

- [ ] **Step 5: `.record-card`가 버튼으로도 쓰이도록 CSS 보강**

`src/components/Mypage.css`의 기존 `.record-card` 규칙 뒤에 추가:

```css
.record-card {
  border: 1px solid var(--color-border);
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
  transition: border-color var(--duration-normal) var(--ease-out-expo),
    transform var(--duration-normal) var(--ease-out-expo);
}

.record-card:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.record-card:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 6: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공. 빌드 후 `build/` 폴더 삭제.

- [ ] **Step 7: 브라우저 수동 검증**

1. `/mypage` 접속 → "최근 리포트" 섹션이 사라졌는지 확인
2. "최근 기록"에 Task 3~4에서 만든 세션이 날짜·점수로 표시되는지, 클릭 시 `/read?session=...`로 이동하는지 확인
3. 빠른 실행에서 "학습 리포트" 버튼이 사라졌는지, "학습 시작" 클릭 시 `/start-learning`으로 이동하는지 확인

- [ ] **Step 8: 커밋**

```bash
git add src/components/Mypage.js src/components/Mypage.css
git commit -m "feat: wire Mypage recent records to real study sessions"
```

---

## 완료 후

모든 태스크 완료 후 `superpowers:finishing-a-development-branch`로 마무리 (이번 작업은 main에 직접 커밋했으므로 별도 머지 없이 `npm run build` 최종 확인 후 push 여부만 사용자에게 확인).
