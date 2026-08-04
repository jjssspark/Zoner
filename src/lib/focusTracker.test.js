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
