import {
  ALERT_MUTED_STORAGE_KEY,
  loadAlertMuted,
  saveAlertMuted,
  playAlertTone,
} from './alertSound';

describe('음소거 설정', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('저장된 값이 없으면 소리가 켜진 상태다', () => {
    expect(loadAlertMuted()).toBe(false);
  });

  test('음소거를 저장하면 그대로 읽힌다', () => {
    saveAlertMuted(true);
    expect(loadAlertMuted()).toBe(true);
  });

  test('음소거를 해제하면 그대로 읽힌다', () => {
    saveAlertMuted(true);
    saveAlertMuted(false);
    expect(loadAlertMuted()).toBe(false);
  });

  test('알 수 없는 값이 들어 있으면 소리가 켜진 것으로 본다', () => {
    window.localStorage.setItem(ALERT_MUTED_STORAGE_KEY, 'yes');
    expect(loadAlertMuted()).toBe(false);
  });

  test('localStorage 읽기가 실패해도 던지지 않고 기본값을 준다', () => {
    const spy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });
    expect(loadAlertMuted()).toBe(false);
    spy.mockRestore();
  });

  test('localStorage 쓰기가 실패해도 던지지 않는다', () => {
    const spy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    expect(() => saveAlertMuted(true)).not.toThrow();
    spy.mockRestore();
  });
});

describe('playAlertTone', () => {
  test('audioContext가 없으면 조용히 넘어간다', () => {
    expect(() => playAlertTone(null)).not.toThrow();
    expect(() => playAlertTone(undefined)).not.toThrow();
  });

  test('오실레이터를 만들어 짧게 재생한다', () => {
    const oscillator = {
      type: '',
      frequency: { setValueAtTime: jest.fn() },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
    const gain = {
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
      connect: jest.fn(),
    };
    const ctx = {
      currentTime: 0,
      destination: {},
      createOscillator: jest.fn(() => oscillator),
      createGain: jest.fn(() => gain),
    };

    playAlertTone(ctx);

    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(oscillator.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(ctx.destination);
    expect(oscillator.start).toHaveBeenCalledTimes(1);
    expect(oscillator.stop).toHaveBeenCalledTimes(1);
  });

  test('재생 중 예외가 나도 밖으로 던지지 않는다', () => {
    const ctx = {
      currentTime: 0,
      destination: {},
      createOscillator: () => {
        throw new Error('not allowed');
      },
      createGain: jest.fn(),
    };
    expect(() => playAlertTone(ctx)).not.toThrow();
  });
});
