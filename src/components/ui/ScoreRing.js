import React from 'react';
import './ScoreRing.css';

const SIZE_PX = { sm: 64, md: 120, lg: 200 };
const STROKE_PX = { sm: 6, md: 10, lg: 14 };

export function focusLevel(value) {
  if (value >= 80) return 'high';
  if (value >= 50) return 'mid';
  if (value >= 30) return 'low';
  return 'poor';
}

export function ScoreRing({ value, size = 'md', label }) {
  const score = Math.max(0, Math.min(100, Math.round(value)));
  const px = SIZE_PX[size] ?? SIZE_PX.md;
  const stroke = STROKE_PX[size] ?? STROKE_PX.md;
  const radius = (px - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const level = focusLevel(score);

  return (
    <div className={`score-ring score-ring--${size}`}>
      <svg
        className="score-ring__svg"
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        role="img"
        aria-label={`${label ? `${label} ` : ''}집중도 ${score}퍼센트`}
      >
        <circle
          className="score-ring__track"
          cx={px / 2}
          cy={px / 2}
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className={`score-ring__value score-ring__value--${level}`}
          cx={px / 2}
          cy={px / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          style={{
            '--ring-circumference': circumference,
            '--ring-offset': offset,
          }}
        />
      </svg>
      <div className="score-ring__center" aria-hidden="true">
        <span className={`score-ring__number score-ring__number--${level}`}>
          {score}
        </span>
        <span className="score-ring__unit">%</span>
        {label && <span className="score-ring__label">{label}</span>}
      </div>
    </div>
  );
}

export default ScoreRing;
