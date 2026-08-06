// src/lib/sessionRecorder.js
// 학습 세션 녹화. MediaRecorder를 감싸 상태 전이와 Blob 생성만 담당한다.
//
// 화면에서 분리한 이유는 두 가지다 — 상태 전이를 단위 테스트로 고정하기 위해서,
// 그리고 react-router-dom을 import 하는 화면 파일은 이 저장소 Jest가 로드하지
// 못하기 때문이다(docs/TROUBLESHOOTING.md TS-003).
//
// 녹화는 부가 기능이다. 어떤 실패도 예외로 새어나가 학습을 멈추면 안 된다.

export const RECORDER_MIME_TYPE = 'video/webm;codecs=vp8';
export const RECORDER_VIDEO_BITS_PER_SECOND = 400000;

// 청크를 1초 단위로 받는다. timeslice 없이 stop()하면 그 시점에 한 번에
// 인코딩되어 종료가 눈에 띄게 느려진다.
export const RECORDER_TIMESLICE_MS = 1000;

export function isRecordingSupported() {
  if (typeof window === 'undefined') return false;

  const Recorder = window.MediaRecorder;
  if (typeof Recorder !== 'function') return false;
  if (typeof Recorder.isTypeSupported !== 'function') return false;

  return Recorder.isTypeSupported(RECORDER_MIME_TYPE);
}

export function createSessionRecorder({ stream, onError } = {}) {
  let recorder = null;
  let hasFailed = false;
  const chunks = [];

  const fail = (error) => {
    hasFailed = true;
    recorder = null;
    if (onError) onError(error);
  };

  const buildBlob = () => {
    // 오류가 났던 녹화는 중간에서 끊긴 파일이다. 재생되지 않을 수 있는 것을
    // "저장됨"으로 보여주는 쪽이 아예 없는 것보다 나쁘다.
    if (hasFailed || chunks.length === 0) return null;
    return new Blob(chunks, { type: RECORDER_MIME_TYPE });
  };

  return {
    start() {
      if (recorder || !stream || !isRecordingSupported()) return;

      try {
        recorder = new window.MediaRecorder(stream, {
          mimeType: RECORDER_MIME_TYPE,
          videoBitsPerSecond: RECORDER_VIDEO_BITS_PER_SECOND,
        });
      } catch (error) {
        fail(error);
        return;
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = (event) => {
        fail(event?.error ?? new Error('recording failed'));
      };

      try {
        recorder.start(RECORDER_TIMESLICE_MS);
      } catch (error) {
        fail(error);
      }
    },

    pause() {
      if (!recorder || recorder.state !== 'recording') return;
      try {
        recorder.pause();
      } catch (error) {
        fail(error);
      }
    },

    resume() {
      if (!recorder || recorder.state !== 'paused') return;
      try {
        recorder.resume();
      } catch (error) {
        fail(error);
      }
    },

    stop() {
      return new Promise((resolve) => {
        if (!recorder) {
          resolve(buildBlob());
          return;
        }

        const active = recorder;
        recorder = null;
        active.onstop = () => resolve(buildBlob());

        try {
          active.stop();
        } catch (error) {
          resolve(buildBlob());
        }
      });
    },

    isActive() {
      return recorder !== null;
    },
  };
}
