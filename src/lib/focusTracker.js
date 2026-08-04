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
