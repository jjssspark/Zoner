// src/components/Read.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { softDeleteSession } from '../lib/trash';
import ReasonBadge, { REASON_LABELS } from './ui/ReasonBadge';
import './SessionReport.css';
import './FocusChart.css';

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

// focus_breakdown은 { focused: 0.4, absent: 0.2, ... } 형태의 비율 맵이다.
// 값이 큰 순으로 정렬하되 0인 항목은 막대를 그리지 않는다.
const breakdownRows = (breakdown) =>
  Object.entries(breakdown || {})
    .filter(([reason, ratio]) => REASON_LABELS[reason] && ratio > 0)
    .sort((a, b) => b[1] - a[1]);

const formatDuration = (seconds) => {
  const total = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
};

const formatClock = (isoString) => {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

export const Read = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      if (!sessionId) {
        if (isMounted) {
          setNotFound(true);
          setIsLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from('active_study_sessions')
        .select('id, started_at, duration_seconds, focus_score, timeline, focus_breakdown, alerts')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (isMounted) {
        if (data) {
          setSession(data);
        } else {
          setNotFound(true);
        }
        setIsLoading(false);
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [navigate, sessionId]);

  const handleDelete = async () => {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await softDeleteSession(session.id);
      navigate('/save');
    } catch (error) {
      setDeleteError('삭제에 실패했습니다. 다시 시도해주세요.');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="session-report" />;
  }

  return (
    <div className="session-report">
      <header className="session-report__topbar">
        <h1 className="session-report__title">학습 리포트</h1>
        <div className="session-report__topbar-actions">
          <button
            type="button"
            className="session-report__back"
            onClick={() => navigate(-1)}
          >
            뒤로가기
          </button>
          {session && (
            <button
              type="button"
              className="session-report__delete"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </button>
          )}
          <button
            type="button"
            className="session-report__home"
            onClick={() => navigate('/save')}
          >
            목록으로
          </button>
        </div>
      </header>

      <main className="session-report__main">
        {notFound ? (
          <p className="session-report__empty">
            해당 학습 세션을 찾을 수 없습니다.
          </p>
        ) : (
          <>
            {deleteError && (
              <p className="session-report__error" role="alert">
                {deleteError}
              </p>
            )}

            <p className="session-report__date">
              {formatDate(session.started_at)}
            </p>
            <div className="session-report__score">
              <span className="session-report__score-value">
                {session.focus_score}%
              </span>
              <span className="session-report__score-label">종합 집중도</span>
            </div>

            <div
              className="focus-chart"
              role="img"
              aria-label={`시간대별 집중도 그래프. 종합 집중도 ${session.focus_score}%`}
            >
              <div className="focus-chart__track">
                {session.timeline.map((bucket) => (
                  <div
                    key={bucket.minute}
                    className="focus-chart__bar"
                    style={{ height: `${Math.round(bucket.focus_ratio * 100)}%` }}
                  />
                ))}
              </div>
              <div className="focus-chart__labels">
                {session.timeline.map((bucket) => (
                  <span key={bucket.minute} className="focus-chart__minute">
                    {bucket.minute}
                  </span>
                ))}
              </div>
            </div>

            {breakdownRows(session.focus_breakdown).length > 0 && (
              <section className="session-report__section">
                <h2 className="session-report__section-title">원인별 비율</h2>
                <ul className="focus-breakdown">
                  {breakdownRows(session.focus_breakdown).map(([reason, ratio]) => (
                    <li key={reason} className="focus-breakdown__row">
                      <span className="focus-breakdown__label">
                        <ReasonBadge reason={reason} />
                      </span>
                      <span className="focus-breakdown__track">
                        <span
                          className={`focus-breakdown__bar focus-breakdown__bar--${reason.replace(
                            /_/g,
                            '-'
                          )}`}
                          style={{ width: `${Math.round(ratio * 100)}%` }}
                        />
                      </span>
                      <span className="focus-breakdown__value">
                        {Math.round(ratio * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {Array.isArray(session.alerts) && session.alerts.length > 0 && (
              <section className="session-report__section">
                <h2 className="session-report__section-title">
                  알림 기록 ({session.alerts.length}건)
                </h2>
                <ul className="alert-log">
                  {session.alerts.map((alert, index) => (
                    <li key={`${alert.started_at}-${index}`} className="alert-log__row">
                      <span className="alert-log__time">{formatClock(alert.started_at)}</span>
                      <ReasonBadge reason={alert.reason} />
                      <span className="alert-log__duration">
                        {formatDuration(alert.duration_seconds)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Read;
