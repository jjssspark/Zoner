import React, { useState, useEffect, useRef } from 'react';
import './SignUp.css';

const FOCUSABLE_SELECTOR =
  'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])';

const SignUp = ({ closeSignUpModal, setUserData }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeSignUpModal();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          FOCUSABLE_SELECTOR
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElement?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div
        className="signup-card"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-modal-title"
      >
        <button
          type="button"
          className="signup-card__close"
          aria-label="닫기"
          onClick={closeSignUpModal}
          ref={closeButtonRef}
        >
          &times;
        </button>

        <h2 id="signup-modal-title" className="signup-card__title">
          회원가입
        </h2>

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
