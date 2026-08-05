// src/components/Save.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { softDeleteSession } from '../lib/trash';
import './Save.css';

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
};

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
};

export const Save = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadSessions = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      const { data } = await supabase
        .from('active_study_sessions')
        .select('id, started_at, duration_seconds, focus_score')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (isMounted) {
        setSessions(data || []);
        setIsLoading(false);
      }
    };

    loadSessions();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleDelete = async (session) => {
    setDeleteError(null);
    setSessions((prev) => prev.filter((s) => s.id !== session.id));

    try {
      await softDeleteSession(session.id);
    } catch (error) {
      setSessions((prev) =>
        [...prev, session].sort(
          (a, b) => new Date(b.started_at) - new Date(a.started_at)
        )
      );
      setDeleteError('삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  if (isLoading) {
    return <div className="save-page" />;
  }

  return (
    <div className="save-page">
      <header className="save-page__topbar">
        <h1 className="save-page__title">학습 기록</h1>
        <button
          type="button"
          className="save-page__home"
          onClick={() => navigate('/mypage')}
        >
          HOME
        </button>
      </header>

      <main className="save-page__main">
        {deleteError && (
          <p className="save-page__error" role="alert">
            {deleteError}
          </p>
        )}

        {sessions.length === 0 ? (
          <p className="save-page__empty">아직 학습 세션이 없습니다.</p>
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <li key={session.id} className="session-card">
                <button
                  type="button"
                  className="session-card__link"
                  onClick={() => navigate(`/read?session=${session.id}`)}
                >
                  <span className="session-card__date">
                    {formatDate(session.started_at)}
                  </span>
                  <span className="session-card__duration">
                    {formatDuration(session.duration_seconds)}
                  </span>
                  <span className="session-card__score">
                    {session.focus_score}%
                  </span>
                </button>
                <button
                  type="button"
                  className="session-card__delete"
                  aria-label="세션 삭제"
                  onClick={() => handleDelete(session)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default Save;
