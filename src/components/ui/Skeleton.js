import React from 'react';
import './Skeleton.css';

export function Skeleton({ variant = 'text', count = 1, announce = true }) {
  return (
    <div
      className="skeleton"
      role={announce ? 'status' : undefined}
      aria-busy={announce ? 'true' : undefined}
    >
      {announce && <span className="skeleton__sr">불러오는 중</span>}
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`skeleton__item skeleton__item--${variant}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export default Skeleton;
