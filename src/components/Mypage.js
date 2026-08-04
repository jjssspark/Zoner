import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Mypage.css';

const QUICK_ACTIONS = [
  { label: 'AI 채팅', path: '/ai-chat' },
  { label: '학습 시작', path: '/start-learning' },
  { label: '학습 기록', path: '/save' },
  { label: '학습 리포트', path: '/save_report' },
  { label: '휴지통', path: '/trash' },
];

const RECOMMENDED = ['요금제 업그레이드', '개인 설정', '프로모션'];

export const Mypage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = location.state ? location.state.name : 'Guest';

  const [learningVideos, setLearningVideos] = useState([]);
  const [reportVideos, setReportVideos] = useState([]);

  const addLearningVideo = (video) => {
    setLearningVideos([...learningVideos, video]);
  };

  const addReportVideo = (video) => {
    setReportVideos([...reportVideos, video]);
  };

  return (
    <div className="mypage">
      <header className="mypage__topbar">
        <h1 className="mypage__user">{userName}</h1>
        <div className="mypage__topbar-actions">
          <button
            type="button"
            className="mypage__topbar-link"
            onClick={() => navigate('/')}
          >
            HOME
          </button>
          <button
            type="button"
            className="mypage__logout"
            onClick={() => navigate('/')}
          >
            LOGOUT
          </button>
        </div>
      </header>

      <main className="mypage__main">
        <section className="focus-gauge" aria-label="이번 주 집중도">
          <div className="focus-gauge__ring" style={{ '--focus-percent': 82 }}>
            <span className="focus-gauge__value">82%</span>
          </div>
          <div>
            <p className="focus-gauge__label">이번 주 평균 집중도</p>
            <p className="focus-gauge__desc">
              지난주보다 6%p 올랐어요. 좋은 흐름을 유지하고 있어요.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="recent-records-heading"
          className="record-section"
        >
          <h2 id="recent-records-heading" className="record-section__title">
            최근 기록
          </h2>
          <p className="record-section__desc">
            {learningVideos.length > 0
              ? `최근 학습 녹화 기록 열람 가능(${learningVideos.length}개)`
              : '업로드된 학습 녹화가 없습니다.'}
          </p>
          <div className="record-grid">
            {learningVideos.length > 0 ? (
              learningVideos.map((video, index) => (
                <div key={index} className="record-card">
                  {video}
                </div>
              ))
            ) : (
              <p className="record-grid__empty">학습 영상이 없습니다.</p>
            )}
          </div>
        </section>

        <section
          aria-labelledby="recent-reports-heading"
          className="record-section"
        >
          <h2 id="recent-reports-heading" className="record-section__title">
            최근 리포트
          </h2>
          <p className="record-section__desc">
            {reportVideos.length > 0
              ? `최근 학습 리포트 열람 가능(${reportVideos.length}개)`
              : '업로드된 리포트가 없습니다.'}
          </p>
          <div className="record-grid">
            {reportVideos.length > 0 ? (
              reportVideos.map((video, index) => (
                <div key={index} className="record-card">
                  {video}
                </div>
              ))
            ) : (
              <p className="record-grid__empty">리포트 영상이 없습니다.</p>
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
              <button
                key={action.path}
                type="button"
                className="quick-action"
                onClick={() => navigate(action.path)}
              >
                {action.label}
              </button>
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
              <div key={item} className="recommended-card">
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
