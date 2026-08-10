import { isReportPrintReady } from './reportPrintReady';

describe('isReportPrintReady', () => {
  test('최근 기록과 조언이 모두 도착하면 인쇄할 수 있다', () => {
    expect(
      isReportPrintReady({ hasRecentSessions: true, adviceStatus: 'ready' })
    ).toBe(true);
  });

  test('조언이 실패해도 인쇄할 수 있다 — 되돌아오지 않는 종착 상태다', () => {
    expect(
      isReportPrintReady({ hasRecentSessions: true, adviceStatus: 'failed' })
    ).toBe(true);
  });

  test('조언을 부르는 중이면 인쇄를 막는다', () => {
    expect(
      isReportPrintReady({ hasRecentSessions: true, adviceStatus: 'loading' })
    ).toBe(false);
  });

  test('조언을 아직 시작도 안 했으면 인쇄를 막는다', () => {
    expect(
      isReportPrintReady({ hasRecentSessions: true, adviceStatus: 'idle' })
    ).toBe(false);
  });

  test('최근 기록이 아직이면 조언 상태와 무관하게 막는다', () => {
    expect(
      isReportPrintReady({ hasRecentSessions: false, adviceStatus: 'ready' })
    ).toBe(false);
  });
});
