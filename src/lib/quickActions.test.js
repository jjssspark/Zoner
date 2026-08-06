import { buildQuickActionMeta } from './quickActions';

const session = (score) => [
  { id: 'a', started_at: '2026-08-05T13:20:00.000Z', focus_score: score },
];

describe('buildQuickActionMeta — 학습 시작 타일', () => {
  test('세션이 없으면 빈 상태 문구를 쓴다', () => {
    expect(buildQuickActionMeta([], 0).startLearning).toEqual({
      text: '첫 세션을 시작하세요',
      level: null,
    });
  });

  test('recentSessions가 undefined여도 빈 상태로 처리한다', () => {
    expect(buildQuickActionMeta(undefined, null).startLearning.level).toBeNull();
  });

  test('가장 최근 세션의 점수를 쓴다', () => {
    const meta = buildQuickActionMeta(
      [
        { id: 'a', started_at: '2026-08-05T13:20:00.000Z', focus_score: 82 },
        { id: 'b', started_at: '2026-08-01T09:00:00.000Z', focus_score: 40 },
      ],
      2
    );
    expect(meta.startLearning).toEqual({ text: '마지막 세션 82%', level: 'high' });
  });

  test('점수를 focusLevel 경계대로 등급화한다', () => {
    const at = (score) => buildQuickActionMeta(session(score), 1).startLearning.level;
    expect(at(80)).toBe('high');
    expect(at(79)).toBe('mid');
    expect(at(50)).toBe('mid');
    expect(at(49)).toBe('low');
    expect(at(30)).toBe('low');
    expect(at(29)).toBe('poor');
  });

  test('focus_score가 null이면 빈 상태로 떨어진다', () => {
    expect(buildQuickActionMeta(session(null), 1).startLearning).toEqual({
      text: '첫 세션을 시작하세요',
      level: null,
    });
  });

  test('점수를 정수로 반올림한다', () => {
    expect(buildQuickActionMeta(session(82.6), 1).startLearning.text).toBe(
      '마지막 세션 83%'
    );
  });
});

describe('buildQuickActionMeta — 학습 기록 타일', () => {
  test('총 세션 수를 그대로 쓴다', () => {
    expect(buildQuickActionMeta(session(82), 34).records).toEqual({
      text: '총 34세션',
      level: null,
    });
  });

  test('0이면 빈 상태 문구를 쓴다', () => {
    expect(buildQuickActionMeta([], 0).records.text).toBe('아직 기록이 없습니다');
  });

  test('count가 null이면 중립 문구로 떨어진다', () => {
    expect(buildQuickActionMeta(session(82), null).records.text).toBe('기록 전체 보기');
  });

  test('count가 undefined여도 중립 문구로 떨어진다', () => {
    expect(buildQuickActionMeta(session(82), undefined).records.text).toBe(
      '기록 전체 보기'
    );
  });

  test('recentSessions가 3건으로 잘려 있어도 총계를 따른다', () => {
    // recentSessions는 .limit(3)이 걸려 있으므로 length를 총계로 쓰면 안 된다.
    const three = [
      { id: 'a', started_at: '2026-08-05T00:00:00.000Z', focus_score: 82 },
      { id: 'b', started_at: '2026-08-04T00:00:00.000Z', focus_score: 60 },
      { id: 'c', started_at: '2026-08-03T00:00:00.000Z', focus_score: 40 },
    ];
    expect(buildQuickActionMeta(three, 34).records.text).toBe('총 34세션');
  });
});
