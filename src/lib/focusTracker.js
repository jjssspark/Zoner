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
  intervalMs: 5000,
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

export function aggregateSession(ticks, startedAt, endedAt) {
  const durationSeconds = Math.round(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
  );

  const focusedCount = ticks.filter((tick) => tick.focused).length;
  const focusScore =
    ticks.length === 0 ? 0 : Math.round((focusedCount / ticks.length) * 100);

  const buckets = new Map();

  ticks.forEach((tick) => {
    // 벽시계가 아니라 경과 시간으로 나눈다. 일시정지 구간에서는 elapsedMs가
    // 멈추므로 그래프에 빈 구간이 생기지 않고, MediaRecorder가 일시정지를
    // 들어낸 영상의 재생 시간축과도 일치한다.
    const minute = Math.floor((tick.elapsedMs ?? 0) / 60000);
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

  return {
    durationSeconds,
    focusScore,
    timeline,
    focusBreakdown: computeFocusBreakdown(ticks),
  };
}

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
      outputFaceBlendshapes: true,
      numFaces: 1,
    });
  })();

  return cachedFaceLandmarkerPromise;
}

export function createFocusTracker({
  videoEl,
  faceLandmarker,
  intervalMs = THRESHOLDS.intervalMs,
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
