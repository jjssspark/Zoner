import React from 'react';
import { focusLevel } from './ScoreRing';
import './Sparkline.css';

const STROKE = 1.5;

export function Sparkline({ data, width = 96, height = 24, ariaLabel }) {
  if (!data || data.length === 0) {
    return null;
  }

  // 선 굵기의 절반만큼 위아래를 비워야 최대·최소값에서 선이 잘리지 않는다.
  const pad = STROKE / 2;
  const usable = height - STROKE;
  const toY = (v) => pad + (1 - Math.max(0, Math.min(1, v))) * usable;

  const points =
    data.length === 1
      ? `0,${toY(data[0])} ${width},${toY(data[0])}`
      : data
          .map((v, i) => `${(i / (data.length - 1)) * width},${toY(v)}`)
          .join(' ');

  const average = data.reduce((sum, v) => sum + v, 0) / data.length;
  const level = focusLevel(average * 100);

  return (
    <svg
      className={`sparkline sparkline--${level}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={
        ariaLabel ?? `집중도 추이, 평균 ${Math.round(average * 100)}퍼센트`
      }
    >
      <polyline className="sparkline__line" points={points} />
    </svg>
  );
}

export default Sparkline;
