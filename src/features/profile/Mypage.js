import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../../lib/supabaseClient';
import ScoreRing from '../../components/ui/ScoreRing';
import { focusLevel } from '../../lib/focusLevel';
import Skeleton from '../../components/ui/Skeleton';
import { buildQuickActionMeta } from '../../lib/quickActions';
import './Mypage.css';

const QUICK_ACTIONS = [
  { label: 'AI 채팅', path: '/ai-chat', icon: '◈', metaKey: null, staticMeta: '학습 도우미와 대화' },
  { label: '학습 시작', path: '/start-learning', icon: '▶', metaKey: 'startLearning', staticMeta: null },
  { label: '학습 기록', path: '/save', icon: '◉', metaKey: 'records', staticMeta: null },
  { label: '휴지통', path: '/trash', icon: '⌦', metaKey: null, staticMeta: '삭제한 기록 복구' },
];

const RECOMMENDED = ['요금제 업그레이드', '개인 설정', '프로모션'];

// 장식 요소(스캔 라인·아이콘)는 aria-hidden으로 빼고, 보조 문구는 aria-label에
// 합성해 넣는다. 그러지 않으면 스크린리더가 라벨과 수치를 별개 조각으로 읽는다.
function QuickActionTile({ action, meta, onSelect }) {
  const metaText = action.staticMeta || (meta ? meta.text : '');
  const level = meta ? meta.level : null;
  const metaClass = level
    ? `quick-action__meta quick-action__meta--${level}`
    : 'quick-action__meta';

  return (
    <button
      type="button"
      className="quick-action fade-in-content"
      onClick={onSelect}
      aria-label={metaText ? `${action.label}, ${metaText}` : action.label}
    >
      <span className="quick-action__scan" aria-hidden="true" />
      <span className="quick-action__icon" aria-hidden="true">
        {action.icon}
      </span>
      <span className="quick-action__label">{action.label}</span>
      {metaText && <span className={metaClass}>{metaText}</span>}
    </button>
  );
}

// 로딩 중에도 동일한 마크업을 렌더해야 데이터 로드 완료 시 헤더가 나타나며
// 레이아웃이 밀리지 않는다 (userName은 로딩 중 빈 문자열일 뿐 구조는 동일).
function MypageTopbar({ userName, onBack, onHome, onLogout }) {
  return (
    <header className="mypage__topbar">
      <div className="mypage__identity">
        <h1 className="mypage__user">
          {userName || '내 정보'}
          <span className="mypage__status-dot" aria-hidden="true" />
        </h1>
        <span className="mypage__badge">AI 학습 보조</span>
      </div>
      <div className="mypage__topbar-actions">
        <button type="button" className="mypage__topbar-link" onClick={onBack}>
          뒤로가기
        </button>
        <button type="button" className="mypage__topbar-link" onClick={onHome}>
          HOME
        </button>
        <button type="button" className="mypage__logout" onClick={onLogout}>
          LOGOUT
        </button>
      </div>
    </header>
  );
}

export const Mypage = () => {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [recentSessions, setRecentSessions] = useState([]);
  const [totalSessions, setTotalSessions] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          navigate('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();

        const { data: sessions, count: sessionCount } = await supabase
          .from('active_study_sessions')
          .select('id, started_at, focus_score', { count: 'exact' })
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(3);

        if (isMounted) {
          setUserName(profile ? profile.name : 'Guest');
          setRecentSessions(sessions || []);
          setTotalSessions(typeof sessionCount === 'number' ? sessionCount : null);
        }
      } catch (error) {
        console.error('Mypage: failed to load user data', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return undefined;

    const handlePointerMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      el.style.setProperty('--spotlight-x', `${x}%`);
      el.style.setProperty('--spotlight-y', `${y}%`);
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  if (isLoading) {
    return (
      <div className="mypage" ref={pageRef}>
        <MypageTopbar
          userName={userName}
          onBack={() => navigate(-1)}
          onHome={() => navigate('/')}
          onLogout={handleLogout}
        />
        <main className="mypage__main">
          <Skeleton variant="metric" count={1} />
          <Skeleton variant="card" count={3} announce={false} />
        </main>
      </div>
    );
  }

  const hasSessions = recentSessions.length > 0;
  const summaryScore = hasSessions
    ? Math.round(
        recentSessions.reduce((sum, session) => sum + session.focus_score, 0) /
          recentSessions.length
      )
    : 0;
  const maxScore = hasSessions
    ? Math.max(...recentSessions.map((session) => session.focus_score))
    : 0;
  const quickActionMeta = buildQuickActionMeta(recentSessions, totalSessions);

  return (
    <div className="mypage" ref={pageRef}>
      <MypageTopbar
        userName={userName}
        onBack={() => navigate(-1)}
        onHome={() => navigate('/')}
        onLogout={handleLogout}
      />

      <main className="mypage__main">
        <section
          className="focus-gauge"
          aria-labelledby="focus-summary-heading"
        >
          <h2 id="focus-summary-heading" className="sr-only">
            집중도 요약
          </h2>
          {hasSessions ? (
            <div className="focus-gauge__summary">
              <ScoreRing value={summaryScore} size="lg" label="평균" />
              <dl className="focus-gauge__stats">
                <div>
                  <dt>세션</dt>
                  <dd className="focus-gauge__stat-value">
                    {recentSessions.length}
                  </dd>
                </div>
                <div>
                  <dt>최고 점수</dt>
                  <dd className="focus-gauge__stat-value">{maxScore}%</dd>
                </div>
              </dl>
            </div>
          ) : (
            <>
              <div className="focus-gauge__scanner" aria-hidden="true">
                <span className="focus-gauge__scanner-ring" />
                <span className="focus-gauge__scanner-core" />
              </div>
              <div>
                <p className="focus-gauge__empty-title">
                  AI 학습 도우미가 대기 중입니다
                </p>
                <p className="focus-gauge__empty-desc">
                  학습을 시작하면 AI가 집중도를 분석해서 여기에 보여드려요.
                </p>
              </div>
            </>
          )}
        </section>

        <section
          aria-labelledby="recent-records-heading"
          className="record-section"
        >
          <div className="record-section__header">
            <div>
              <h2 id="recent-records-heading" className="record-section__title">
                최근 기록
              </h2>
              <p className="record-section__desc">
                {recentSessions.length > 0
                  ? `최근 학습 세션 ${recentSessions.length}개`
                  : '아직 학습 세션이 없습니다.'}
              </p>
            </div>
            <button
              type="button"
              className="record-section__link"
              onClick={() => navigate('/save')}
            >
              <span>전체 기록 보기</span>
              <span className="record-section__arrow" aria-hidden="true">
                →
              </span>
            </button>
          </div>
          <div className="record-grid">
            {recentSessions.length > 0 ? (
              recentSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className="record-card fade-in-content"
                  onClick={() => navigate(`/read?session=${session.id}`)}
                >
                  <span className="record-card__date">
                    {new Date(session.started_at).toLocaleDateString('ko-KR')}
                  </span>
                  <span
                    className={`record-card__score record-card__score--${focusLevel(
                      session.focus_score
                    )}`}
                  >
                    {session.focus_score}%
                  </span>
                </button>
              ))
            ) : (
              <p className="record-grid__empty">학습 세션이 없습니다.</p>
            )}
          </div>
        </section>

        <section
          aria-labelledby="quick-actions-heading"
          className="quick-actions"
        >
          <h2 id="quick-actions-heading" className="record-section__title">
            빠른 실행
          </h2>
          <div className="quick-actions__grid">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionTile
                key={action.path}
                action={action}
                meta={action.metaKey ? quickActionMeta[action.metaKey] : null}
                onSelect={() => navigate(action.path)}
              />
            ))}
          </div>
        </section>

        <section
          aria-labelledby="recommended-heading"
          className="record-section"
        >
          <h2 id="recommended-heading" className="record-section__title">
            추천 서비스
          </h2>
          <div className="recommended-list">
            {RECOMMENDED.map((item) => (
              <div
                key={item}
                className="recommended-card fade-in-content"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Mypage;
