import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Read.css';

export const Trashread = () => {
  const navigate = useNavigate();

  return (
    <div className="R-screen">
      <div className="R-div">
        <div className="frame">
          <div className="user-name">tina</div>
        </div>

        <div className="div-wrapper">
          <div className="text-wrapper">삭제한 항목</div>
        </div>

        <div className="overlap">
          <div className="frame-2" />

          <div className="overlap-group-wrapper">
            <div className="overlap-group">
              <button
                className="text-wrapper-2"
                onClick={() => navigate('/trash')}
              >
                복구
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="overlap-wrapper">
        <div className="overlap-group">
          <div className="text-wrapper-2">영구삭제</div>
        </div>
      </div>
    </div>
  );
};
export default Trashread;
