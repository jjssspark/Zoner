import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../../lib/supabaseClient';
import { purgeExpiredSessions, daysUntilPurge, expiryLevel } from '../../lib/trash';
import { focusLevel } from '../../lib/focusLevel';
import Skeleton from '../../components/ui/Skeleton';
import './Trash.css';

// 로딩 중에도 동일한 마크업을 렌더해야 데이터 로드 완료 시 헤더가 나타나며
// 레이아웃이 밀리지 않는다.
function TrashTopbar({ onBack, onHome }) {
  return (
    <header className="trash-page__topbar">
      <h1 className="trash-page__title">휴지통</h1>
      <div className="trash-page__topbar-actions">
        <button type="button" className="trash-page__back" onClick={onBack}>
          뒤로가기
        </button>
        <button type="button" className="trash-page__home" onClick={onHome}>
          HOME
        </button>
      </div>
    </header>
  );
}

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

export const Trash = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadTrash = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      try {
        await purgeExpiredSessions(user.id);
      } catch (error) {
        // 정리 실패는 무시 — 조회 자체는 계속 진행, 다음 방문 때 다시 시도된다
      }

      const { data } = await supabase
        .from('study_sessions')
        .select('id, started_at, duration_seconds, focus_score, deleted_at')
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (isMounted) {
        setSessions(data || []);
        setIsLoading(false);
      }
    };

    loadTrash();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="trash-page">
        <TrashTopbar
          onBack={() => navigate(-1)}
          onHome={() => navigate('/mypage')}
        />
        <main className="trash-page__main">
          <Skeleton variant="card" count={3} />
        </main>
      </div>
    );
  }

  return (
    <div className="trash-page">
      <TrashTopbar
        onBack={() => navigate(-1)}
        onHome={() => navigate('/mypage')}
      />

      <main className="trash-page__main">
        {sessions.length === 0 ? (
          <p className="trash-page__empty">휴지통이 비어 있습니다.</p>
        ) : (
          <ul className="trash-list">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className="trash-card"
                  onClick={() => navigate(`/trashread?session=${session.id}`)}
                >
                  <span className="trash-card__date">
                    {formatDate(session.started_at)}
                  </span>
                  <span className="trash-card__duration">
                    {formatDuration(session.duration_seconds)}
                  </span>
                  <span
                    className={`trash-card__score trash-card__score--${focusLevel(
                      session.focus_score
                    )}`}
                  >
                    {session.focus_score}%
                  </span>
                  <span
                    className={`trash-card__purge trash-card__purge--${expiryLevel(
                      daysUntilPurge(session.deleted_at)
                    )}`}
                  >
                    {daysUntilPurge(session.deleted_at)}일 후 자동 삭제
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

export default Trash;
