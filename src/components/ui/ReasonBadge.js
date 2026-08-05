import React from 'react';
import './ReasonBadge.css';

export const REASON_LABELS = {
  absent: '자리 비움',
  eyes_closed: '눈 감김',
  focused: '집중',
  head_turned: '고개 돌림',
  looking_down: '아래 보기',
  looking_up: '위 보기',
};

export function ReasonBadge({ reason, ratio }) {
  const label = REASON_LABELS[reason];
  if (!label) {
    return null;
  }

  return (
    <span className={`reason-badge reason-badge--${reason.replace(/_/g, '-')}`}>
      <span className="reason-badge__dot" aria-hidden="true" />
      <span className="reason-badge__label">{label}</span>
      {ratio !== undefined && ratio !== null && (
        <span className="reason-badge__ratio">{Math.round(ratio * 100)}%</span>
      )}
    </span>
  );
}

export default ReasonBadge;
