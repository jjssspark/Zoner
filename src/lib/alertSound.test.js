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

  const createMockContext = () => {
    const oscillators = [];
    const gains = [];
    return {
      oscillators,
      gains,
      ctx: {
        state: 'running',
        currentTime: 0,
        destination: {},
        createOscillator: jest.fn(() => {
          const oscillator = {
            type: '',
            frequency: { setValueAtTime: jest.fn() },
            connect: jest.fn(),
            start: jest.fn(),
            stop: jest.fn(),
          };
          oscillators.push(oscillator);
          return oscillator;
        }),
        createGain: jest.fn(() => {
          const gain = {
            gain: {
              setValueAtTime: jest.fn(),
              exponentialRampToValueAtTime: jest.fn(),
            },
            connect: jest.fn(),
          };
          gains.push(gain);
          return gain;
        }),
      },
    };
  };

  test('두 번 끊어 치는 알림음을 재생한다', () => {
    const { ctx, oscillators, gains } = createMockContext();

    playAlertTone(ctx);

    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    oscillators.forEach((oscillator, index) => {
      expect(oscillator.connect).toHaveBeenCalledWith(gains[index]);
      expect(gains[index].connect).toHaveBeenCalledWith(ctx.destination);
      expect(oscillator.start).toHaveBeenCalledTimes(1);
      expect(oscillator.stop).toHaveBeenCalledTimes(1);
    });
  });

  test('두 번째 음은 첫 번째 음이 끝난 뒤에 시작한다', () => {
    const { ctx, oscillators } = createMockContext();

    playAlertTone(ctx);

    const [firstEnd] = oscillators[0].stop.mock.calls[0];
    const [secondStart] = oscillators[1].start.mock.calls[0];
    expect(secondStart).toBeGreaterThan(firstEnd);
  });

  test('두 음의 높이가 서로 다르다', () => {
    const { ctx, oscillators } = createMockContext();

    playAlertTone(ctx);

    const [firstHz] = oscillators[0].frequency.setValueAtTime.mock.calls[0];
    const [secondHz] = oscillators[1].frequency.setValueAtTime.mock.calls[0];
    expect(firstHz).not.toBe(secondHz);
  });

  test('컨텍스트가 정지돼 있으면 깨운 뒤 재생한다', () => {
    const { ctx } = createMockContext();
    ctx.state = 'suspended';
    ctx.resume = jest.fn(() => Promise.resolve());

    playAlertTone(ctx);

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  test('컨텍스트 깨우기가 실패해도 던지지 않는다', () => {
    const { ctx } = createMockContext();
    ctx.state = 'suspended';
    ctx.resume = jest.fn(() => Promise.reject(new Error('denied')));

    expect(() => playAlertTone(ctx)).not.toThrow();
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
