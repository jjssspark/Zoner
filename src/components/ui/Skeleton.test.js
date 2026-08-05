import React from 'react';
import { render, screen } from '@testing-library/react';
import Skeleton from './Skeleton';

describe('Skeleton', () => {
  test('기본은 한 줄', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelectorAll('.skeleton__item')).toHaveLength(1);
  });

  test('count만큼 반복한다', () => {
    const { container } = render(<Skeleton variant="card" count={3} />);
    expect(container.querySelectorAll('.skeleton__item')).toHaveLength(3);
  });

  test('variant를 클래스로 반영한다', () => {
    const { container } = render(<Skeleton variant="metric" />);
    expect(
      container.querySelector('.skeleton__item--metric')
    ).toBeInTheDocument();
  });

  test('로딩 중임을 스크린리더에 한 번만 알린다', () => {
    render(<Skeleton count={3} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('불러오는 중')).toBeInTheDocument();
  });
});
