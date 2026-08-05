import React from 'react';
import { render, screen } from '@testing-library/react';
import ReasonBadge, { REASON_LABELS } from './ReasonBadge';

describe('ReasonBadge', () => {
  test('여섯 가지 원인 모두에 한글 라벨이 있다', () => {
    expect(Object.keys(REASON_LABELS).sort()).toEqual([
      'absent',
      'eyes_closed',
      'focused',
      'head_turned',
      'looking_down',
      'looking_up',
    ]);
  });

  test('색과 함께 항상 한글 라벨을 표시한다', () => {
    render(<ReasonBadge reason="absent" />);
    expect(screen.getByText('자리 비움')).toBeInTheDocument();
  });

  test('reason을 하이픈 클래스로 바꾼다', () => {
    const { container } = render(<ReasonBadge reason="eyes_closed" />);
    expect(
      container.querySelector('.reason-badge--eyes-closed')
    ).toBeInTheDocument();
  });

  test('ratio를 주면 백분율로 표시한다', () => {
    render(<ReasonBadge reason="focused" ratio={0.42} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  test('ratio가 없으면 백분율을 표시하지 않는다', () => {
    const { container } = render(<ReasonBadge reason="focused" />);
    expect(container.querySelector('.reason-badge__ratio')).toBeNull();
  });

  test('모르는 reason이면 아무것도 그리지 않는다', () => {
    const { container } = render(<ReasonBadge reason="unknown_reason" />);
    expect(container.firstChild).toBeNull();
  });
});
