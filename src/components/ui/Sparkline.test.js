import React from 'react';
import { render, screen } from '@testing-library/react';
import Sparkline from './Sparkline';

const pointsOf = (container) =>
  container
    .querySelector('polyline')
    .getAttribute('points')
    .trim()
    .split(/\s+/);

describe('Sparkline', () => {
  test('데이터가 비면 아무것도 그리지 않는다', () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('데이터가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<Sparkline data={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  test('점 개수만큼 polyline 좌표를 만든다', () => {
    const { container } = render(
      <Sparkline data={[0, 0.5, 1]} width={100} height={20} />
    );
    expect(pointsOf(container)).toHaveLength(3);
  });

  test('첫 점은 왼쪽 끝, 마지막 점은 오른쪽 끝에 놓는다', () => {
    const { container } = render(
      <Sparkline data={[0, 1]} width={100} height={20} />
    );
    const points = pointsOf(container);
    expect(points[0].split(',')[0]).toBe('0');
    expect(points[1].split(',')[0]).toBe('100');
  });

  test('값이 클수록 y가 작다 (위로 올라간다)', () => {
    const { container } = render(
      <Sparkline data={[0, 1]} width={100} height={20} />
    );
    const points = pointsOf(container);
    const y0 = Number(points[0].split(',')[1]);
    const y1 = Number(points[1].split(',')[1]);
    expect(y1).toBeLessThan(y0);
  });

  test('점이 하나면 가로 직선을 그린다', () => {
    const { container } = render(
      <Sparkline data={[0.5]} width={100} height={20} />
    );
    const points = pointsOf(container);
    expect(points).toHaveLength(2);
    expect(points[0].split(',')[1]).toBe(points[1].split(',')[1]);
  });

  test('기본 aria-label에 평균 집중도를 담는다', () => {
    render(<Sparkline data={[0.5, 0.7]} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      '집중도 추이, 평균 60퍼센트'
    );
  });

  test('ariaLabel을 주면 그것을 쓴다', () => {
    render(<Sparkline data={[0.5]} ariaLabel="12분간 추이" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', '12분간 추이');
  });
});
