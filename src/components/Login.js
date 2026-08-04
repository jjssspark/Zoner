import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import SignUp from './SignUp';
import './Login.css';

export const Login = () => {
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);

  const [userData, setUserData] = useState({
    id: '',
    password: '',
    name: '',
  });

  const handleLogin = (e) => {
    e.preventDefault();
    if (id === userData.id && pw === userData.password) {
      navigate('/mypage', { state: { name: userData.name } });
    } else {
      setErrorMessage('아이디 또는 비밀번호가 틀렸습니다.');
    }
  };

  const openSignUpModal = () => {
    setIsSignUpModalOpen(true);
  };

  const closeSignUpModal = () => {
    setIsSignUpModalOpen(false);
  };

  return (
    <div className="login">
      <NavBar />

      <main className="login__main">
        <form className="login-card" onSubmit={handleLogin}>
          <h1 className="login-card__title">로그인</h1>

          <label className="login-card__label" htmlFor="login-id">
            아이디
          </label>
          <input
            id="login-id"
            className="login-card__input"
            type="text"
            autoComplete="username"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />

          <label className="login-card__label" htmlFor="login-pw">
            비밀번호
          </label>
          <input
            id="login-pw"
            className="login-card__input"
            type="password"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />

          {errorMessage && (
            <p className="login-card__error" role="alert">
              {errorMessage}
            </p>
          )}

          <button type="submit" className="login-card__submit">
            로그인하기
          </button>

          <p className="login-card__signup">
            계정이 없으신가요?{' '}
            <button
              type="button"
              className="login-card__signup-link"
              onClick={openSignUpModal}
            >
              회원가입하기
            </button>
          </p>
        </form>
      </main>

      {isSignUpModalOpen && (
        <SignUp
          closeSignUpModal={closeSignUpModal}
          setUserData={setUserData}
        />
      )}
    </div>
  );
};

export default Login;
