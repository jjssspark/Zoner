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

  test('다시 start하면 이전 세션의 청크가 섞이지 않는다', async () => {
    const Fake = installFakeRecorder();
    const recorder = createSessionRecorder({ stream: fakeStream });

    recorder.start();
    Fake.instances[0].emitChunk(10);
    const first = await recorder.stop();

    recorder.start();
    Fake.instances[1].emitChunk(10);
    const second = await recorder.stop();

    expect(Fake.instances).toHaveLength(2);
    // 두 번째 Blob이 첫 세션 청크까지 담았다면 크기가 대략 두 배가 된다.
    expect(second.size).toBe(first.size);
  });

  test('실패한 뒤 다시 start하면 정상 Blob이 나온다', async () => {
    const Fake = installFakeRecorder();
    const recorder = createSessionRecorder({ stream: fakeStream, onError: jest.fn() });

    recorder.start();
    Fake.instances[0].emitError(new Error('device lost'));
    expect(await recorder.stop()).toBeNull();

    recorder.start();
    Fake.instances[1].emitChunk(10);

    expect(await recorder.stop()).toBeInstanceOf(Blob);
  });
});
