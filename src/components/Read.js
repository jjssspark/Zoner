// src/components/Read.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { softDeleteSession } from '../lib/trash';
import './SessionReport.css';
import './FocusChart.css';

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')}`;
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
        .select('id, started_at, duration_seconds, focus_score, timeline')
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
          </>
        )}
      </main>
    </div>
  );
};

export default Read;
