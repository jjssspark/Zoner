import React from 'react';
import { render, screen } from '@testing-library/react';
import ScoreRing, { focusLevel } from './ScoreRing';

describe('focusLevel', () => {
  test('80 이상은 high', () => {
    expect(focusLevel(80)).toBe('high');
    expect(focusLevel(100)).toBe('high');
  });

  test('50~79는 mid', () => {
    expect(focusLevel(79)).toBe('mid');
    expect(focusLevel(50)).toBe('mid');
  });

  test('30~49는 low', () => {
    expect(focusLevel(49)).toBe('low');
    expect(focusLevel(30)).toBe('low');
  });

  test('30 미만은 poor', () => {
    expect(focusLevel(29)).toBe('poor');
    expect(focusLevel(0)).toBe('poor');
  });
});

describe('ScoreRing', () => {
  test('점수를 숫자로 표시한다', () => {
    render(<ScoreRing value={73} />);
    expect(screen.getByText('73')).toBeInTheDocument();
  });

  test('aria-label로 수치를 텍스트로 전달한다', () => {
    render(<ScoreRing value={73} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      '집중도 73퍼센트'
    );
  });

  test('label을 주면 aria-label 앞에 붙는다', () => {
    render(<ScoreRing value={50} label="오늘" />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      '오늘 집중도 50퍼센트'
    );
  });

  test('범위를 벗어난 값을 0~100으로 자른다', () => {
    const { rerender } = render(<ScoreRing value={150} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    rerender(<ScoreRing value={-10} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  test('소수점 값을 반올림한다', () => {
    render(<ScoreRing value={72.6} />);
    expect(screen.getByText('73')).toBeInTheDocument();
  });

  test('점수 구간에 따라 다른 클래스를 준다', () => {
    const { container, rerender } = render(<ScoreRing value={90} />);
    expect(
      container.querySelector('.score-ring__value--high')
    ).toBeInTheDocument();
    rerender(<ScoreRing value={10} />);
    expect(
      container.querySelector('.score-ring__value--poor')
    ).toBeInTheDocument();
  });
});
