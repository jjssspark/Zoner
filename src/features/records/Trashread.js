import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import supabase from '../../lib/supabaseClient';
import { restoreSession, hardDeleteSession, daysUntilPurge, expiryLevel } from '../../lib/trash';
import Skeleton from '../../components/ui/Skeleton';
import './TrashDetail.css';
import './FocusChart.css';

// 로딩 중에도 동일한 마크업을 렌더해야 데이터 로드 완료 시 헤더가 나타나며
// 레이아웃이 밀리지 않는다.
function TrashDetailTopbar({ onBack, onList }) {
  return (
    <header className="trash-detail__topbar">
      <h1 className="trash-detail__title">삭제한 항목</h1>
      <div className="trash-detail__topbar-actions">
        <button type="button" className="trash-detail__back" onClick={onBack}>
          뒤로가기
        </button>
        <button type="button" className="trash-detail__home" onClick={onList}>
          휴지통으로
        </button>
      </div>
    </header>
  );
}

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

export const Trashread = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [confirmingPurge, setConfirmingPurge] = useState(false);

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
        .from('study_sessions')
        .select('id, started_at, duration_seconds, focus_score, timeline, deleted_at')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
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

  const handleRestore = async () => {
    setActionError(null);
    setIsRestoring(true);

    try {
      await restoreSession(session.id);
      navigate('/save');
    } catch (error) {
      setActionError('복구에 실패했습니다. 다시 시도해주세요.');
      setIsRestoring(false);
    }
  };

  const handlePurgeClick = async () => {
    if (!confirmingPurge) {
      setConfirmingPurge(true);
      return;
    }

    setActionError(null);
    setIsPurging(true);

    try {
      await hardDeleteSession(session.id);
      navigate('/trash');
    } catch (error) {
      setActionError('영구삭제에 실패했습니다. 다시 시도해주세요.');
      setIsPurging(false);
    }
  };

  if (isLoading) {
    return (
      <div className="trash-detail">
        <TrashDetailTopbar
          onBack={() => navigate(-1)}
          onList={() => navigate('/trash')}
        />
        <main className="trash-detail__main">
          <Skeleton variant="text" count={1} />
          <Skeleton variant="metric" count={1} announce={false} />
        </main>
      </div>
    );
  }

  return (
    <div className="trash-detail">
      <TrashDetailTopbar
        onBack={() => navigate(-1)}
        onList={() => navigate('/trash')}
      />

      <main className="trash-detail__main">
        {notFound ? (
          <p className="trash-detail__empty">
            해당 학습 세션을 찾을 수 없습니다.
          </p>
        ) : (
          <>
            {actionError && (
              <p className="trash-detail__error" role="alert">
                {actionError}
              </p>
            )}

            <p className="trash-detail__date">
              {formatDate(session.started_at)}
            </p>
            <span
              className={`trash-detail__expiry trash-detail__expiry--${expiryLevel(
                daysUntilPurge(session.deleted_at)
              )}`}
            >
              {daysUntilPurge(session.deleted_at)}일 후 자동 삭제
            </span>
            <div className="trash-detail__score">
              <span className="trash-detail__score-value">
                {session.focus_score}%
              </span>
              <span className="trash-detail__score-label">종합 집중도</span>
            </div>

            <div
              className="focus-chart"
              role="img"
              aria-label={`시간대별 집중도 그래프. 종합 집중도 ${session.focus_score}%`}
            >
              <div className="focus-chart__track">
                {session.timeline.map((bucket, index) => (
                  <div
                    key={bucket.minute}
                    className="focus-chart__bar"
                    style={{
                      height: `${Math.round(bucket.focus_ratio * 100)}%`,
                      // 왼쪽부터 순차로 자라도록 순번을 CSS에 넘긴다.
                      '--bar-index': index,
                    }}
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

            <div className="trash-detail__actions">
              <button
                type="button"
                className="trash-detail__restore"
                onClick={handleRestore}
                disabled={isRestoring || isPurging}
              >
                {isRestoring ? '복구 중...' : '복구'}
              </button>
              <button
                type="button"
                className={`trash-detail__purge${
                  confirmingPurge ? ' is-confirming' : ''
                }`}
                onClick={handlePurgeClick}
                disabled={isRestoring || isPurging}
                aria-live="polite"
              >
                {isPurging
                  ? '삭제 중...'
                  : confirmingPurge
                  ? '정말 삭제하려면 다시 클릭'
                  : '영구삭제'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Trashread;
