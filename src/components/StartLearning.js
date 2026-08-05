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
  const accumulatedMsRef = useRef(0);
  const segmentStartedAtRef = useRef(null);

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

    setStatus(STATUS.SAVING);

    const endedAt = new Date().toISOString();
    const { focusScore, timeline } = aggregateSession(
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
