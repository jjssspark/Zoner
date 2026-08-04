import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Read.css';

export const Read = () => {
  const navigate = useNavigate();

  return (
    <div className="R-screen">
      <div className="R-div">
        <div className="frame">
          <div className="user-name">USER NAME</div>
        </div>

        <div className="div-wrapper">
          <div className="text-wrapper">웹캠</div>
        </div>

        <div className="overlap">
          <div className="frame-2" />

          <div className="overlap-group-wrapper">
            <div className="overlap-group">
              <button
                className="text-wrapper-2"
                onClick={() => navigate('/save')}
              >
                종료하기
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="overlap-wrapper">
        <div className="overlap-group">
          <div className="text-wrapper-2">학습 리포트 생성</div>
        </div>
      </div>
    </div>
  );
};
export default Read;
