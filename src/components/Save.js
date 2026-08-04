import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
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
        .from('study_sessions')
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
        {sessions.length === 0 ? (
          <p className="save-page__empty">아직 학습 세션이 없습니다.</p>
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className="session-card"
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
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default Save;
