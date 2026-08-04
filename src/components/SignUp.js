import React, { useState } from 'react';
import './SignUp.css';

const SignUp = ({ closeSignUpModal, setUserData }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    alert('회원가입이 완료되었습니다. 다시 로그인해주세요.');

    setUserData({
      id: email,
      password: password,
      name: name,
    });

    closeSignUpModal();
  };

  return (
    <div className="signup-overlay">
      <div className="signup-card">
        <button
          type="button"
          className="signup-card__close"
          aria-label="닫기"
          onClick={closeSignUpModal}
        >
          &times;
        </button>

        <h2 className="signup-card__title">회원가입</h2>

        <form onSubmit={handleSubmit}>
          <label className="signup-card__label" htmlFor="signup-name">
            이름
          </label>
          <input
            id="signup-name"
            className="signup-card__input"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="signup-card__label" htmlFor="signup-email">
            이메일
          </label>
          <input
            id="signup-email"
            className="signup-card__input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="signup-card__label" htmlFor="signup-password">
            비밀번호
          </label>
          <input
            id="signup-password"
            className="signup-card__input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label className="signup-card__label" htmlFor="signup-confirm">
            비밀번호 확인
          </label>
          <input
            id="signup-confirm"
            className="signup-card__input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <button type="submit" className="signup-card__submit">
            회원가입
          </button>
        </form>

        <p className="signup-card__login">
          이미 계정이 있으신가요?{' '}
          <button
            type="button"
            className="signup-card__login-link"
            onClick={closeSignUpModal}
          >
            로그인
          </button>
        </p>
      </div>
    </div>
  );
};

export default SignUp;
