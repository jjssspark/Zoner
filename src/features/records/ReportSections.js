import React from 'react';
import { REASON_LABELS } from '../../components/ui/ReasonBadge';

// 리포트의 파생 지표·성향·조언 섹션. Read.js가 조회와 상태를 맡고
// 여기서는 받은 값을 그리기만 한다.

const RHYTHM_LABELS = {
  early: '초반 집중형',
  late: '후반 상승형',
  steady: '꾸준형',
  volatile: '기복형',
};

const RHYTHM_NOTES = {
  early: '시작이 강하고 뒤로 갈수록 떨어집니다',
  late: '워밍업이 끝난 뒤에 올라옵니다',
  steady: '전 구간이 고르게 유지됩니다',
  volatile: '같은 세션 안에서도 오르내림이 큽니다',
};

const TREND_LABELS = { up: '오르는 중', flat: '유지 중', down: '떨어지는 중' };
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const minutesOf = (seconds) => Math.round((seconds || 0) / 60);

// 값이 없는 항목은 줄째로 뺀다. "—"를 늘어놓으면 빈칸이 정보처럼 보인다.
const Row = ({ label, value, note }) =>
  value === null || value === undefined ? null : (
    <div className="metric">
      <dt className="metric__label">{label}</dt>
      <dd className="metric__value">
        {value}
        {note && <span className="metric__note">{note}</span>}
      </dd>
    </div>
  );

export const MetricsGrid = ({ metrics, durationSeconds }) => {
  const { halves, topDistraction } = metrics;

  return (
    <section className="session-report__section">
      <h2 className="session-report__section-title">자세히 보기</h2>
      <dl className="metric-grid">
        <Row
          label="순 집중 시간"
          value={
            metrics.netFocusSeconds === null
              ? null
              : `${minutesOf(metrics.netFocusSeconds)}분`
          }
          note={`전체 ${minutesOf(durationSeconds)}분 중`}
        />
        <Row
          label="최장 연속 집중"
          value={`${metrics.longestStreakMinutes}분`}
          note="80% 이상 유지"
        />
        <Row
          label="처음 무너진 시점"
          value={
            metrics.firstBreakMinute === null
              ? '없음'
              : `${metrics.firstBreakMinute}분째`
          }
          note={metrics.firstBreakMinute === null ? '끝까지 유지' : '50% 아래로'}
        />
        <Row
          label="전반 → 후반"
          value={halves ? `${halves.first}% → ${halves.second}%` : null}
          note={
            halves ? `${halves.delta > 0 ? '+' : ''}${halves.delta}%p` : null
          }
        />
        <Row
          label="구간별 기복"
          value={metrics.volatility}
          note="낮을수록 고름"
        />
        <Row
          label="시간당 이탈"
          value={
            metrics.alertsPerHour === null ? null : `${metrics.alertsPerHour}회`
          }
        />
        <Row
          label="최고 구간"
          value={metrics.best ? `${metrics.best.minute}분대` : null}
          note={metrics.best ? `${metrics.best.ratio}%` : null}
        />
        <Row
          label="최저 구간"
          value={metrics.worst ? `${metrics.worst.minute}분대` : null}
          note={metrics.worst ? `${metrics.worst.ratio}%` : null}
        />
        <Row
          label="가장 큰 이탈 원인"
          value={
            topDistraction
              ? REASON_LABELS[topDistraction.reason] ?? topDistraction.reason
              : null
          }
          note={
            topDistraction
              ? `${topDistraction.ratio}% · ${minutesOf(
                  topDistraction.seconds
                )}분`
              : null
          }
        />
      </dl>
    </section>
  );
};

export const ProfileSection = ({ profile }) => {
  if (!profile?.hasEnoughData) return null;

  const rhythm = profile.rhythmType;
  const weekdayRows = profile.byWeekday.filter((row) => row.count > 0);

  return (
    <section className="session-report__section">
      <h2 className="session-report__section-title">
        학습 성향{' '}
        <span className="section-sub">최근 {profile.sessionCount}세션</span>
      </h2>

      {rhythm && (
        <p className="profile-headline">
          <strong>{RHYTHM_LABELS[rhythm]}</strong>
          <span className="profile-headline__note">{RHYTHM_NOTES[rhythm]}</span>
        </p>
      )}

      <dl className="metric-grid">
        <Row label="평균 집중도" value={`${profile.averageScore}%`} />
        <Row
          label="추세"
          value={profile.trend ? TREND_LABELS[profile.trend] : null}
        />
        <Row
          label="집중 지속 한계"
          value={
            profile.enduranceMinutes === null
              ? null
              : `약 ${profile.enduranceMinutes}분`
          }
          note="이후 흔들리기 시작"
        />
        <Row
          label="반복되는 이탈"
          value={
            profile.distractionType
              ? REASON_LABELS[profile.distractionType] ?? profile.distractionType
              : null
          }
        />
        <Row
          label="잘 되는 시간대"
          value={profile.bestHour ? `${profile.bestHour.hour}시대` : null}
          note={profile.bestHour ? `평균 ${profile.bestHour.average}%` : null}
        />
        <Row
          label="잘 되는 요일"
          value={
            profile.bestWeekday
              ? `${WEEKDAYS[profile.bestWeekday.weekday]}요일`
              : null
          }
          note={
            profile.bestWeekday ? `평균 ${profile.bestWeekday.average}%` : null
          }
        />
      </dl>

      {weekdayRows.length > 1 && (
        <ul className="weekday-bars">
          {weekdayRows.map((row) => (
            <li key={row.weekday} className="weekday-bars__row">
              <span className="weekday-bars__day">{WEEKDAYS[row.weekday]}</span>
              <span className="weekday-bars__track">
                <span
                  className="weekday-bars__bar"
                  style={{ width: `${row.average}%` }}
                />
              </span>
              <span className="weekday-bars__value">{row.average}%</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const AdviceSection = ({ advice, status }) => {
  // 조언은 리포트의 곁가지다. 못 받아왔으면 섹션을 통째로 접는다 —
  // 실패 문구를 남기면 PDF에 "조언을 받지 못했습니다"가 인쇄된다.
  if (status !== 'ready' || advice.length === 0) return null;

  return (
    <section className="session-report__section">
      <h2 className="session-report__section-title">
        이렇게 해보세요 <span className="section-sub">AI 분석</span>
      </h2>
      <ul className="advice">
        {advice.map((item) => (
          <li key={item} className="advice__item">
            {item}
          </li>
        ))}
      </ul>
      <p className="advice__disclaimer">
        위 수치를 근거로 생성된 제안입니다. 의학적 판단이 아닙니다.
      </p>
    </section>
  );
};
