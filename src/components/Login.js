import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import SignUp from './SignUp'; // SignUp 모달 컴포넌트 import

export const Login = () => {
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false); // 회원가입 모달 상태

  // 회원가입 시 입력된 데이터 관리
  const [userData, setUserData] = useState({
    id: '',
    password: '',
    name: '', // 이름을 추가
  });

  const handleLogin = () => {
    if (id === userData.id && pw === userData.password) {
      // 로그인 성공 후 'Mypage'로 이동하며 이름도 전달
      navigate('/mypage', { state: { name: userData.name } });
    } else {
      alert('아이디 또는 비밀번호가 틀렸습니다.');
    }
  };

  const openSignUpModal = () => {
    setIsSignUpModalOpen(true); // 모달 열기
  };

  const closeSignUpModal = () => {
    setIsSignUpModalOpen(false); // 모달 닫기
  };

  return (
    <div className="L-screen">
      <div className="L-div">
        <div className="text-wrapper">ZONER</div>

        <div className="text-wrapper-2">로그인</div>

        <input
          className="rectangle"
          type="text"
          placeholder="아이디"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />

        <input
          className="rectangle-2"
          type="password"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />

        <div className="frame" onClick={handleLogin}>
          <div className="text-wrapper-3">로그인하기</div>
        </div>

        <div className="ZONER-wrapper">
          <button className="ZONER" onClick={() => navigate('/')}>
            Zoner
          </button>
        </div>

        <div className="USER-GUIDE-wrapper">
          <button className="text-wrapper-U" onClick={() => navigate('/guide')}>
            User Guide
          </button>
        </div>

        <div className="PRICING-wrapper">
          <button
            className="text-wrapper-U"
            onClick={() => navigate('/pricing')}
          >
            Pricing
          </button>
        </div>

        <div className="FAQ-wrapper">
          <button className="text-wrapper-U" onClick={() => navigate('/faq')}>
            Faq
          </button>
        </div>

        <p className="p">
          <span className="span">
            계정이 없으신가요?
            <br />
          </span>
          <button className="text-wrapper-5" onClick={openSignUpModal}>
            회원가입하기
          </button>
        </p>
      </div>

      {/* 회원가입 모달 */}
      {isSignUpModalOpen && (
        <SignUp closeSignUpModal={closeSignUpModal} setUserData={setUserData} />
      )}
    </div>
  );
};

export default Login;
