import { buildReportTitle } from './reportTitle';

describe('buildReportTitle', () => {
  test('세션 시작일을 파일명에 넣는다', () => {
    expect(buildReportTitle('2026-08-09T14:30:00Z')).toMatch(
      /^zoner-report-2026-08-\d{2}$/
    );
  });

  test('월·일을 두 자리로 채운다', () => {
    // 로컬 타임존에 따라 날짜가 하루 밀릴 수 있으므로 자릿수만 본다.
    expect(buildReportTitle('2026-01-05T12:00:00Z')).toMatch(
      /^zoner-report-\d{4}-\d{2}-\d{2}$/
    );
  });

  test('날짜가 없거나 깨졌으면 날짜 없는 이름으로 떨어진다', () => {
    // PDF 저장은 실패하면 안 되는 동작이다. 이름이 덜 친절할지언정
    // "Invalid Date"가 파일명에 박히거나 예외로 저장이 막히면 안 된다.
    expect(buildReportTitle(undefined)).toBe('zoner-report');
    expect(buildReportTitle('어제')).toBe('zoner-report');
    expect(buildReportTitle(null)).toBe('zoner-report');
  });
});
