import {
  buildConversationTitle,
  DEFAULT_CONVERSATION_TITLE,
  MAX_TITLE_LENGTH,
} from './conversations';

describe('buildConversationTitle', () => {
  test('짧은 문장은 그대로 제목이 된다', () => {
    expect(buildConversationTitle('미분이 어려워')).toBe('미분이 어려워');
  });

  test('기준 길이와 정확히 같으면 자르지 않는다', () => {
    const exact = '가'.repeat(MAX_TITLE_LENGTH);
    expect(buildConversationTitle(exact)).toBe(exact);
  });

  test('기준 길이를 넘으면 잘라내고 말줄임표를 붙인다', () => {
    const long = '가'.repeat(MAX_TITLE_LENGTH + 5);
    expect(buildConversationTitle(long)).toBe(`${'가'.repeat(MAX_TITLE_LENGTH)}…`);
  });

  test('단어 중간에서 잘려도 그대로 둔다', () => {
    const content = '이차함수의 그래프를 그리는 방법이 궁금합니다';
    expect(buildConversationTitle(content)).toBe('이차함수의 그래프를 그리는 방법이 궁…');
  });

  test('앞뒤 공백은 제거한다', () => {
    expect(buildConversationTitle('   안녕   ')).toBe('안녕');
  });

  test('줄바꿈과 연속 공백은 공백 하나로 접는다', () => {
    expect(buildConversationTitle('첫 줄\n\n둘째  줄')).toBe('첫 줄 둘째 줄');
  });

  test('공백만 있으면 기본 제목을 쓴다', () => {
    expect(buildConversationTitle('   \n  ')).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  test('빈 문자열이면 기본 제목을 쓴다', () => {
    expect(buildConversationTitle('')).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  test('null이면 기본 제목을 쓴다', () => {
    expect(buildConversationTitle(null)).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  test('undefined면 기본 제목을 쓴다', () => {
    expect(buildConversationTitle(undefined)).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  test('줄바꿈을 접은 뒤 길이를 재서 자른다', () => {
    const content = `${'가'.repeat(10)}\n${'나'.repeat(20)}`;
    // 접으면 '가'×10 + ' ' + '나'×20 = 31자 → 20자에서 자른다
    expect(buildConversationTitle(content)).toBe(`${'가'.repeat(10)} ${'나'.repeat(9)}…`);
  });
});
