# 학습 세션 시작/중지/재개/종료 제어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **상태 (2026-08-07 확인)**: 이 계획의 기능은 구현되어 코드베이스에 있다.
> **아래 체크박스는 실행 중에 갱신되지 않았다 — 진행 표시로 신뢰하지 말 것.**
> 미체크는 "안 했다"가 아니라 "표시를 안 했다"이다. 실제 반영 여부는 `src/`
> 코드와 테스트(214건 통과)로 확인한다.

**Goal:** `/start-learning` 화면을 자동 시작·단일 종료 구조에서 사용자가 명시적으로 조작하는 시작/중지/재개/종료 상태 머신으로 바꾼다.

**Architecture:** 캠 스트림과 AI 모델은 마운트 시 한 번만 획득하고 페이지를 벗어날 때까지 유지한다. "중지"는 분석 인터벌·경과 시간 인터벌만 멈추고, "재개"는 같은 비디오/모델 인스턴스로 인터벌만 재생성한다. `duration_seconds`는 벽시계 차이 대신 `RUNNING` 상태에서만 증가하는 `elapsedSeconds` 카운터 값을 그대로 저장한다.

**Tech Stack:** React 19 (CRA/react-scripts), 기존 `src/lib/focusTracker.js`(변경 없음) 재사용.

## Global Constraints

- STATUS enum 정확한 값: `REQUESTING_CAMERA`, `CAMERA_DENIED`, `PREVIEW`, `MODEL_ERROR`, `RUNNING`, `PAUSED`, `SAVING`, `SAVE_ERROR` — 기존 `LOADING_MODEL`은 제거한다(전용 화면 없이 `PREVIEW` 내부 `isModelReady` 플래그로 대체).
- `duration_seconds`로 저장하는 값은 반드시 `elapsedSeconds` state(=RUNNING일 때만 1초마다 증가)다. 벽시계 `endedAt - startedAt` 차이를 쓰지 않는다.
- 캠 스트림 획득(`getUserMedia`)과 AI 모델 로딩(`loadFaceLandmarker`)은 마운트 effect에서 딱 한 번만 실행한다. "중지"는 카메라 스트림을 절대 건드리지 않는다(트랙 정지 없음) — 인터벌만 clear한다.
- **TS-003 준수**: `StartLearning.js`는 `react-router-dom`(`useNavigate`)을 import하므로 이 파일을 대상으로 한 Jest 테스트 파일을 작성하지 않는다(`docs/TROUBLESHOOTING.md` TS-003 참고). `src/lib/focusTracker.js`는 이번 작업에서 변경하지 않으므로 기존 `focusTracker.test.js`도 그대로 둔다.
- 신규 파일 없음, 삭제 파일 없음 — `src/components/StartLearning.js`와 `src/components/StartLearning.css` 두 파일만 수정한다.
- `.start-learning__stop`("종료" 버튼)의 danger 색상 스타일은 그대로 유지한다. 신규 `중지`/`재개` 버튼은 `--color-accent` 톤을 쓴다(파괴적 동작이 아니므로).

---

### Task 1: 시작/중지/재개/종료 상태 머신 구현

**Files:**
- Modify: `src/components/StartLearning.js` (전체 재작성)
- Modify: `src/components/StartLearning.css` (버튼 스타일 추가)

**Interfaces:**
- Consumes: `src/lib/focusTracker.js`의 `loadFaceLandmarker()`, `createFocusTracker({ videoEl, faceLandmarker, onTick })`, `aggregateSession(ticks, startedAt, endedAt)` — 시그니처 변경 없음, 그대로 재사용
- Produces: 이 파일을 참조하는 다른 파일 없음(라우트 컴포넌트) — 외부 인터페이스 변화 없음

- [ ] **Step 1: `StartLearning.js` 전체 교체**

기존 파일 전체를 아래 내용으로 교체한다:

```javascript
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
  PREVIEW: 'preview',
  MODEL_ERROR: 'model_error',
  RUNNING: 'running',
  PAUSED: 'paused',
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
  const faceLandmarkerRef = useRef(null);
  const elapsedTimerIdRef = useRef(null);

  const [status, setStatus] = useState(STATUS.REQUESTING_CAMERA);
  const [isModelReady, setIsModelReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    let stream;
    let isModelLoadCancelled = false;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (error) {
        setStatus(STATUS.CAMERA_DENIED);
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (error) {
          // play() rejects if interrupted by a fast unmount/remount (React
          // StrictMode double-invokes effects in dev) - the stream still
          // attaches and plays correctly, so this is safe to ignore.
        }
      }

      setStatus(STATUS.PREVIEW);

      try {
        const faceLandmarker = await loadFaceLandmarker();
        if (isModelLoadCancelled) {
          return;
        }
        faceLandmarkerRef.current = faceLandmarker;
        setIsModelReady(true);
      } catch (error) {
        if (!isModelLoadCancelled) {
          setStatus(STATUS.MODEL_ERROR);
        }
      }
    };

    start();

    return () => {
      isModelLoadCancelled = true;
      if (trackerRef.current) {
        trackerRef.current.stop();
      }
      if (elapsedTimerIdRef.current) {
        window.clearInterval(elapsedTimerIdRef.current);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleRetryCamera = () => {
    window.location.reload();
  };

  const beginTicking = () => {
    elapsedTimerIdRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    trackerRef.current = createFocusTracker({
      videoEl: videoRef.current,
      faceLandmarker: faceLandmarkerRef.current,
      onTick: (tick) => {
        ticksRef.current.push(tick);
        setIsFocused(tick.focused);
      },
    });
  };

  const handleStart = () => {
    startedAtRef.current = new Date().toISOString();
    setStatus(STATUS.RUNNING);
    beginTicking();
  };

  const handlePause = () => {
    if (trackerRef.current) {
      trackerRef.current.stop();
      trackerRef.current = null;
    }
    window.clearInterval(elapsedTimerIdRef.current);
    setStatus(STATUS.PAUSED);
  };

  const handleResume = () => {
    setStatus(STATUS.RUNNING);
    beginTicking();
  };

  const handleStop = async () => {
    if (trackerRef.current) {
      trackerRef.current.stop();
      trackerRef.current = null;
    }
    window.clearInterval(elapsedTimerIdRef.current);

    setStatus(STATUS.SAVING);

    const endedAt = new Date().toISOString();
    const { focusScore, timeline } = aggregateSession(
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
        duration_seconds: elapsedSeconds,
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
        <div className="start-learning__topbar-actions">
          <button
            type="button"
            className="start-learning__back"
            onClick={() => navigate(-1)}
          >
            뒤로가기
          </button>
          <button
            type="button"
            className="start-learning__home"
            onClick={() => navigate('/mypage')}
          >
            HOME
          </button>
        </div>
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

        {status === STATUS.PREVIEW && (
          <button
            type="button"
            className="start-learning__start"
            onClick={handleStart}
            disabled={!isModelReady}
          >
            {isModelReady ? '시작' : '모델 준비 중...'}
          </button>
        )}

        {(status === STATUS.RUNNING ||
          status === STATUS.PAUSED ||
          status === STATUS.SAVING) && (
          <>
            <p className="start-learning__timer">
              {formatElapsed(elapsedSeconds)}
            </p>
            <p className="start-learning__status-text">
              {status === STATUS.PAUSED
                ? '일시정지됨'
                : isFocused
                ? '집중 중'
                : '비집중 감지'}
            </p>
            <div className="start-learning__controls">
              {status === STATUS.RUNNING && (
                <button
                  type="button"
                  className="start-learning__pause"
                  onClick={handlePause}
                >
                  중지
                </button>
              )}
              {status === STATUS.PAUSED && (
                <button
                  type="button"
                  className="start-learning__resume"
                  onClick={handleResume}
                >
                  재개
                </button>
              )}
              <button
                type="button"
                className="start-learning__stop"
                onClick={handleStop}
                disabled={status === STATUS.SAVING}
              >
                {status === STATUS.SAVING ? '저장 중...' : '종료'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default StartLearning;
```

- [ ] **Step 2: `StartLearning.css`에 버튼 스타일 추가**

`.start-learning__stop:focus-visible { ... }` 규칙 바로 뒤(파일 끝)에 아래를 추가한다:

```css
.start-learning__start {
  background-color: var(--color-accent);
  border: none;
  border-radius: var(--radius-full);
  color: white;
  font-size: var(--text-sm);
  font-weight: 700;
  padding: var(--space-3) var(--space-8);
  cursor: pointer;
}

.start-learning__start:hover {
  background-color: var(--color-accent-hover);
}

.start-learning__start:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.start-learning__start:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.start-learning__controls {
  display: flex;
  gap: var(--space-3);
}

.start-learning__pause,
.start-learning__resume {
  background-color: var(--color-accent);
  border: none;
  border-radius: var(--radius-full);
  color: white;
  font-size: var(--text-sm);
  font-weight: 700;
  padding: var(--space-3) var(--space-8);
  cursor: pointer;
}

.start-learning__pause:hover,
.start-learning__resume:hover {
  background-color: var(--color-accent-hover);
}

.start-learning__pause:focus-visible,
.start-learning__resume:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build` (프로젝트 루트 `src`가 있는 `zoner/` 디렉터리에서 실행)
Expected: 컴파일 에러 없이 성공.

- [ ] **Step 4: 브라우저 수동 검증**

`npm start`로 개발 서버를 띄우고 `/start-learning`에서 로그인 후 확인 (TS-003 때문에 이 파일은 Jest 테스트로 커버할 수 없으므로 수동 검증이 유일한 검증 수단):

1. 페이지 진입 → 캠 미리보기만 뜨고 "시작" 버튼이 비활성화("모델 준비 중...")인지 확인
2. 잠시 후 모델 로딩 완료 → "시작" 버튼 활성화("시작" 텍스트로 바뀜) 확인
3. "시작" 클릭 → 타이머가 올라가고 집중/비집중 상태 점이 나타나는지 확인, 버튼이 "중지"+"종료" 두 개로 바뀌는지 확인
4. "중지" 클릭 → 타이머가 멈추고, 상태 텍스트가 "일시정지됨"으로 바뀌고, 상태 점이 사라지고, 캠 미리보기는 계속 보이는지(스트림 안 끊김) 확인, 버튼이 "재개"+"종료"로 바뀌는지 확인
5. 몇 초 대기 후 "재개" 클릭 → 타이머가 멈췄던 값에서 이어서 올라가는지, 상태 점이 다시 나타나는지 확인
6. 중지↔재개를 2~3회 반복해도 정상 동작하는지 확인
7. "종료" 클릭 → "저장 중..." 표시 후 `/read?session=...`로 이동, 리포트에 표시되는 시간이 중지 구간을 제외한 순수 활동 시간과 대략 일치하는지 확인
8. Supabase 대시보드의 `study_sessions` 테이블에서 방금 생성된 row의 `duration_seconds`가 화면에서 본 순수 활동 시간과 일치하는지 확인
9. 콘솔에 새로운 에러가 없는지 확인

- [ ] **Step 5: 커밋**

```bash
git add src/components/StartLearning.js src/components/StartLearning.css
git commit -m "feat: 학습 세션 시작/중지/재개/종료 제어 추가"
```
