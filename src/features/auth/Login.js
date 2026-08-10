import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/layout/NavBar';
import SignUp from './SignUp';
import supabase from '../../lib/supabaseClient';
import './Login.css';

export const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage('이메일 또는 비밀번호가 올바르지 않습니다.');
      return;
    }

    navigate('/mypage');
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

          <label className="login-card__label" htmlFor="login-email">
            이메일
          </label>
          <input
            id="login-email"
            className="login-card__input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="login-card__label" htmlFor="login-pw">
            비밀번호
          </label>
          <input
            id="login-pw"
            className="login-card__input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {errorMessage && (
            <p className="login-card__error" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            className="login-card__submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? '로그인 중...' : '로그인하기'}
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

      {isSignUpModalOpen && <SignUp closeSignUpModal={closeSignUpModal} />}
    </div>
  );
};

export default Login;
