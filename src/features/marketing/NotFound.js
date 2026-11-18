// src/features/marketing/NotFound.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotFound.css';

// 어떤 라우트에도 걸리지 않은 주소. 이게 없으면 Routes가 아무것도 그리지
// 않아서 빈 화면이 남는다 — 오타 하나로 앱이 죽은 것처럼 보인다.
export const NotFound = () => {
  const navigate = useNavigate();

  return (
    <main className="not-found">
      <div className="not-found__panel">
        <p className="not-found__code">404</p>
        <h1 className="not-found__title">없는 주소입니다</h1>
        <p className="not-found__description">
          주소가 바뀌었거나 잘못 입력됐습니다.
        </p>
        <div className="not-found__actions">
          <button type="button" className="not-found__home" onClick={() => navigate('/')}>
            홈으로
          </button>
          <button type="button" className="not-found__back" onClick={() => navigate(-1)}>
            뒤로가기
          </button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
