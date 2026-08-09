// src/components/Read.js
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import supabase from '../../lib/supabaseClient';
import { softDeleteSession } from '../../lib/trash';
import { SESSION_VIDEO_BUCKET } from '../../lib/sessionVideos';
import ReasonBadge, { REASON_LABELS } from '../../components/ui/ReasonBadge';
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
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoError, setVideoError] = useState(false);
  const [playedSeconds, setPlayedSeconds] = useState(0);

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
        .select(
          'id, started_at, duration_seconds, focus_score, timeline, focus_breakdown, alerts, video_path'
        )
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

  useEffect(() => {
    if (!session?.video_path) return undefined;

    let isMounted = true;

    // 공개 URL을 쓰지 않는다. 얼굴이 담긴 개인 데이터라 1시간짜리 서명 URL을 쓴다.
    supabase.storage
      .from(SESSION_VIDEO_BUCKET)
      .createSignedUrl(session.video_path, 3600)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error || !data?.signedUrl) {
          setVideoError(true);
          return;
        }
        setVideoUrl(data.signedUrl);
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

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

  const canSeek = Boolean(videoUrl);

  const seekTo = (seconds) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = seconds;
    // 정지 상태에서 눌렀으면 바로 보여주는 게 자연스럽다. 자동재생 정책으로
    // 막히면 사용자가 재생 버튼을 누르면 된다.
    el.play().catch(() => {});
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

      <main className="session-report__main fade-in-content">
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

            {session.video_path && (
              <section className="session-report__section">
                <h2 className="session-report__section-title">학습 영상</h2>
                {videoError ? (
                  <p className="session-report__video-error" role="status">
                    영상을 불러오지 못했습니다.
                  </p>
                ) : (
                  videoUrl && (
                    <video
                      ref={videoRef}
                      className="session-report__video"
                      src={videoUrl}
                      controls
                      preload="metadata"
                      onTimeUpdate={(event) =>
                        setPlayedSeconds(event.currentTarget.currentTime)
                      }
                    />
                  )
                )}
              </section>
            )}

            <div
              className="focus-chart"
              role={canSeek ? undefined : 'img'}
              aria-label={
                canSeek
                  ? undefined
                  : `시간대별 집중도 그래프. 종합 집중도 ${session.focus_score}%`
              }
            >
              <div className="focus-chart__track">
                {session.timeline.map((bucket, index) => {
                  const height = `${Math.round(bucket.focus_ratio * 100)}%`;
                  // 왼쪽부터 순차로 자라도록 순번을 CSS에 넘긴다.
                  const barStyle = { height, '--bar-index': index };
                  const isCurrent =
                    canSeek && Math.floor(playedSeconds / 60) === bucket.minute;
                  const className = `focus-chart__bar${
                    isCurrent ? ' focus-chart__bar--current' : ''
                  }`;

                  // 영상이 없으면 누를 수 없는 버튼을 만들지 않는다.
                  if (!canSeek) {
                    return (
                      <div key={bucket.minute} className={className} style={barStyle} />
                    );
                  }

                  return (
                    <button
                      key={bucket.minute}
                      type="button"
                      className={className}
                      style={barStyle}
                      onClick={() => seekTo(bucket.minute * 60)}
                      aria-label={`${bucket.minute}분대, 집중도 ${Math.round(
                        bucket.focus_ratio * 100
                      )}%, 이 지점부터 재생`}
                    />
                  );
                })}
              </div>
              {/* canSeek이면 위 role="img"가 빠져 이 숫자들이 그대로 낭독된다.
                  막대 버튼이 이미 "N분대"를 읽어주므로 중복이다. */}
              <div className="focus-chart__labels" aria-hidden="true">
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
                  {session.alerts.map((alert, index) => {
                    // 구버전 알림에는 offset_seconds가 없다. 그 행은 누를 수 없다.
                    const seekable =
                      canSeek && typeof alert.offset_seconds === 'number';

                    const body = (
                      <>
                        <span className="alert-log__time">
                          {formatClock(alert.started_at)}
                        </span>
                        <ReasonBadge reason={alert.reason} />
                        <span className="alert-log__duration">
                          {formatDuration(alert.duration_seconds)}
                        </span>
                      </>
                    );

                    return (
                      <li key={`${alert.started_at}-${index}`} className="alert-log__row">
                        {seekable ? (
                          <button
                            type="button"
                            className="alert-log__seek"
                            onClick={() => seekTo(alert.offset_seconds)}
                            aria-label={`${
                              REASON_LABELS[alert.reason] ?? alert.reason
                            }, ${formatDuration(alert.offset_seconds)} 지점부터 재생`}
                          >
                            {body}
                          </button>
                        ) : (
                          body
                        )}
                      </li>
                    );
                  })}
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
