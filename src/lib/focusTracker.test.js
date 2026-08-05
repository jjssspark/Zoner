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
