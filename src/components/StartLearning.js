import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import {
  loadFaceLandmarker,
  createFocusTracker,
  aggregateSession,
} from '../lib/focusTracker';
import { createAlertEngine, ALERT_MESSAGES } from '../lib/alertEngine';
import { loadAlertMuted, saveAlertMuted, playAlertTone } from '../lib/alertSound';
import {
  createSessionRecorder,
  isRecordingSupported,
  RECORDER_MIME_TYPE,
} from '../lib/sessionRecorder';
import ConfirmDialog from './ui/ConfirmDialog';
import {
  SESSION_VIDEO_BUCKET,
  MAX_STORED_VIDEOS,
  buildVideoPath,
  isVideoLimitReached,
  isVideoTooLarge,
  pickOldestVideoSession,
} from '../lib/sessionVideos';
import './StartLearning.css';

const STATUS = {
  REQUESTING_CAMERA: 'requesting_camera',
  CAMERA_DENIED: 'camera_denied',
  PREVIEW: 'preview',
  MODEL_ERROR: 'model_error',
  RUNNING: 'running',
  PAUSED: 'paused',
  SAVING: 'saving',
  // 학습 기록은 저장됐고 영상 업로드만 실패한 종료 상태. SAVING에 머무르면
  // 종료 버튼이 "저장 중..."인 채로 영영 잠겨 돌아가지도 않는 작업을
  // 진행 중이라고 거짓말한다. 이 시점에 남은 동작은 리포트 이동뿐이므로
  // 타이머와 컨트롤을 내리고 안내 배너만 남긴다.
  VIDEO_SAVE_FAILED: 'video_save_failed',
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
  const alertEngineRef = useRef(null);
  const audioContextRef = useRef(null);
  const isMutedRef = useRef(false);
  const recorderRef = useRef(null);
  // 사용자가 저장을 확정한 영상. 저장이 실패해 재시도할 때 다시 쓴다.
  // 레코더는 이미 멈춰서 다시 만들 수 없으므로 여기 쥐고 있어야 한다.
  const confirmedVideoRef = useRef(null);
  // 종료 처리가 진행 중인지. 녹화 경로의 handleStop은 getUser + 영상 세션
  // 조회로 await 구간이 열려 있는데, 그동안 종료 버튼은 아직 잠기지 않는다.
  // 연타하면 같은 조회가 중복되고 setPendingSave가 덮어써진다.
  const isStoppingRef = useRef(false);

  const [status, setStatus] = useState(STATUS.REQUESTING_CAMERA);
  const [isModelReady, setIsModelReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFocused, setIsFocused] = useState(true);
  const [activeAlert, setActiveAlert] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [recordingError, setRecordingError] = useState(null);
  // { oldest } — 종료 확인 다이얼로그가 떠 있는 동안의 보류 상태.
  // oldest가 있으면 한도가 찬 것이고, 저장하려면 그것을 먼저 지워야 한다.
  // 영상 Blob은 여기 담지 않는다 — 사용자가 고른 뒤에 레코더를 멈춰 만든다.
  const [pendingSave, setPendingSave] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [videoSaveError, setVideoSaveError] = useState(null);
  // 업로드는 실패했지만 학습 기록은 저장된 상태. 사용자가 리포트로 갈 수 있게 id를 쥐고 있는다.
  const [savedSessionId, setSavedSessionId] = useState(null);

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
      // 저장하지 않고 화면을 떠나면 녹화분은 버린다. stop()의 Promise는
      // 받을 곳이 없으므로 기다리지 않는다. 버리는 blob이라도 트랙보다
      // 레코더를 먼저 멈춘다 — 순서가 뒤바뀌면 onerror가 발동한다.
      if (recorderRef.current) {
        recorderRef.current.stop();
        recorderRef.current = null;
      }
      releaseCamera();
      // AudioContext는 브라우저가 동시 생성 개수를 제한한다(Chrome 기준 약 6개).
      // 닫지 않고 페이지를 떠나면 반복 진입 시 한도에 도달해 알림음이 조용히
      // 멈춘다. close()는 이미 닫힌 컨텍스트에서 reject할 수 있으므로 무시한다.
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  const handleRetryCamera = () => {
    window.location.reload();
  };

  useEffect(() => {
    const muted = loadAlertMuted();
    setIsMuted(muted);
    isMutedRef.current = muted;
  }, []);

  const beginTicking = () => {
    segmentStartedAtRef.current = Date.now();

    elapsedTimerIdRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    trackerRef.current = createFocusTracker({
      videoEl: videoRef.current,
      faceLandmarker: faceLandmarkerRef.current,
      onTick: (tick) => {
        // 영상은 일시정지 구간이 빠져 있으므로, 그래프와 알림도 벽시계가 아니라
        // 순수 학습 경과 시간을 기준으로 삼아야 재생 지점이 맞는다.
        const elapsedMs =
          accumulatedMsRef.current +
          (segmentStartedAtRef.current === null
            ? 0
            : Date.now() - segmentStartedAtRef.current);
        const enrichedTick = { ...tick, elapsedMs };

        ticksRef.current.push(enrichedTick);
        setIsFocused(enrichedTick.focused);
        alertEngineRef.current?.handleTick(enrichedTick);
        // 배너는 자동 타이머로 닫지 않는다. 집중으로 돌아왔을 때만 내린다.
        if (enrichedTick.focused) {
          setActiveAlert(null);
        }
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

    // 이미 열려 있는 카메라 스트림을 재사용한다. getUserMedia를 다시 부르면
    // TS-002·TS-009 계열의 스트림 수명 문제가 재발한다.
    if (isRecordingSupported() && streamRef.current) {
      setRecordingError(null);
      recorderRef.current = createSessionRecorder({
        stream: streamRef.current,
        onError: () => {
          recorderRef.current = null;
          setRecordingError('영상 녹화가 중단되었습니다. 학습 기록은 계속 저장됩니다.');
        },
      });
      recorderRef.current.start();
    }

    setStatus(STATUS.RUNNING);
    beginTicking();
  };

  const handlePause = () => {
    stopTicking();
    recorderRef.current?.pause();
    // 사용자가 의도적으로 멈춘 시간은 비집중 구간이 아니다. 열린 알림을 여기서 닫는다.
    alertEngineRef.current?.reset(Date.now());
    setActiveAlert(null);
    setStatus(STATUS.PAUSED);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    isMutedRef.current = next;
    saveAlertMuted(next);
    setIsMuted(next);
  };

  const handleResume = () => {
    // 일시정지 전 상태(비집중 표시, 열린 배너)가 재개 후에도 남아있지
    // 않도록 초기값으로 되돌린다. 새 틱이 도착하기 전까지의 공백을 없앤다.
    setIsFocused(true);
    setActiveAlert(null);
    recorderRef.current?.resume();
    setStatus(STATUS.RUNNING);
    beginTicking();
  };

  // 실패하면 사람이 읽을 메시지를 돌려주고, 성공하면 null을 준다.
  // 어떤 실패도 던지지 않는다 — 세션 기록은 이미 저장됐고 그것을 지켜야 한다.
  const uploadSessionVideo = async (blob, userId, sessionId, oldest) => {
    try {
      // 버킷이 거절할 크기는 올려보기 전에 거른다. 왕복을 기다린 끝에
      // 실패를 듣게 하지 않는다.
      if (isVideoTooLarge(blob?.size)) {
        return '영상이 너무 커서 저장하지 못했습니다. 약 16분을 넘는 학습은 영상으로 저장할 수 없습니다. 학습 기록은 저장되었습니다.';
      }

      // 새 영상을 확보한 뒤에 옛 영상을 지운다. 순서를 뒤집으면 업로드가
      // 실패했을 때 옛 영상만 사라져 영상이 순감한다. 한도는 용량이 아니라
      // 개수(3개)이므로 잠깐 4개를 들고 있어도 티어를 넘지 않는다.
      const path = buildVideoPath(userId, sessionId);
      const { error: uploadError } = await supabase.storage
        .from(SESSION_VIDEO_BUCKET)
        .upload(path, blob, { contentType: RECORDER_MIME_TYPE, upsert: true });
      if (uploadError) {
        return '영상 저장에 실패했습니다. 학습 기록은 저장되었습니다.';
      }

      const { error: linkError } = await supabase
        .from('study_sessions')
        .update({ video_path: path })
        .eq('id', sessionId);
      if (linkError) {
        return '영상 저장에 실패했습니다. 학습 기록은 저장되었습니다.';
      }

      if (oldest) {
        const { error: removeError } = await supabase.storage
          .from(SESSION_VIDEO_BUCKET)
          .remove([oldest.video_path]);
        if (removeError) {
          return '오래된 영상을 지우지 못했습니다. 이번 영상은 저장되었습니다.';
        }

        // 파일은 지웠는데 이 갱신이 실패하면 행이 없는 파일을 계속 가리켜
        // 한도 한 칸을 영영 차지하고, 리포트에서는 재생도 되지 않는다.
        // 옆의 두 호출과 같이 반드시 확인한다.
        const { error: unlinkError } = await supabase
          .from('study_sessions')
          .update({ video_path: null })
          .eq('id', oldest.id);
        if (unlinkError) {
          return '오래된 영상 정리에 실패했습니다. 이번 영상은 저장되었습니다.';
        }
      }

      return null;
    } catch (error) {
      return '영상 저장에 실패했습니다. 학습 기록은 저장되었습니다.';
    }
  };

  const handleStop = async () => {
    // 연타 무시. 처리가 끝나면 풀어 SAVE_ERROR에서의 재시도를 막지 않는다.
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      await runStop();
    } finally {
      isStoppingRef.current = false;
    }
  };

  const runStop = async () => {
    // SAVE_ERROR에서 재시도로 들어온 경우. 이미 확정한 영상이 있으면 다시 묻지 않고
    // 같은 선택으로 저장한다. 레코더는 이미 멈췄으므로 새로 만들 수 없다.
    if (confirmedVideoRef.current) {
      const { blob, oldest } = confirmedVideoRef.current;
      await saveSession(blob, oldest);
      return;
    }

    stopTicking();
    // 종료 확인 중에는 일시정지와 같은 상태다. 레코더도 함께 멈춰야 사용자가
    // Esc로 학습에 돌아갔을 때 영상 시간축에 빈 구간이 생기지 않는다.
    // 여기서 stop()이 아니라 pause()인 이유다 — 아직 확정된 것이 없다.
    recorderRef.current?.pause();
    // 종료를 누른 순간 이후는 비집중 구간이 아니다. handlePause와 같은 처리로,
    // Esc로 학습에 돌아가더라도 대기 시간이 알림에 섞이지 않는다.
    alertEngineRef.current?.reset(Date.now());
    setActiveAlert(null);

    // 녹화 중이 아니었으면(미지원·오류) 물어볼 것이 없다.
    if (!recorderRef.current?.isActive()) {
      await saveSession(null, null);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 휴지통에 있는 영상도 용량은 실제로 차지하므로 뷰가 아니라 테이블에서 센다.
    const { data: videoSessions } = await supabase
      .from('study_sessions')
      .select('id, started_at, video_path')
      .eq('user_id', user.id)
      .not('video_path', 'is', null);

    const rows = videoSessions ?? [];
    setPendingSave({
      oldest: isVideoLimitReached(rows.length) ? pickOldestVideoSession(rows) : null,
    });
  };

  const saveSession = async (videoBlob, oldest) => {
    const alerts = alertEngineRef.current?.finish(Date.now()) ?? [];

    // 저장이 확정된 시점에 카메라를 끈다. 저장 왕복(await) 뒤로 미루면 실패 시
    // 컴포넌트가 계속 마운트된 채 남아 언마운트 클린업이 돌지 않고, 카메라가
    // 켜진 채로 방치된다. 종료 확인 다이얼로그 단계로 올려서도 안 된다 —
    // 사용자가 Esc로 학습에 돌아갔을 때 카메라가 이미 꺼져 있게 된다.
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
          alerts,
        })
        .select('id')
        .single();

      if (error) {
        setStatus(STATUS.SAVE_ERROR);
        return;
      }

      if (videoBlob) {
        setIsUploading(true);
        const uploadError = await uploadSessionVideo(
          videoBlob,
          user.id,
          data.id,
          oldest
        );
        setIsUploading(false);
        if (uploadError) {
          // 여기서 곧바로 navigate 하면 배너가 그려지기 전에 언마운트되어
          // 사용자가 실패를 영영 모른다. 화면에 남아 알리고, 이동은 사용자가 정한다.
          setVideoSaveError(uploadError);
          setSavedSessionId(data.id);
          confirmedVideoRef.current = null;
          setStatus(STATUS.VIDEO_SAVE_FAILED);
          return;
        }
      }

      confirmedVideoRef.current = null;
      navigate(`/read?session=${data.id}`);
    } catch (error) {
      setStatus(STATUS.SAVE_ERROR);
    }
  };

  const muteButton = (
    <button
      type="button"
      className="start-learning__mute"
      onClick={handleToggleMute}
    >
      {isMuted ? '알림음 켜기' : '알림음 끄기'}
    </button>
  );

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

        {recordingError && (
          <p className="start-learning__notice" role="status">
            <span className="start-learning__notice-text">{recordingError}</span>
          </p>
        )}

        {videoSaveError && (
          <div className="start-learning__notice" role="alert">
            <p className="start-learning__notice-text">{videoSaveError}</p>
            {savedSessionId && (
              <button
                type="button"
                className="start-learning__notice-action"
                onClick={() => navigate(`/read?session=${savedSessionId}`)}
              >
                리포트 보기
              </button>
            )}
          </div>
        )}

        {pendingSave && (
          <ConfirmDialog
            title={
              pendingSave.oldest
                ? `저장된 영상이 ${MAX_STORED_VIDEOS}개로 가득 찼습니다`
                : '영상도 함께 저장할까요?'
            }
            description={
              pendingSave.oldest
                ? `가장 오래된 영상(${new Date(
                    pendingSave.oldest.started_at
                  ).toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                  })})을 지우고 저장합니다.`
                : '학습 기록만 저장하면 영상은 남지 않습니다.'
            }
            confirmLabel={
              pendingSave.oldest ? '오래된 것 지우고 저장' : '영상과 함께 저장'
            }
            cancelLabel="기록만 저장"
            onConfirm={async () => {
              const { oldest } = pendingSave;
              setPendingSave(null);
              // 여기서 처음으로 레코더를 확정 종료한다. 카메라 트랙은
              // saveSession의 releaseCamera()가 그 뒤에 끊으므로 마지막
              // 청크가 잘리지 않는다.
              const blob = await (recorderRef.current?.stop() ?? Promise.resolve(null));
              recorderRef.current = null;
              confirmedVideoRef.current = { blob, oldest };
              await saveSession(blob, oldest);
            }}
            onCancel={async () => {
              setPendingSave(null);
              // 트랙보다 레코더를 먼저 멈춘다. 버리는 blob이지만 순서가 뒤바뀌면
              // onerror가 발동해 엉뚱한 안내가 뜬다.
              await (recorderRef.current?.stop() ?? Promise.resolve(null));
              recorderRef.current = null;
              confirmedVideoRef.current = { blob: null, oldest: null };
              await saveSession(null, null);
            }}
            // Esc는 "종료 자체를 그만둠"이다. 학습으로 돌아간다. 레코더는
            // pause 상태로 살아 있으므로 재개 버튼을 누르면 이어서 녹화된다.
            onDismiss={() => {
              setPendingSave(null);
              setStatus(STATUS.PAUSED);
            }}
          />
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
        </div>

        {status === STATUS.PREVIEW && (
          <div className="start-learning__controls">
            <button
              type="button"
              className="start-learning__start"
              onClick={handleStart}
              disabled={!isModelReady}
            >
              {isModelReady ? '시작' : '모델 준비 중...'}
            </button>
            {muteButton}
          </div>
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
                {isUploading
                  ? '영상 업로드 중...'
                  : status === STATUS.SAVING
                    ? '저장 중...'
                    : '종료'}
              </button>
              {muteButton}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default StartLearning;
