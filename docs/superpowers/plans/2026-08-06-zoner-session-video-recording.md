# 학습 영상 녹화·저장·재생 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학습 세션을 웹캠으로 녹화해 Supabase Storage에 저장하고, 리포트에서 알림 기록·집중도 그래프를 눌러 해당 장면으로 건너뛰며 다시 볼 수 있게 한다.

**Architecture:** 순수 로직(`sessionRecorder`, `sessionVideos`)을 `src/lib/`에 두고 화면은 그것을 호출만 한다. 녹화는 이미 열려 있는 카메라 스트림을 재사용하고, 일시정지 시 레코더도 함께 멈춰 **영상 시간축 = 순수 학습 시간**을 만든다. 그 시간축에 맞추기 위해 집중도 틱에 `elapsedMs`를 실어 timeline 버킷과 알림 오프셋을 모두 경과 시간 기준으로 바꾼다.

**Tech Stack:** React 19 / CRA(react-scripts 5.0.1) / MediaRecorder API / Supabase Storage + Postgres

## Global Constraints

아래는 모든 태스크의 요구사항에 암묵적으로 포함된다.

- **커밋은 사전 승인되어 있다.** 각 태스크 끝에서 커밋을 실행하라. 사용자 확인을 기다리지 마라 — 전역 CLAUDE.md의 "커밋 전 확인 요청" 때문에 서브에이전트가 커밋을 거부하고 멈춘 사례가 실제로 있다.
- **attribution 푸터(`Co-Authored-By` 등)를 붙이지 마라.** 이 프로젝트는 꺼져 있다.
- 테스트: `CI=true npx react-scripts test --watchAll=false`. **시작 기준선은 12스위트 139건.**
- 빌드: `npx react-scripts build`. **`CI=true`를 붙이지 마라** — `UserGuide.js`의 기존 jsx-a11y 경고 3건이 에러로 승격돼 실패한다.
- **`react-router-dom`을 import 하는 모듈은 Jest에서 테스트 불가하다(TS-003).** 그래서 순수 로직은 `src/lib/`에 둔다. `src/components/` 파일에는 테스트를 작성하지 마라 (`src/components/ui/` 아래의 라우터 미사용 컴포넌트는 예외 — `ConfirmDialog.test.js`가 실제로 돌고 있다).
- **디자인 토큰은 `src/styles/tokens.css`의 의미 토큰만 쓴다.** 새 토큰을 만들지 마라. 하드코딩된 색 금지.
- 상단바는 모든 화면에서 sticky 고정이 기본이다. 이 계획에서 상단바를 새로 만들지는 않는다.
- 주석은 WHY가 명확하지 않을 때만 쓴다. 한국어로 쓴다.
- 정확한 값(숫자, 문자열, 시그니처)은 각 태스크 본문에 적힌 것을 **그대로** 쓴다.

---

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `src/lib/sessionRecorder.js` | MediaRecorder 래핑. 상태 전이와 Blob 생성 | 1 |
| `src/lib/sessionRecorder.test.js` | 위 테스트 | 1 |
| `src/lib/sessionVideos.js` | 저장 경로, 한도 판정, 삭제 대상 선정 | 2 |
| `src/lib/sessionVideos.test.js` | 위 테스트 | 2 |
| `src/lib/focusTracker.js` | timeline 버킷을 `elapsedMs` 기준으로 | 3 |
| `src/lib/alertEngine.js` | 알림에 `offset_seconds` 부여 | 3 |
| `supabase/migrations/20260806150000_add_video_path_to_study_sessions.sql` | 컬럼 + 뷰 재생성 | 4 |
| `supabase/migrations/20260806160000_create_session_videos_bucket.sql` | 버킷 + RLS 정책 4개 | 4 |
| `src/components/ui/ConfirmDialog.js` | `onDismiss` 옵션 추가 | 5 |
| `src/components/StartLearning.js` | 녹화 제어 + `elapsedMs` 주입 (5), 저장 다이얼로그 + 업로드 (6) | 5, 6 |
| `src/components/Read.js` | 영상 재생 + seek | 7 |
| `src/components/SessionReport.css` | 영상 섹션 스타일 | 7 |
| `src/components/FocusChart.css` | 그래프 막대 버튼화 + 현재 위치 마커 | 7 |

---

## Task 1: sessionRecorder — MediaRecorder 래핑

**Files:**
- Create: `src/lib/sessionRecorder.js`
- Test: `src/lib/sessionRecorder.test.js`

**Interfaces:**
- Consumes: 없음 (이 계획의 첫 태스크)
- Produces:
  - `RECORDER_MIME_TYPE = 'video/webm;codecs=vp8'`
  - `RECORDER_VIDEO_BITS_PER_SECOND = 400000`
  - `RECORDER_TIMESLICE_MS = 1000`
  - `isRecordingSupported(): boolean`
  - `createSessionRecorder({ stream, onError }) → { start(), pause(), resume(), stop(): Promise<Blob|null>, isActive(): boolean }`

**배경:** jsdom에는 `MediaRecorder`가 없다. 테스트는 `window.MediaRecorder`에 가짜 클래스를 심어서 돌린다. 구현이 `window.MediaRecorder`를 참조해야 이 방식이 통한다 — 전역 `MediaRecorder`를 직접 참조하면 테스트에서 가짜를 심을 수 없다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/sessionRecorder.test.js`:

```javascript
import {
  RECORDER_MIME_TYPE,
  RECORDER_VIDEO_BITS_PER_SECOND,
  RECORDER_TIMESLICE_MS,
  isRecordingSupported,
  createSessionRecorder,
} from './sessionRecorder';

// jsdom에는 MediaRecorder가 없다. 실제 API의 관찰 가능한 동작만 흉내낸다.
class FakeMediaRecorder {
  static isTypeSupported = jest.fn(() => true);
  static instances = [];

  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onerror = null;
    this.onstop = null;
    this.startCalls = [];
    FakeMediaRecorder.instances.push(this);
  }

  start(timeslice) {
    this.startCalls.push(timeslice);
    this.state = 'recording';
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) this.onstop();
  }

  emitChunk(size) {
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['x'.repeat(size)]) });
    }
  }

  emitError(error) {
    if (this.onerror) this.onerror({ error });
  }
}

const installFakeRecorder = () => {
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.isTypeSupported = jest.fn(() => true);
  window.MediaRecorder = FakeMediaRecorder;
  return FakeMediaRecorder;
};

const fakeStream = { id: 'stream-1' };

afterEach(() => {
  delete window.MediaRecorder;
});

describe('isRecordingSupported', () => {
  test('MediaRecorder가 없으면 false', () => {
    delete window.MediaRecorder;
    expect(isRecordingSupported()).toBe(false);
  });

  test('mimeType을 지원하지 않으면 false', () => {
    const Fake = installFakeRecorder();
    Fake.isTypeSupported = jest.fn(() => false);
    expect(isRecordingSupported()).toBe(false);
  });

  test('둘 다 갖춰지면 true', () => {
    installFakeRecorder();
    expect(isRecordingSupported()).toBe(true);
  });
});

describe('createSessionRecorder', () => {
  test('start가 지정한 mimeType과 비트레이트로 레코더를 만든다', () => {
    const Fake = installFakeRecorder();
    const recorder = createSessionRecorder({ stream: fakeStream });

    recorder.start();

    expect(Fake.instances).toHaveLength(1);
    expect(Fake.instances[0].options).toEqual({
      mimeType: RECORDER_MIME_TYPE,
      videoBitsPerSecond: RECORDER_VIDEO_BITS_PER_SECOND,
    });
    expect(Fake.instances[0].startCalls).toEqual([RECORDER_TIMESLICE_MS]);
  });

  test('start를 두 번 불러도 레코더는 하나만 만든다', () => {
    const Fake = installFakeRecorder();
    const recorder = createSessionRecorder({ stream: fakeStream });

    recorder.start();
    recorder.start();

    expect(Fake.instances).toHaveLength(1);
  });

  test('미지원 브라우저에서는 start가 조용히 넘어간다', () => {
    delete window.MediaRecorder;
    const recorder = createSessionRecorder({ stream: fakeStream });

    expect(() => recorder.start()).not.toThrow();
    expect(recorder.isActive()).toBe(false);
  });

  test('pause와 resume이 레코더 상태를 바꾼다', () => {
    const Fake = installFakeRecorder();
    const recorder = createSessionRecorder({ stream: fakeStream });

    recorder.start();
    recorder.pause();
    expect(Fake.instances[0].state).toBe('paused');

    recorder.resume();
    expect(Fake.instances[0].state).toBe('recording');
  });

  test('stop이 수집된 청크로 Blob을 만든다', async () => {
    const Fake = installFakeRecorder();
    const recorder = createSessionRecorder({ stream: fakeStream });

    recorder.start();
    Fake.instances[0].emitChunk(10);
    Fake.instances[0].emitChunk(10);

    const blob = await recorder.stop();

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(RECORDER_MIME_TYPE);
  });

  test('청크가 하나도 없으면 stop이 null을 준다', async () => {
    installFakeRecorder();
    const recorder = createSessionRecorder({ stream: fakeStream });

    recorder.start();

    expect(await recorder.stop()).toBeNull();
  });

  test('start 없이 stop해도 null을 주고 던지지 않는다', async () => {
    installFakeRecorder();
    const recorder = createSessionRecorder({ stream: fakeStream });

    expect(await recorder.stop()).toBeNull();
  });

  test('onerror가 나면 onError를 부르고 예외를 밖으로 던지지 않는다', () => {
    const Fake = installFakeRecorder();
    const onError = jest.fn();
    const recorder = createSessionRecorder({ stream: fakeStream, onError });

    recorder.start();
    const failure = new Error('device lost');
    expect(() => Fake.instances[0].emitError(failure)).not.toThrow();

    expect(onError).toHaveBeenCalledWith(failure);
  });

  test('오류가 난 뒤에는 stop이 null을 준다 — 깨진 영상을 저장하지 않는다', async () => {
    const Fake = installFakeRecorder();
    const recorder = createSessionRecorder({ stream: fakeStream, onError: jest.fn() });

    recorder.start();
    Fake.instances[0].emitChunk(10);
    Fake.instances[0].emitError(new Error('device lost'));

    expect(await recorder.stop()).toBeNull();
  });

  test('생성자가 던져도 onError로 알리고 밖으로 던지지 않는다', () => {
    const onError = jest.fn();
    window.MediaRecorder = class {
      static isTypeSupported = () => true;
      constructor() {
        throw new Error('not allowed');
      }
    };
    const recorder = createSessionRecorder({ stream: fakeStream, onError });

    expect(() => recorder.start()).not.toThrow();
    expect(onError).toHaveBeenCalled();
  });

  test('stream이 없으면 아무것도 하지 않는다', () => {
    const Fake = installFakeRecorder();
    const recorder = createSessionRecorder({ stream: null });

    recorder.start();

    expect(Fake.instances).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/sessionRecorder.test.js`
Expected: FAIL — `Cannot find module './sessionRecorder'`

- [ ] **Step 3: 구현한다**

`src/lib/sessionRecorder.js`:

```javascript
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
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/sessionRecorder.test.js`
Expected: PASS — 13건

- [ ] **Step 5: 전체 테스트를 돌린다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 13스위트 152건 통과 (기준선 12스위트 139건 + 신규 1스위트 13건)

- [ ] **Step 6: 커밋한다**

```bash
git add src/lib/sessionRecorder.js src/lib/sessionRecorder.test.js
git commit -m "feat: 학습 세션 녹화용 MediaRecorder 래퍼 추가

VP8 400kbps로 1초 단위 청크를 모아 Blob을 만든다. 녹화는 부가 기능이므로
미지원 브라우저·생성자 예외·onerror 어디서도 예외를 밖으로 던지지 않는다.

오류가 났던 녹화는 stop()이 null을 준다. 중간에 끊긴 파일을 '저장됨'으로
보여주면 재생 시점에 더 나쁜 실패가 된다."
```

---

## Task 2: sessionVideos — 경로·한도·삭제 대상

**Files:**
- Create: `src/lib/sessionVideos.js`
- Test: `src/lib/sessionVideos.test.js`

**Interfaces:**
- Consumes: 없음 (Task 1과 독립)
- Produces:
  - `SESSION_VIDEO_BUCKET = 'session-videos'`
  - `MAX_STORED_VIDEOS = 3`
  - `buildVideoPath(userId, sessionId): string`
  - `isVideoLimitReached(count): boolean`
  - `pickOldestVideoSession(sessions): object|null`

**배경:** 경로 첫 세그먼트가 user_id인 것이 Storage RLS의 핵심이다(Task 4에서 `(storage.foldername(name))[1] = auth.uid()::text`로 판별한다). 이 규칙이 깨지면 다른 사용자의 영상이 보이거나 자기 영상을 못 읽는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/sessionVideos.test.js`:

```javascript
import {
  SESSION_VIDEO_BUCKET,
  MAX_STORED_VIDEOS,
  buildVideoPath,
  isVideoLimitReached,
  pickOldestVideoSession,
} from './sessionVideos';

describe('buildVideoPath', () => {
  test('user_id를 첫 세그먼트로 두고 session_id.webm을 붙인다', () => {
    expect(buildVideoPath('user-1', 'session-9')).toBe('user-1/session-9.webm');
  });

  test('Storage RLS가 첫 세그먼트로 소유자를 판별하므로 경로가 두 단계다', () => {
    expect(buildVideoPath('user-1', 'session-9').split('/')).toHaveLength(2);
  });
});

describe('isVideoLimitReached', () => {
  test('한도보다 적으면 false', () => {
    expect(isVideoLimitReached(MAX_STORED_VIDEOS - 1)).toBe(false);
  });

  test('한도와 같으면 true', () => {
    expect(isVideoLimitReached(MAX_STORED_VIDEOS)).toBe(true);
  });

  test('한도를 넘으면 true', () => {
    expect(isVideoLimitReached(MAX_STORED_VIDEOS + 1)).toBe(true);
  });

  test('0이면 false', () => {
    expect(isVideoLimitReached(0)).toBe(false);
  });
});

describe('pickOldestVideoSession', () => {
  const sessions = [
    { id: 'b', started_at: '2026-08-05T10:00:00.000Z', video_path: 'u/b.webm' },
    { id: 'a', started_at: '2026-08-03T09:00:00.000Z', video_path: 'u/a.webm' },
    { id: 'c', started_at: '2026-08-06T11:00:00.000Z', video_path: 'u/c.webm' },
  ];

  test('started_at이 가장 이른 세션을 고른다', () => {
    expect(pickOldestVideoSession(sessions).id).toBe('a');
  });

  test('영상이 없는 세션은 후보에서 뺀다', () => {
    const mixed = [
      { id: 'no-video', started_at: '2026-08-01T00:00:00.000Z', video_path: null },
      { id: 'has-video', started_at: '2026-08-04T00:00:00.000Z', video_path: 'u/x.webm' },
    ];
    expect(pickOldestVideoSession(mixed).id).toBe('has-video');
  });

  test('영상 있는 세션이 하나도 없으면 null', () => {
    expect(
      pickOldestVideoSession([
        { id: 'x', started_at: '2026-08-01T00:00:00.000Z', video_path: null },
      ])
    ).toBeNull();
  });

  test('빈 배열이면 null', () => {
    expect(pickOldestVideoSession([])).toBeNull();
  });

  test('배열이 아니면 null — 조회 실패를 크래시로 만들지 않는다', () => {
    expect(pickOldestVideoSession(null)).toBeNull();
    expect(pickOldestVideoSession(undefined)).toBeNull();
  });
});

describe('상수', () => {
  test('버킷 이름이 마이그레이션과 같다', () => {
    expect(SESSION_VIDEO_BUCKET).toBe('session-videos');
  });

  test('한도는 3개다', () => {
    expect(MAX_STORED_VIDEOS).toBe(3);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/sessionVideos.test.js`
Expected: FAIL — `Cannot find module './sessionVideos'`

- [ ] **Step 3: 구현한다**

`src/lib/sessionVideos.js`:

```javascript
// src/lib/sessionVideos.js
// 학습 영상의 저장 경로와 개수 한도를 다루는 순수 함수들.
// Supabase 클라이언트를 여기서 import 하지 않는다 — 호출부(화면)가 주입한다.

export const SESSION_VIDEO_BUCKET = 'session-videos';

// 무료 티어 1GB 기준. 400kbps로 45분이 약 135MB이므로 3개면 약 400MB다.
export const MAX_STORED_VIDEOS = 3;

// 첫 세그먼트가 user_id여야 한다. Storage RLS가
// (storage.foldername(name))[1] = auth.uid()::text 로 소유자를 판별한다.
export function buildVideoPath(userId, sessionId) {
  return `${userId}/${sessionId}.webm`;
}

export function isVideoLimitReached(count) {
  return Number(count) >= MAX_STORED_VIDEOS;
}

// 휴지통에 있는 세션도 용량은 실제로 차지하므로 후보에 포함한다.
// 호출부가 study_sessions 테이블(뷰가 아니라)에서 조회해 넘긴다.
export function pickOldestVideoSession(sessions) {
  if (!Array.isArray(sessions)) return null;

  const withVideo = sessions.filter((session) => session && session.video_path);
  if (withVideo.length === 0) return null;

  return withVideo.reduce((oldest, session) =>
    new Date(session.started_at).getTime() < new Date(oldest.started_at).getTime()
      ? session
      : oldest
  );
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/sessionVideos.test.js`
Expected: PASS — 12건

- [ ] **Step 5: 전체 테스트를 돌린다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 14스위트 164건 통과

- [ ] **Step 6: 커밋한다**

```bash
git add src/lib/sessionVideos.js src/lib/sessionVideos.test.js
git commit -m "feat: 학습 영상 저장 경로와 개수 한도 로직 추가

경로 첫 세그먼트를 user_id로 두는 것이 Storage RLS의 판별 기준이다.
한도는 계정당 3개이고, 휴지통에 있는 영상도 용량을 차지하므로 후보에 포함한다."
```

---

## Task 3: 시각 기준을 경과 시간으로 — timeline 버킷과 알림 오프셋

**Files:**
- Modify: `src/lib/focusTracker.js:142-177` (`aggregateSession`)
- Modify: `src/lib/alertEngine.js:25-63` (`closeOpenAlert`, `handleTick`)
- Test: `src/lib/focusTracker.test.js` (보강)
- Test: `src/lib/alertEngine.test.js` (보강)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `aggregateSession(ticks, startedAt, endedAt)`의 `timeline[].minute`이 `tick.elapsedMs` 기준이 된다
  - 알림 객체에 `offset_seconds: number`가 추가된다 (기존 `started_at`, `ended_at`, `reason`, `duration_seconds`는 그대로)
  - 호출부는 각 틱에 `elapsedMs`(일시정지 제외 누적 밀리초)를 실어 보내야 한다

**이 태스크가 이 계획에서 가장 중요하다.** 여기가 틀리면 리포트에서 클릭한 지점과 영상 장면이 어긋나고, 그건 기능이 없느니만 못하다.

**왜 바꾸나:** `MediaRecorder.pause()`는 일시정지 구간을 영상에서 들어낸다. 따라서 완성된 영상의 시간축은 일시정지를 제외한 순수 학습 시간이다. 그런데 현재 `focusTracker.js:155`는 버킷을 `Math.floor((tick.timestampMs - startMs) / 60000)` — 벽시계로 계산한다. 10분 쉬면 그래프에 빈 10분이 생기는데 영상에는 그 10분이 없으므로 클릭 지점이 어긋난다. 이건 영상과 무관하게 이미 존재하는 버그이기도 하다.

- [ ] **Step 1: 실패하는 테스트를 쓴다 — focusTracker**

`src/lib/focusTracker.test.js` 파일 **끝에** 아래를 추가한다. `aggregateSession`이 이미 import돼 있지 않다면 상단 import에 추가하라.

```javascript
describe('aggregateSession — 경과 시간 기준 버킷', () => {
  // 일시정지 동안 elapsedMs는 멈추고 timestampMs만 흐른다.
  // 버킷은 elapsedMs를 따라야 영상 재생 시간축과 일치한다.
  const startedAt = '2026-08-06T10:00:00.000Z';
  const startMs = new Date(startedAt).getTime();

  test('버킷 인덱스가 elapsedMs로 계산된다', () => {
    const ticks = [
      { timestampMs: startMs + 5000, elapsedMs: 5000, focused: true, reason: 'focused' },
      { timestampMs: startMs + 65000, elapsedMs: 65000, focused: false, reason: 'absent' },
    ];

    const { timeline } = aggregateSession(ticks, startedAt, '2026-08-06T10:02:00.000Z');

    expect(timeline.map((bucket) => bucket.minute)).toEqual([0, 1]);
  });

  test('10분 일시정지가 있어도 그래프에 빈 구간이 생기지 않는다', () => {
    const ticks = [
      // 0분대 — 일시정지 전
      { timestampMs: startMs + 5000, elapsedMs: 5000, focused: true, reason: 'focused' },
      // 벽시계로는 11분 뒤지만 실제 학습 경과는 10초뿐이다
      { timestampMs: startMs + 665000, elapsedMs: 10000, focused: true, reason: 'focused' },
    ];

    const { timeline } = aggregateSession(ticks, startedAt, '2026-08-06T10:11:10.000Z');

    // 벽시계 기준이었다면 minute 0과 11이 나와 사이가 비었을 것이다
    expect(timeline).toHaveLength(1);
    expect(timeline[0].minute).toBe(0);
  });

  test('elapsedMs가 없는 틱은 0분대로 본다 — 크래시하지 않는다', () => {
    const ticks = [{ timestampMs: startMs + 5000, focused: true, reason: 'focused' }];

    const { timeline } = aggregateSession(ticks, startedAt, '2026-08-06T10:00:10.000Z');

    expect(timeline).toEqual([{ minute: 0, focus_ratio: 1 }]);
  });
});
```

- [ ] **Step 2: 실패하는 테스트를 쓴다 — alertEngine**

`src/lib/alertEngine.test.js` 파일 **끝에** 아래를 추가한다:

```javascript
describe('알림 오프셋 — 영상 seek 지점', () => {
  const tick = (elapsedMs, focused, reason) => ({
    timestampMs: 1000000 + elapsedMs,
    elapsedMs,
    focused,
    reason,
  });

  test('알림에 offset_seconds가 붙는다', () => {
    const engine = createAlertEngine();

    engine.handleTick(tick(5000, false, 'absent'));
    engine.handleTick(tick(10000, false, 'absent'));
    engine.handleTick(tick(15000, false, 'absent'));

    const alerts = engine.finish(1_020_000);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].offset_seconds).toBe(15);
  });

  test('오프셋은 발화한 틱의 경과 시간이다 — 벽시계가 아니다', () => {
    const engine = createAlertEngine();

    // 일시정지를 사이에 껴서 timestampMs와 elapsedMs를 크게 벌린다
    engine.handleTick({ timestampMs: 9_000_000, elapsedMs: 5000, focused: false, reason: 'absent' });
    engine.handleTick({ timestampMs: 9_005_000, elapsedMs: 10000, focused: false, reason: 'absent' });
    engine.handleTick({ timestampMs: 9_010_000, elapsedMs: 15000, focused: false, reason: 'absent' });

    const alerts = engine.finish(9_015_000);
    expect(alerts[0].offset_seconds).toBe(15);
  });

  test('elapsedMs가 없으면 오프셋이 0이다', () => {
    const engine = createAlertEngine();

    engine.handleTick({ timestampMs: 1000, focused: false, reason: 'absent' });
    engine.handleTick({ timestampMs: 2000, focused: false, reason: 'absent' });
    engine.handleTick({ timestampMs: 3000, focused: false, reason: 'absent' });

    const alerts = engine.finish(4000);
    expect(alerts[0].offset_seconds).toBe(0);
  });

  test('기존 필드는 그대로 유지된다', () => {
    const engine = createAlertEngine();

    engine.handleTick(tick(5000, false, 'head_turned'));
    engine.handleTick(tick(10000, false, 'head_turned'));
    engine.handleTick(tick(15000, false, 'head_turned'));

    const alerts = engine.finish(1_020_000);
    expect(Object.keys(alerts[0]).sort()).toEqual([
      'duration_seconds',
      'ended_at',
      'offset_seconds',
      'reason',
      'started_at',
    ]);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는 것을 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/focusTracker.test.js src/lib/alertEngine.test.js`
Expected: FAIL — 버킷이 벽시계 기준이라 minute 값이 다르고, `offset_seconds`가 `undefined`

- [ ] **Step 4: focusTracker를 고친다**

`src/lib/focusTracker.js`의 `aggregateSession` 안에서:

`const startMs = new Date(startedAt).getTime();` 줄을 **삭제한다** (이 변경으로 쓰이지 않게 되는 변수다).

그리고 버킷 계산을 바꾼다:

```javascript
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
```

- [ ] **Step 5: alertEngine을 고친다**

`src/lib/alertEngine.js`의 `closeOpenAlert`에 `offset_seconds`를 추가한다:

```javascript
  const closeOpenAlert = (endedAtMs) => {
    if (!openAlert) return;
    alerts.push({
      started_at: openAlert.startedAt,
      ended_at: new Date(endedAtMs).toISOString(),
      reason: openAlert.reason,
      duration_seconds: Math.max(
        0,
        Math.round((endedAtMs - openAlert.startedAtMs) / 1000)
      ),
      offset_seconds: openAlert.offsetSeconds,
    });
    openAlert = null;
  };
```

그리고 `handleTick`에서 `openAlert`를 만들 때 오프셋을 담는다:

```javascript
      openAlert = {
        startedAtMs: tick.timestampMs,
        startedAt: new Date(tick.timestampMs).toISOString(),
        reason: tick.reason,
        // 영상 재생 시간축(일시정지 제외)에서 이 알림이 발생한 지점.
        // 리포트에서 이 값으로 seek한다.
        offsetSeconds: Math.max(0, Math.round((tick.elapsedMs ?? 0) / 1000)),
      };
```

- [ ] **Step 6: 테스트가 통과하는 것을 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/lib/focusTracker.test.js src/lib/alertEngine.test.js`
Expected: PASS

기존 테스트가 깨지면 **구현이 아니라 기대값을 확인하라.** 기존 `aggregateSession` 테스트는 `elapsedMs` 없는 틱을 쓰므로 전부 0분대로 몰린다. 그 테스트들의 틱에 `elapsedMs`를 추가해 의도한 버킷이 나오게 고쳐라 — 구현을 되돌리지 마라.

- [ ] **Step 7: 전체 테스트를 돌린다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 14스위트 171건 통과 (Task 2의 164건 + focusTracker 3건 + alertEngine 4건)

- [ ] **Step 8: 커밋한다**

```bash
git add src/lib/focusTracker.js src/lib/focusTracker.test.js src/lib/alertEngine.js src/lib/alertEngine.test.js
git commit -m "fix: timeline 버킷과 알림 오프셋을 경과 시간 기준으로

MediaRecorder.pause()가 일시정지 구간을 영상에서 들어내므로 영상의 재생
시간축은 순수 학습 시간이다. 그런데 버킷은 벽시계 기준이라 10분 쉬면
그래프에 빈 10분이 생겨 클릭 지점과 장면이 어긋난다.

틱의 elapsedMs를 기준으로 바꾸고, 알림에 offset_seconds를 실어 리포트가
그 값으로 seek할 수 있게 한다. 일시정지 시 그래프에 빈 구간이 생기던
기존 버그도 함께 해소된다."
```

---

## Task 4: DB 마이그레이션 — video_path 컬럼과 Storage 버킷

**Files:**
- Create: `supabase/migrations/20260806150000_add_video_path_to_study_sessions.sql`
- Create: `supabase/migrations/20260806160000_create_session_videos_bucket.sql`

**Interfaces:**
- Consumes: `SESSION_VIDEO_BUCKET = 'session-videos'` (Task 2). 버킷 이름이 반드시 일치해야 한다.
- Produces: `study_sessions.video_path text null`, `active_study_sessions` 뷰의 12번째 컬럼, `session-videos` 버킷과 정책 4개

**⚠️ 뷰를 빠뜨리면 TS-012가 그대로 재발한다.** `active_study_sessions` 뷰는 컬럼을 고정 나열한다. 테이블에 컬럼을 추가해도 뷰를 갱신하지 않으면 화면에서 `column "video_path" does not exist`가 난다. `focus_breakdown`이 정확히 이 이유로 하루 넘게 보이지 않았다.

`create or replace view`는 기존 컬럼의 **이름과 순서를 바꿀 수 없다.** 새 컬럼은 반드시 목록 맨 뒤에 붙인다.

이 태스크는 파일 생성까지만 한다. 실제 적용은 사람이 Supabase 대시보드에서 수행한다.

- [ ] **Step 1: 현재 뷰 정의를 확인한다**

Run: `sed -n '14,28p' supabase/migrations/20260806140000_add_alerts_to_study_sessions.sql`

Expected: 11개 컬럼이 이 순서로 나온다 —
`id, user_id, started_at, ended_at, duration_seconds, focus_score, timeline, created_at, deleted_at, focus_breakdown, alerts`

이 순서를 그대로 베끼고 `video_path`만 뒤에 붙여야 한다. 순서를 지어내지 마라.

- [ ] **Step 2: 컬럼 추가 마이그레이션을 쓴다**

`supabase/migrations/20260806150000_add_video_path_to_study_sessions.sql`:

```sql
-- supabase/migrations/20260806150000_add_video_path_to_study_sessions.sql
--
-- 학습 영상의 Storage 경로. 영상을 저장하지 않은 세션은 null로 남고,
-- 리포트는 null이면 영상 섹션 자체를 렌더하지 않으므로 깨지지 않는다.

alter table study_sessions add column video_path text null;

-- active_study_sessions 뷰는 컬럼을 고정 나열하므로 여기서 함께 갱신해야 한다.
-- 갱신하지 않으면 저장은 되는데 화면에서 읽을 수 없다 (TS-012).
--
-- ⚠️ create or replace view는 기존 컬럼의 이름과 순서를 바꿀 수 없다.
-- video_path는 반드시 기존 목록 "뒤에" 붙인다.
create or replace view active_study_sessions with (security_invoker = true) as
select
  id,
  user_id,
  started_at,
  ended_at,
  duration_seconds,
  focus_score,
  timeline,
  created_at,
  deleted_at,
  focus_breakdown,
  alerts,
  video_path
from study_sessions
where deleted_at is null;
```

- [ ] **Step 3: 버킷 마이그레이션을 쓴다**

`supabase/migrations/20260806160000_create_session_videos_bucket.sql`:

```sql
-- supabase/migrations/20260806160000_create_session_videos_bucket.sql
--
-- 학습 영상 저장용 비공개 버킷. 얼굴이 담긴 개인 데이터이므로 공개 URL을
-- 쓰지 않고, 재생 시 createSignedUrl로 1시간짜리 서명 URL을 발급한다.
--
-- 경로 규칙: {user_id}/{session_id}.webm
-- 첫 세그먼트가 user_id인 것이 아래 정책들의 소유자 판별 기준이다.

insert into storage.buckets (id, name, public)
values ('session-videos', 'session-videos', false)
on conflict (id) do nothing;

-- create policy는 멱등하지 않다. 재실행할 수 있도록 먼저 지운다.
drop policy if exists "session_videos_select_own" on storage.objects;
drop policy if exists "session_videos_insert_own" on storage.objects;
drop policy if exists "session_videos_update_own" on storage.objects;
drop policy if exists "session_videos_delete_own" on storage.objects;

create policy "session_videos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "session_videos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "session_videos_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "session_videos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Step 4: 뷰 컬럼이 12개인지 센다**

Run: `sed -n '/^create or replace view/,/^from study_sessions/p' supabase/migrations/20260806150000_add_video_path_to_study_sessions.sql | grep -cE '^  [a-z_]+,?$'`
Expected: `12`

12가 아니면 컬럼을 빠뜨렸거나 더 넣은 것이다. Step 1의 목록과 하나씩 대조하라.

- [ ] **Step 5: 커밋한다**

```bash
git add supabase/migrations/20260806150000_add_video_path_to_study_sessions.sql supabase/migrations/20260806160000_create_session_videos_bucket.sql
git commit -m "feat: 학습 영상용 video_path 컬럼과 Storage 버킷 마이그레이션

active_study_sessions 뷰를 함께 재생성한다. 뷰가 컬럼을 고정 나열하므로
갱신하지 않으면 저장은 되는데 화면에서 읽을 수 없다 (TS-012 재발 방지).

버킷은 비공개다. 얼굴이 담긴 개인 데이터라 공개 URL을 쓰지 않고 재생 시
서명 URL을 발급한다. 정책 4개 모두 경로 첫 세그먼트로 소유자를 판별한다."
```

---

## Task 5: StartLearning — 녹화 연동과 elapsedMs 주입

**Files:**
- Modify: `src/components/ui/ConfirmDialog.js:8-15, 31-36` (`onDismiss` 옵션 추가)
- Modify: `src/components/StartLearning.js` (import, ref, 생명주기, onTick)
- Modify: `src/components/StartLearning.css` (안내 문구 스타일)
- Test: `src/components/ui/ConfirmDialog.test.js` (보강)

**Interfaces:**
- Consumes: `createSessionRecorder`, `isRecordingSupported` (Task 1) / 알림 엔진이 `tick.elapsedMs`를 읽는다 (Task 3)
- Produces: `recorderRef.current`가 세션 동안 살아 있고, `await recorderRef.current.stop()`으로 Blob을 얻을 수 있다. Task 6이 그 Blob을 업로드한다.

**왜 ConfirmDialog를 여기서 건드리나:** Task 6의 저장 다이얼로그는 결과가 셋이다 — 영상과 함께 저장 / 기록만 저장 / 종료 취소. 지금 `ConfirmDialog`는 Esc와 취소 버튼이 똑같이 `onCancel`을 부르므로 셋을 구분할 수 없다. `onDismiss`를 선택적으로 받아 Esc만 따로 처리하게 한다. 넘기지 않으면 기존과 동일하게 동작하므로 기존 호출부(`Read.js`, `Trash.js`)는 손대지 않는다.

- [ ] **Step 1: ConfirmDialog에 실패하는 테스트를 쓴다**

`src/components/ui/ConfirmDialog.test.js` 파일 **끝에** 추가한다. 파일 상단의 기존 import를 확인하고 `render`·`screen`·`fireEvent`가 없으면 추가하라.

```javascript
describe('onDismiss', () => {
  test('onDismiss를 주면 Esc가 onCancel 대신 onDismiss를 부른다', () => {
    const onCancel = jest.fn();
    const onDismiss = jest.fn();
    render(
      <ConfirmDialog
        title="종료할까요?"
        onConfirm={jest.fn()}
        onCancel={onCancel}
        onDismiss={onDismiss}
      />
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  test('onDismiss를 줘도 취소 버튼은 여전히 onCancel을 부른다', () => {
    const onCancel = jest.fn();
    const onDismiss = jest.fn();
    render(
      <ConfirmDialog
        title="종료할까요?"
        cancelLabel="기록만 저장"
        onConfirm={jest.fn()}
        onCancel={onCancel}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '기록만 저장' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  test('onDismiss가 없으면 Esc가 기존대로 onCancel을 부른다', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog title="삭제할까요?" onConfirm={jest.fn()} onCancel={onCancel} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/components/ui/ConfirmDialog.test.js`
Expected: FAIL — `onDismiss` 미지원이라 Esc가 `onCancel`을 부른다

- [ ] **Step 3: ConfirmDialog를 고친다**

props에 `onDismiss`를 추가한다:

```javascript
export const ConfirmDialog = ({
  title,
  description,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
  onDismiss,
}) => {
```

Esc 처리를 바꾼다:

```javascript
    if (event.key === 'Escape') {
      event.stopPropagation();
      // 취소 버튼과 Esc의 의미가 다른 화면이 있다. 학습 종료 다이얼로그에서
      // 취소 버튼은 "기록만 저장", Esc는 "종료 자체를 그만둠"이다.
      (onDismiss ?? onCancel)();
      return;
    }
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `CI=true npx react-scripts test --watchAll=false src/components/ui/ConfirmDialog.test.js`
Expected: PASS

- [ ] **Step 5: StartLearning에 녹화를 붙인다**

`src/components/StartLearning.js` 상단 import에 추가한다 (`alertSound` import 다음 줄):

```javascript
import { createSessionRecorder, isRecordingSupported } from '../lib/sessionRecorder';
```

ref를 추가한다 (`isMutedRef` 선언 다음 줄):

```javascript
  const recorderRef = useRef(null);
```

state를 추가한다 (`isMuted` 선언 다음 줄):

```javascript
  const [recordingError, setRecordingError] = useState(null);
```

`beginTicking`의 `onTick` 핸들러를 아래로 교체한다. **틱에 경과 시간을 실어 보낸다:**

```javascript
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
```

`handleStart`에서 AudioContext 생성 블록 **다음에**, `setStatus(STATUS.RUNNING);` **앞에** 녹화를 시작한다:

```javascript
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
```

`handlePause`에 한 줄 추가한다 (`stopTicking();` 다음):

```javascript
    recorderRef.current?.pause();
```

`handleResume`에 한 줄 추가한다 (`setStatus(STATUS.RUNNING);` 앞):

```javascript
    recorderRef.current?.resume();
```

언마운트 cleanup의 AudioContext 정리 **다음에** 레코더를 정리한다:

```javascript
      // 저장하지 않고 화면을 떠나면 녹화분은 버린다. stop()의 Promise는
      // 받을 곳이 없으므로 기다리지 않는다.
      if (recorderRef.current) {
        recorderRef.current.stop();
        recorderRef.current = null;
      }
```

- [ ] **Step 6: 녹화 오류 안내를 화면에 붙인다**

`SAVE_ERROR` 안내 블록 바로 다음에 추가한다:

```javascript
        {recordingError && (
          <p className="start-learning__notice" role="status">
            {recordingError}
          </p>
        )}
```

`src/components/StartLearning.css` 끝에 스타일을 추가한다:

```css
/* 녹화 실패 안내. 학습은 계속되므로 오류(danger)가 아니라 알림 톤으로 둔다. */
.start-learning__notice {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  text-align: center;
  margin: var(--space-2) 0 0;
}
```

- [ ] **Step 7: 전체 테스트와 빌드를 돌린다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 14스위트 174건 통과

Run: `npx react-scripts build`
Expected: 성공. 경고는 기존 4건만. **`CI=true`를 붙이지 마라.**

- [ ] **Step 8: 커밋한다**

```bash
git add src/components/ui/ConfirmDialog.js src/components/ui/ConfirmDialog.test.js src/components/StartLearning.js src/components/StartLearning.css
git commit -m "feat: 학습 중 웹캠 녹화와 경과 시간 기반 틱

이미 열린 카메라 스트림을 재사용해 녹화한다. 일시정지 시 레코더도 함께
멈추므로 완성된 영상의 시간축은 순수 학습 시간이 된다. 그에 맞춰 각 틱에
elapsedMs를 실어 그래프와 알림이 같은 기준을 쓰게 한다.

녹화가 실패해도 학습은 계속된다. 안내만 띄우고 진행을 막지 않는다.

ConfirmDialog에 onDismiss를 선택적으로 추가했다. 다음 태스크의 종료
다이얼로그는 취소 버튼(기록만 저장)과 Esc(종료 취소)의 의미가 달라
둘을 구분해야 한다. 넘기지 않으면 기존 동작 그대로다."
```

---

## Task 6: StartLearning — 저장 다이얼로그와 업로드

**Files:**
- Modify: `src/components/StartLearning.js` (`handleStop` 분리, 다이얼로그, 업로드)

**Interfaces:**
- Consumes: `recorderRef.current.stop()` (Task 5) / `SESSION_VIDEO_BUCKET`, `MAX_STORED_VIDEOS`, `buildVideoPath`, `isVideoLimitReached`, `pickOldestVideoSession` (Task 2) / `RECORDER_MIME_TYPE` (Task 1) / `study_sessions.video_path` (Task 4) / `ConfirmDialog`의 `onDismiss` (Task 5)
- Produces: 저장된 세션 행의 `video_path`가 Storage 객체를 가리킨다. Task 7이 그 경로로 서명 URL을 만든다.

**저장 순서를 지켜라.** 세션 insert가 먼저다 — 경로에 session id가 필요하고, 그 덕분에 **업로드가 실패해도 학습 기록은 남는다.** 45분 공부하고 업로드 한 번 실패했다고 기록까지 날리면 안 된다.

**⚠️ 기존 `handleStop`의 두 가지 함정을 먼저 이해하라.** `src/components/StartLearning.js:243-254`를 직접 읽고 시작하라.

1. **`releaseCamera()`가 저장 전에 호출된다(252행).** 다이얼로그를 띄우는 동안 이것이 실행되면, Esc로 학습에 돌아갔을 때 카메라가 이미 꺼져 있어 검은 화면이 된다. **`releaseCamera()`는 `saveSession` 안에 남겨둬야 한다** — 저장이 확정된 뒤에 끈다.
2. **레코더를 카메라보다 먼저 멈춰야 한다.** 트랙을 먼저 끊으면 마지막 청크가 잘린다.

그래서 이 태스크는 **다이얼로그를 먼저 띄우고, 사용자가 고른 뒤에 레코더를 멈춘다.** 종료 확인 중에는 일시정지와 같은 상태로 취급해 레코더도 `pause()`한다. 그래야 Esc로 돌아가 이어서 공부해도 영상 시간축에 빈 구간이 생기지 않는다.

- [ ] **Step 1: import와 state를 추가한다**

`src/components/StartLearning.js` 상단 import에 추가한다:

```javascript
import ConfirmDialog from './ui/ConfirmDialog';
import {
  SESSION_VIDEO_BUCKET,
  MAX_STORED_VIDEOS,
  buildVideoPath,
  isVideoLimitReached,
  pickOldestVideoSession,
} from '../lib/sessionVideos';
```

Task 5에서 넣은 `sessionRecorder` import 줄에 `RECORDER_MIME_TYPE`을 합친다:

```javascript
import {
  createSessionRecorder,
  isRecordingSupported,
  RECORDER_MIME_TYPE,
} from '../lib/sessionRecorder';
```

state를 추가한다 (`recordingError` 다음):

```javascript
  // { oldest } — 종료 확인 다이얼로그가 떠 있는 동안의 보류 상태.
  // oldest가 있으면 한도가 찬 것이고, 저장하려면 그것을 먼저 지워야 한다.
  // 영상 Blob은 여기 담지 않는다 — 사용자가 고른 뒤에 레코더를 멈춰 만든다.
  const [pendingSave, setPendingSave] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [videoSaveError, setVideoSaveError] = useState(null);
```

- [ ] **Step 2: 업로드 헬퍼를 추가한다**

기존 `handleStop` 함수 **앞에** 추가한다:

```javascript
  // 실패하면 사람이 읽을 메시지를 돌려주고, 성공하면 null을 준다.
  // 어떤 실패도 던지지 않는다 — 세션 기록은 이미 저장됐고 그것을 지켜야 한다.
  const uploadSessionVideo = async (blob, userId, sessionId, oldest) => {
    try {
      if (oldest) {
        const { error: removeError } = await supabase.storage
          .from(SESSION_VIDEO_BUCKET)
          .remove([oldest.video_path]);
        // 지우지 못한 채 올리면 한도를 넘는다. 여기서 멈춘다.
        if (removeError) {
          return '오래된 영상 정리에 실패해 이번 영상을 저장하지 못했습니다.';
        }
        await supabase
          .from('study_sessions')
          .update({ video_path: null })
          .eq('id', oldest.id);
      }

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

      return null;
    } catch (error) {
      return '영상 저장에 실패했습니다. 학습 기록은 저장되었습니다.';
    }
  };
```

- [ ] **Step 3: 기존 handleStop을 saveSession으로 바꾼다**

기존 `handleStop`(243행)의 선언부를 아래로 바꾼다:

```javascript
  const saveSession = async (videoBlob, oldest) => {
```

그리고 그 함수 앞부분에서 **두 줄만 들어낸다** (새 `handleStop`으로 옮겨간다):

- `stopTicking();` (244행)
- `setActiveAlert(null);` (248행) 및 바로 위의 주석 두 줄

**그대로 남겨야 하는 것:**

- `const alerts = alertEngineRef.current?.finish(Date.now()) ?? [];` — 저장할 알림 배열을 만든다
- `releaseCamera();` — **반드시 여기 남는다.** 다이얼로그 단계로 올리면 Esc로 돌아갔을 때 카메라가 꺼져 검은 화면이 된다
- `setStatus(STATUS.SAVING);` 이하 집계·insert 전부

`releaseCamera()` 위의 주석을 새 흐름에 맞게 고친다:

```javascript
    // 저장이 확정된 시점에 카메라를 끈다. 저장 왕복(await) 뒤로 미루면 실패 시
    // 컴포넌트가 계속 마운트된 채 남아 언마운트 클린업이 돌지 않고, 카메라가
    // 켜진 채로 방치된다. 종료 확인 다이얼로그 단계로 올려서도 안 된다 —
    // 사용자가 Esc로 학습에 돌아갔을 때 카메라가 이미 꺼져 있게 된다.
    releaseCamera();
```

그 함수 안의 `navigate(\`/read?session=${data.id}\`);` 줄을 아래로 교체한다:

```javascript
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
          setVideoSaveError(uploadError);
        }
      }

      navigate(`/read?session=${data.id}`);
```

- [ ] **Step 4: 새 handleStop을 만든다**

`saveSession` **앞에** 추가한다:

```javascript
  const handleStop = async () => {
    stopTicking();
    // 종료 확인 중에는 일시정지와 같은 상태다. 레코더도 함께 멈춰야 사용자가
    // Esc로 학습에 돌아갔을 때 영상 시간축에 빈 구간이 생기지 않는다.
    // 여기서 stop()이 아니라 pause()인 이유다 — 아직 확정된 것이 없다.
    recorderRef.current?.pause();
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
```

`handleStop`을 부르던 곳(종료 버튼, `SAVE_ERROR`의 재시도 버튼)은 그대로 둔다.

**주의:** 조회가 실패해 `videoSessions`가 null이면 `rows`는 빈 배열이 되고 한도 미도달로 처리된다. 한도를 넘길 수 있지만, 조회 실패로 저장 자체를 막는 것보다 낫다.

- [ ] **Step 5: 다이얼로그를 렌더한다**

JSX에서 `recordingError` 안내 블록 다음에 추가한다:

```javascript
        {videoSaveError && (
          <p className="start-learning__notice" role="status">
            {videoSaveError}
          </p>
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
              await saveSession(blob, oldest);
            }}
            onCancel={async () => {
              setPendingSave(null);
              recorderRef.current?.stop();
              recorderRef.current = null;
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
```

- [ ] **Step 6: 업로드 진행 표시를 붙인다**

종료 버튼의 라벨을 바꾼다. 기존:

```javascript
                {status === STATUS.SAVING ? '저장 중...' : '종료'}
```

이것을 아래로 바꾼다:

```javascript
                {isUploading
                  ? '영상 업로드 중...'
                  : status === STATUS.SAVING
                    ? '저장 중...'
                    : '종료'}
```

퍼센트는 표시하지 않는다. Supabase JS `upload()`가 진행률을 주지 않으므로 없는 숫자를 지어내면 안 된다.

- [ ] **Step 7: 전체 테스트와 빌드를 돌린다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 14스위트 174건 통과 (이 태스크는 테스트를 추가하지 않는다 — 화면 파일은 TS-003으로 Jest 불가)

Run: `npx react-scripts build`
Expected: 성공. 경고는 기존 4건만.

- [ ] **Step 8: 커밋한다**

```bash
git add src/components/StartLearning.js
git commit -m "feat: 종료 시 영상 저장 선택과 Storage 업로드

세션 insert를 먼저 하고 그다음 업로드한다. 경로에 session id가 필요하기도
하고, 그 덕분에 업로드가 실패해도 학습 기록은 남는다.

한도(3개)가 찼으면 가장 오래된 영상을 지우고 저장할지 묻는다. 정리에
실패하면 업로드하지 않는다 - 지우지 못한 채 올리면 한도를 넘는다.

Esc는 종료 자체를 취소하고 일시정지 상태로 돌아간다. 취소 버튼은
'기록만 저장'이라 의미가 달라 onDismiss로 갈랐다.

업로드 퍼센트는 표시하지 않는다. Supabase upload()가 진행률을 주지
않으므로 없는 숫자를 지어내지 않는다."
```

---

## Task 7: Read — 영상 재생과 seek 연동

**Files:**
- Modify: `src/components/Read.js:70` (select에 `video_path` 추가), 영상 섹션·seek 추가
- Modify: `src/components/SessionReport.css` (영상 섹션)
- Modify: `src/components/FocusChart.css` (막대 버튼화, 현재 위치 마커)

**Interfaces:**
- Consumes: `active_study_sessions.video_path` (Task 4) / `SESSION_VIDEO_BUCKET` (Task 2) / `alerts[].offset_seconds` (Task 3)
- Produces: 없음 (마지막 태스크)

**핵심 규칙:** 영상이 없는 세션에서는 알림 행과 그래프 막대를 **버튼이 아닌 일반 요소로 렌더한다.** 누를 수 없는 버튼을 보여주지 않는다. `offset_seconds`가 없는 구버전 알림도 마찬가지다.

- [ ] **Step 1: import와 state를 추가한다**

`src/components/Read.js`의 React import에 `useRef`를 추가한다:

```javascript
import React, { useEffect, useRef, useState } from 'react';
```

`SESSION_VIDEO_BUCKET`을 import한다:

```javascript
import { SESSION_VIDEO_BUCKET } from '../lib/sessionVideos';
```

state와 ref를 추가한다 (`isDeleting` 다음):

```javascript
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoError, setVideoError] = useState(false);
  const [playedSeconds, setPlayedSeconds] = useState(0);
```

- [ ] **Step 2: select에 video_path를 추가한다**

`Read.js:70`의 select를 바꾼다:

```javascript
        .select(
          'id, started_at, duration_seconds, focus_score, timeline, focus_breakdown, alerts, video_path'
        )
```

- [ ] **Step 3: 서명 URL을 발급한다**

`loadSession` effect **다음에** 새 effect를 추가한다:

```javascript
  useEffect(() => {
    if (!session?.video_path) return undefined;

    let isMounted = true;

    // 공개 URL을 쓰지 않는다. 얼굴이 담긴 개인 데이터라 1시간짜리 서명 URL을 쓴다.
    supabase.storage
      .from(SESSION_VIDEO_BUCKET)
      .createSignedUrl(session.video_path, 3600)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error || !data?.signedUrl) {
          setVideoError(true);
          return;
        }
        setVideoUrl(data.signedUrl);
      });

    return () => {
      isMounted = false;
    };
  }, [session]);
```

- [ ] **Step 4: seek 헬퍼를 추가한다**

`handleDelete` 다음에 추가한다:

```javascript
  const canSeek = Boolean(videoUrl);

  const seekTo = (seconds) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = seconds;
    // 정지 상태에서 눌렀으면 바로 보여주는 게 자연스럽다. 자동재생 정책으로
    // 막히면 사용자가 재생 버튼을 누르면 된다.
    el.play().catch(() => {});
  };
```

- [ ] **Step 5: 영상 섹션을 렌더한다**

점수 블록(`session-report__score`)과 그래프(`focus-chart`) **사이에** 추가한다:

```javascript
            {session.video_path && (
              <section className="session-report__section">
                <h2 className="session-report__section-title">학습 영상</h2>
                {videoError ? (
                  <p className="session-report__video-error" role="status">
                    영상을 불러오지 못했습니다.
                  </p>
                ) : (
                  videoUrl && (
                    <video
                      ref={videoRef}
                      className="session-report__video"
                      src={videoUrl}
                      controls
                      preload="metadata"
                      onTimeUpdate={(event) =>
                        setPlayedSeconds(event.currentTarget.currentTime)
                      }
                    />
                  )
                )}
              </section>
            )}
```

`<track kind="captions">`를 붙이지 마라 — 오디오가 없으므로 자막 대상이 없다.

- [ ] **Step 6: 그래프 막대를 seek 진입점으로 만든다**

기존 `focus-chart` 블록 전체를 아래로 교체한다:

```javascript
            <div
              className="focus-chart"
              role={canSeek ? undefined : 'img'}
              aria-label={
                canSeek
                  ? undefined
                  : `시간대별 집중도 그래프. 종합 집중도 ${session.focus_score}%`
              }
            >
              <div className="focus-chart__track">
                {session.timeline.map((bucket) => {
                  const height = `${Math.round(bucket.focus_ratio * 100)}%`;
                  const isCurrent =
                    canSeek && Math.floor(playedSeconds / 60) === bucket.minute;
                  const className = `focus-chart__bar${
                    isCurrent ? ' focus-chart__bar--current' : ''
                  }`;

                  // 영상이 없으면 누를 수 없는 버튼을 만들지 않는다.
                  if (!canSeek) {
                    return (
                      <div key={bucket.minute} className={className} style={{ height }} />
                    );
                  }

                  return (
                    <button
                      key={bucket.minute}
                      type="button"
                      className={className}
                      style={{ height }}
                      onClick={() => seekTo(bucket.minute * 60)}
                      aria-label={`${bucket.minute}분대, 집중도 ${Math.round(
                        bucket.focus_ratio * 100
                      )}%, 이 지점부터 재생`}
                    />
                  );
                })}
              </div>
              <div className="focus-chart__labels">
                {session.timeline.map((bucket) => (
                  <span key={bucket.minute} className="focus-chart__minute">
                    {bucket.minute}
                  </span>
                ))}
              </div>
            </div>
```

`canSeek`일 때 `role="img"`를 떼는 이유는, 이미지 역할 안의 버튼을 스크린리더가 읽지 않기 때문이다.

- [ ] **Step 7: 알림 행을 seek 진입점으로 만든다**

기존 알림 목록의 `.map(...)` 블록 전체를 아래로 교체한다:

```javascript
                  {session.alerts.map((alert, index) => {
                    // 구버전 알림에는 offset_seconds가 없다. 그 행은 누를 수 없다.
                    const seekable =
                      canSeek && typeof alert.offset_seconds === 'number';

                    const body = (
                      <>
                        <span className="alert-log__time">
                          {formatClock(alert.started_at)}
                        </span>
                        <ReasonBadge reason={alert.reason} />
                        <span className="alert-log__duration">
                          {formatDuration(alert.duration_seconds)}
                        </span>
                      </>
                    );

                    return (
                      <li key={`${alert.started_at}-${index}`} className="alert-log__row">
                        {seekable ? (
                          <button
                            type="button"
                            className="alert-log__seek"
                            onClick={() => seekTo(alert.offset_seconds)}
                            aria-label={`${
                              REASON_LABELS[alert.reason] ?? alert.reason
                            }, ${formatDuration(alert.offset_seconds)} 지점부터 재생`}
                          >
                            {body}
                          </button>
                        ) : (
                          body
                        )}
                      </li>
                    );
                  })}
```

- [ ] **Step 8: 스타일을 추가한다**

`src/components/SessionReport.css` 끝에 추가한다:

```css
/* ── 학습 영상 ─────────────────────────────────────────── */

.session-report__video {
  width: 100%;
  max-width: 720px;
  border-radius: var(--radius-md);
  background-color: var(--color-surface-alt);
  display: block;
}

.session-report__video-error {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin: 0;
}

/* 알림 행이 seek 버튼이 될 때. 행 전체가 눌리도록 편다. */
.alert-log__seek {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: inherit;
  font: inherit;
  text-align: left;
  padding: var(--space-2);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out-expo);
}

.alert-log__seek:hover {
  background-color: var(--color-surface-alt);
}

.alert-log__seek:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

`src/components/FocusChart.css` 끝에 추가한다:

```css
/* 영상이 있는 세션에서는 막대가 seek 버튼이 된다. 기본 버튼 모양을 지우고
   .focus-chart__bar의 생김새를 그대로 쓴다. */
button.focus-chart__bar {
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
}

button.focus-chart__bar:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* 재생 중인 구간. 색만으로 구분하지 않도록 윤곽선을 함께 준다. */
.focus-chart__bar--current {
  background-color: var(--color-accent);
  outline: 2px solid var(--color-text);
  outline-offset: 1px;
}
```

- [ ] **Step 9: 전체 테스트와 빌드를 돌린다**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: 14스위트 174건 통과

Run: `npx react-scripts build`
Expected: 성공. 경고는 기존 4건만.

- [ ] **Step 10: 커밋한다**

```bash
git add src/components/Read.js src/components/SessionReport.css src/components/FocusChart.css
git commit -m "feat: 리포트에 학습 영상 재생과 지점 이동 추가

알림 기록과 집중도 그래프 막대를 누르면 해당 장면부터 재생한다. 재생 중인
구간은 그래프에 표시된다.

영상이 없는 세션에서는 버튼이 아닌 일반 요소로 렌더한다. 누를 수 없는
버튼을 보여주지 않는다. offset_seconds가 없는 구버전 알림도 같다.

공개 URL 대신 1시간짜리 서명 URL을 쓴다. 얼굴이 담긴 개인 데이터다."
```

---

## 배포 순서 (사람이 수행)

구현이 끝나면 아래 순서로 적용한다.

1. `20260806150000_add_video_path_to_study_sessions.sql`을 Supabase SQL Editor에서 실행
2. `select id, video_path from active_study_sessions limit 1;`로 뷰에 컬럼이 보이는지 확인 — 안 보이면 뷰 재생성이 빠진 것이다 (TS-012)
3. `20260806160000_create_session_videos_bucket.sql` 실행
4. Storage 화면에서 `session-videos` 버킷이 **비공개**로 생겼는지 확인
5. 클라이언트 배포

**SQL Editor 붙여넣기 주의 (TS-001):** Monaco 에디터의 괄호 자동완성이 여러 줄 SQL을 깨뜨린다. `window.monaco.editor.getModels()[0].setValue(sql)`로 모델에 직접 주입하면 우회된다.

---

## 수동 검증 (필수)

화면 파일은 `react-router-dom` 때문에 Jest로 못 돈다(TS-003). 아래는 반드시 실제 브라우저에서 확인한다.

**정적 리뷰는 실행을 대체하지 못한다.** TS-010은 리뷰 3회를 통과한 코드가 브라우저에서 빈 화면이었던 건이다.

1. 학습 시작 → 30초 진행 → 종료 → "영상과 함께 저장" → 리포트에 영상이 뜨고 재생된다
2. 알림 기록을 클릭하면 해당 시점으로 이동한다
3. 그래프 막대를 클릭하면 해당 분으로 이동한다
4. 재생 중 그래프의 현재 구간 표시가 따라 움직인다
5. **일시정지를 낀 세션**에서 알림 클릭 지점과 실제 장면이 일치한다 ← Task 3의 핵심. 학습 → 20초 → 일시정지 30초 → 재개 → 자리비움 20초 → 종료 순으로 만들어 확인한다
6. "기록만 저장"을 고르면 영상 섹션이 없다
7. 종료 다이얼로그에서 Esc를 누르면 저장하지 않고 일시정지 상태로 돌아간다. **이때 카메라 미리보기가 살아 있어야 하고**(검은 화면이면 `releaseCamera()`가 잘못된 곳에 있는 것이다), 재개를 누르면 이어서 녹화돼 최종 영상이 Esc 앞뒤로 이어진다
8. 영상 4개째를 저장할 때 한도 다이얼로그가 뜨고, 지우고 저장하면 개수가 3으로 유지된다
9. 기존 세션(영상 없음)의 리포트가 그대로 보이고 그래프·알림이 버튼이 아니다
10. Tab만으로 영상 컨트롤·그래프 막대·알림 행에 도달할 수 있고 포커스 표시가 보인다

---

## 트러블슈팅 기록

`docs/TROUBLESHOOTING.md`에 건별로, 해결·검증 직후 기록한다. 마지막에 몰아 쓰지 마라. **마지막 번호는 TS-012다.**

기록 대상: 원인 파악에 도구 3회 이상 또는 대화 5턴 이상 걸린 건, 첫 가설이 틀려 방향을 바꾼 건, 에러 메시지와 실제 원인이 직관적으로 안 이어진 건, 환경·설정·인프라 문제, 간헐적 재현, 우회로 넘어간 건.

기록 대상 아님: 오타, 단순 문법 오류, 문서 한 번 보고 끝난 설정.
