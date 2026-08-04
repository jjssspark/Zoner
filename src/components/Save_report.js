import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Save.css';

export const Save_report = () => {
  const navigate = useNavigate();
  return (
    <div className="S-screen">
      <div className="S-div">
        <div className="frame">
          <div className="text-wrapper">학습 리포트</div>

          <button className="rectangle" onClick={() => navigate('/report_a')} />

          <div className="rectangle-2" />

          <div className="rectangle-3" />

          <div className="rectangle-4" />

          <div className="rectangle-5" />

          <div className="rectangle-6" />

          <div className="rectangle-7" />

          <div className="rectangle-8" />

          <div className="rectangle-9" />
        </div>

        <div className="h-ome-wrapper">
          <button
            className="text-wrapper-3"
            onClick={() => navigate('/mypage')}
          >
            HOME
          </button>
        </div>

        <div className="frame-5">
          <button className="text-wrapper-3">AI 채팅</button>
        </div>

        <div className="frame-6">
          <button className="text-wrapper-3">학습 시작</button>
        </div>

        <div className="frame-7">
          <button className="text-wrapper-3" onClick={() => navigate('/save')}>
            학습 기록
          </button>
        </div>

        <div className="frame-8">
          <button className="text-wrapper-3">학습 리포트</button>
        </div>

        <div className="frame-9">
          <button className="text-wrapper-3" onClick={() => navigate('/trash')}>
            휴지통
          </button>
        </div>

        <div className="user-name-wrapper">
          <div className="user-name">Jisu</div>
        </div>

        <div className="logout-wrapper">
          <div className="logout" onClick={() => navigate('/')}>
            LOGOUT
          </div>
        </div>
      </div>
    </div>
  );
};
export default Save_report;
