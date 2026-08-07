import React, { useEffect, useState } from 'react';
import { countUpFrame } from '../../lib/countUp';
import './ScoreRing.css';

const SIZE_PX = { sm: 64, md: 120, lg: 200 };
const STROKE_PX = { sm: 6, md: 10, lg: 14 };

// tokens.css의 --duration-slow와 같아야 숫자가 링과 함께 도착한다.
const COUNT_UP_MS = 600;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia(REDUCED_MOTION).matches;

// 링이 채워지는 동안 가운데 숫자도 같이 올라간다. CSS 애니메이션은
// prefers-reduced-motion 블록이 알아서 죽이지만 rAF는 막지 못하므로
// 여기서 직접 확인해 즉시 최종값을 보여준다.
function useCountUp(target) {
  const [displayed, setDisplayed] = useState(() =>
    prefersReducedMotion() ? target : 0
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayed(target);
      return undefined;
    }

    let frameId;
    const startedAt = performance.now();

    const step = (now) => {
      const value = countUpFrame(target, now - startedAt, COUNT_UP_MS);
      setDisplayed(value);
      if (value !== target) {
        frameId = window.requestAnimationFrame(step);
      }
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [target]);

  return displayed;
}

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
  const displayedScore = useCountUp(score);

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
          {displayedScore}
        </span>
        <span className="score-ring__unit">%</span>
        {label && <span className="score-ring__label">{label}</span>}
      </div>
    </div>
  );
}

export default ScoreRing;
