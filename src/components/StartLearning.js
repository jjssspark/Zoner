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
  const streamRef = useRef(null);
  const trackerRef = useRef(null);
  const ticksRef = useRef([]);
  const startedAtRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const elapsedTimerIdRef = useRef(null);
  const accumulatedMsRef = useRef(0);
  const segmentStartedAtRef = useRef(null);

  const [status, setStatus] = useState(STATUS.REQUESTING_CAMERA);
  const [isModelReady, setIsModelReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFocused, setIsFocused] = useState(true);

  // 카메라를 끄고 마지막 프레임이 화면에 얼어붙어 남지 않도록 미리보기도
  // 비운다. 세션 종료(언마운트 포함)에서만 호출한다 - 일시정지에서는 호출하지
  // 않아야 재개 시 카메라 재시작 지연이 없다.
  const releaseCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    // effect가 취소된 뒤(StrictMode의 개발 모드 마운트→클린업→재마운트, 또는
    // 실제 언마운트) getUserMedia가 뒤늦게 resolve되는 경우를 잡기 위한
    // 플래그. streamRef는 이 effect 인스턴스가 취소돼도 컴포넌트 인스턴스에
    // 남아있으므로, "지금 이 effect가 살아있는가"는 별도 클로저 변수로
    // 판단해야 한다.
    let isCancelled = false;

    const start = async () => {
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      } catch (error) {
        if (!isCancelled) {
          setStatus(STATUS.CAMERA_DENIED);
        }
        return;
      }

      if (isCancelled) {
        // 이 effect는 스트림을 받기 전에 이미 클린업됐다. streamRef에는
        // 다음 마운트의 스트림이 들어있을 수 있으므로 건드리지 않고, 이
        // 늦게 도착한 스트림만 즉시 해제해 카메라가 계속 켜져 있는 것을
        // 막는다.
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
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
        if (isCancelled) {
          return;
        }
        faceLandmarkerRef.current = faceLandmarker;
        setIsModelReady(true);
      } catch (error) {
        if (!isCancelled) {
          setStatus(STATUS.MODEL_ERROR);
        }
      }
    };

    start();

    return () => {
      isCancelled = true;
      if (trackerRef.current) {
        trackerRef.current.stop();
      }
      if (elapsedTimerIdRef.current) {
        window.clearInterval(elapsedTimerIdRef.current);
      }
      releaseCamera();
    };
  }, []);

  const handleRetryCamera = () => {
    window.location.reload();
  };

  const beginTicking = () => {
    segmentStartedAtRef.current = Date.now();

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

  const stopTicking = () => {
    if (trackerRef.current) {
      trackerRef.current.stop();
      trackerRef.current = null;
    }
    window.clearInterval(elapsedTimerIdRef.current);

    if (segmentStartedAtRef.current !== null) {
      accumulatedMsRef.current += Date.now() - segmentStartedAtRef.current;
      segmentStartedAtRef.current = null;
    }
  };

  const handleStart = () => {
    startedAtRef.current = new Date().toISOString();
    setStatus(STATUS.RUNNING);
    beginTicking();
  };

  const handlePause = () => {
    stopTicking();
    setStatus(STATUS.PAUSED);
  };

  const handleResume = () => {
    setStatus(STATUS.RUNNING);
    beginTicking();
  };

  const handleStop = async () => {
    stopTicking();
    // 저장 성공 여부와 무관하게 종료 버튼을 누른 시점에 카메라를 끈다.
    // 저장 왕복(await) 뒤로 미루면 실패 시 컴포넌트가 계속 마운트된 채
    // 남아 언마운트 클린업이 돌지 않고, 카메라가 켜진 채로 방치된다.
    releaseCamera();

    setStatus(STATUS.SAVING);

    const endedAt = new Date().toISOString();
    const { focusScore, timeline, focusBreakdown } = aggregateSession(
      ticksRef.current,
      startedAtRef.current,
      endedAt
    );

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 표시용 elapsedSeconds는 setInterval 틱 개수라 백그라운드 탭에서
      // 브라우저가 타이머를 스로틀링하면 실제보다 적게 세어진다. 저장값은
      // 활동 구간마다 누적한 벽시계 시간(accumulatedMsRef)을 사용해
      // 탭이 백그라운드에 있어도 정확한 학습 시간을 기록한다.
      const { data, error } = await supabase
        .from('study_sessions')
        .insert({
          user_id: user.id,
          started_at: startedAtRef.current,
          ended_at: endedAt,
          duration_seconds: Math.round(accumulatedMsRef.current / 1000),
          focus_score: focusScore,
          timeline,
          focus_breakdown: focusBreakdown,
        })
        .select('id')
        .single();

      if (error) {
        setStatus(STATUS.SAVE_ERROR);
        return;
      }

      navigate(`/read?session=${data.id}`);
    } catch (error) {
      setStatus(STATUS.SAVE_ERROR);
    }
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
