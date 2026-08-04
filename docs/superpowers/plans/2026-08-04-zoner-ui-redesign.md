# Zoner UI 리디자인 (Home/Login/SignUp/Mypage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home, Login, SignUp, Mypage 4개 페이지를 "다크 테크 대시보드" 톤(시안 강조색)의 반응형·접근성 준수 UI로 재작성한다.

**Architecture:** 기존 React 상태/라우팅 로직은 그대로 두고, 절대좌표(`position: absolute`, 1440px 고정) 마크업을 flexbox/grid 기반 시맨틱 마크업 + CSS 커스텀 프로퍼티 토큰으로 교체한다. Home/Login이 공유하는 로고+메뉴 블록은 신규 `NavBar` 컴포넌트로 추출한다.

**Tech Stack:** React 19, react-router-dom 7, Create React App (react-scripts 5), plain CSS (커스텀 프로퍼티, 신규 라이브러리 없음).

## Global Constraints

- 신규 npm 의존성 추가 금지 (폰트 `<link>` 태그 예외)
- 기존 상태·라우팅·비즈니스 로직 변경 금지 — 마크업/CSS만 교체. 단, 로그인 에러 표시를 `alert()` → 인라인 `role="alert"` 메시지로 바꾸는 것은 스펙에 명시된 예외
- 색상은 항상 `src/styles/tokens.css`의 CSS 커스텀 프로퍼티만 참조, 컴포넌트 CSS에 색상 리터럴 하드코딩 금지
- 반응형 브레이크포인트: 320px~1440px, `max-width: 767px` 기준 모바일 분기
- 모든 인터랙티브 요소는 `<button>`/`<a>` (기존 `<div onClick>`, `<span onClick>` 금지)
- `:focus-visible` 스타일을 모든 클릭 가능 요소에 적용, `outline: none` 단독 사용 금지
- `prefers-reduced-motion`은 `tokens.css`에서 전역 처리 (컴포넌트별 중복 처리 불필요)
- Save, Read, Report_a, Save_report, Trash, Trashread, Pricing, FAQ, UserGuide는 이번 계획 범위 밖 — 건드리지 않음

---

## Task 1: 디자인 토큰 + 전역 베이스 설정

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/index.css` (전체 교체)
- Modify: `src/App.js:1-5` (import 추가)
- Modify: `public/index.html:1-27` (lang, title, meta, 폰트 링크)

**Interfaces:**
- Produces: 이후 모든 작업이 참조하는 CSS 커스텀 프로퍼티 — `--color-bg`, `--color-surface`, `--color-surface-alt`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-hover`, `--color-danger`, `--font-sans`, `--font-display`, `--text-xs`..`--text-hero`, `--space-1`..`--space-16`, `--space-section`, `--radius-sm/md/lg/full`, `--shadow-sm/md/glow`, `--duration-fast/normal`, `--ease-out-expo`, `--navy-950`

- [ ] **Step 1: `src/styles/tokens.css` 작성**

```css
:root {
  /* primitive - neutrals (dark navy scale) */
  --navy-950: oklch(15% 0.02 260);
  --navy-900: oklch(19% 0.02 260);
  --navy-800: oklch(24% 0.02 260);
  --navy-700: oklch(30% 0.02 260);
  --navy-600: oklch(38% 0.02 260);
  --navy-400: oklch(60% 0.02 260);
  --navy-200: oklch(85% 0.01 260);
  --navy-50: oklch(97% 0.005 260);

  /* primitive - accent (cyan) */
  --cyan-300: oklch(85% 0.12 200);
  --cyan-400: oklch(75% 0.14 200);
  --cyan-500: oklch(68% 0.15 200);

  /* primitive - status */
  --red-500: oklch(60% 0.2 25);

  /* semantic */
  --color-bg: var(--navy-950);
  --color-surface: var(--navy-900);
  --color-surface-alt: var(--navy-800);
  --color-border: var(--navy-700);
  --color-text: var(--navy-50);
  --color-text-muted: var(--navy-400);
  --color-accent: var(--cyan-400);
  --color-accent-hover: var(--cyan-300);
  --color-danger: var(--red-500);

  /* typography (Pretendard covers both display and body — one font family) */
  --font-sans: 'Pretendard Variable', 'Pretendard', system-ui, sans-serif;
  --font-display: 'Pretendard Variable', 'Pretendard', system-ui, sans-serif;

  --text-xs: clamp(0.75rem, 0.73rem + 0.1vw, 0.813rem);
  --text-sm: clamp(0.875rem, 0.85rem + 0.12vw, 0.938rem);
  --text-base: clamp(1rem, 0.92rem + 0.4vw, 1.125rem);
  --text-lg: clamp(1.125rem, 1.02rem + 0.52vw, 1.375rem);
  --text-xl: clamp(1.5rem, 1.25rem + 1.25vw, 2rem);
  --text-2xl: clamp(2rem, 1.5rem + 2.5vw, 3rem);
  --text-hero: clamp(2.5rem, 1.5rem + 5vw, 4.5rem);

  --leading-tight: 1.15;
  --leading-body: 1.6;

  /* spacing (4px scale) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-section: clamp(3rem, 2rem + 5vw, 8rem);

  /* radius / shadow */
  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1.25rem;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.3);
  --shadow-md: 0 8px 24px oklch(0% 0 0 / 0.35);
  --shadow-glow: 0 0 40px oklch(68% 0.15 200 / 0.25);

  /* motion */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: `src/index.css` 전체 교체**

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
```

- [ ] **Step 3: `src/App.js`에 토큰 import 추가**

`src/App.js` 3번째 줄(`/* eslint-disable react/jsx-pascal-case */`) 바로 아래에 추가:

```js
import './styles/tokens.css';
```

변경 후 파일 상단은 다음과 같아야 함:

```js
// src/App.js

/* eslint-disable react/jsx-pascal-case */
import './styles/tokens.css';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
```

- [ ] **Step 4: `public/index.html` 수정**

전체를 다음으로 교체:

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0b0f17" />
    <meta
      name="description"
      content="Zoner — AI가 학습 집중도를 분석해주는 학습 서비스"
    />
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css"
    />
    <title>Zoner</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
```

- [ ] **Step 5: 빌드로 컴파일 확인**

Run: `cd /Users/tina/Project/Zoner/zoner && npm run build`
Expected: 출력에 `Compiled successfully.` 포함, non-zero exit 없음 (기존 eslint 경고 — Report_a/Save_report PascalCase, Home/UserGuide alt 속성, Mypage 미사용 변수 — 는 그대로 남아있어도 OK, 이번 작업 범위 밖)

- [ ] **Step 6: 구조 확인**

Run: `grep -q 'lang="ko"' public/index.html && grep -q '<title>Zoner</title>' public/index.html && grep -q "styles/tokens.css" src/App.js && echo OK`
Expected: `OK` 출력

- [ ] **Step 7: Commit**

```bash
cd /Users/tina/Project/Zoner/zoner
git add src/styles/tokens.css src/index.css src/App.js public/index.html
git commit -m "feat: add design tokens and dark theme base"
```

---

## Task 2: NavBar 공용 컴포넌트 + Home 페이지 재작성

**Files:**
- Create: `src/components/NavBar.js`
- Create: `src/components/NavBar.css`
- Modify: `src/components/Home.js` (전체 교체)
- Modify: `src/components/Home.css` (전체 교체)

**Interfaces:**
- Consumes: Task 1의 토큰 (`--color-bg`, `--color-accent` 등)
- Produces: `NavBar` — `export default function NavBar()`, props 없음, 내부에서 `useNavigate()` 사용. Home/Login에서 `import NavBar from './NavBar'`로 사용.

- [ ] **Step 1: `src/components/NavBar.js` 작성**

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './NavBar.css';

const NAV_LINKS = [
  { label: 'User Guide', path: '/guide' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'FAQ', path: '/faq' },
];

export const NavBar = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="navbar">
      <button
        type="button"
        className="navbar__logo"
        onClick={() => navigate('/')}
      >
        ZONER
      </button>

      <button
        type="button"
        className="navbar__toggle"
        aria-expanded={isMenuOpen}
        aria-controls="navbar-menu"
        aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
        onClick={() => setIsMenuOpen((open) => !open)}
      >
        <span aria-hidden="true">{isMenuOpen ? '✕' : '☰'}</span>
      </button>

      <nav
        id="navbar-menu"
        className={`navbar__menu ${isMenuOpen ? 'navbar__menu--open' : ''}`}
        aria-label="주 메뉴"
      >
        {NAV_LINKS.map((link) => (
          <button
            key={link.path}
            type="button"
            className="navbar__link"
            onClick={() => {
              setIsMenuOpen(false);
              navigate(link.path);
            }}
          >
            {link.label}
          </button>
        ))}
      </nav>
    </header>
  );
};

export default NavBar;
```

- [ ] **Step 2: `src/components/NavBar.css` 작성**

```css
.navbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  background-color: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}

.navbar__logo {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--text-lg);
  letter-spacing: 0.04em;
  padding: var(--space-2);
}

.navbar__logo:hover {
  color: var(--color-accent);
}

.navbar__toggle {
  display: none;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-lg);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
}

.navbar__menu {
  display: flex;
  gap: var(--space-2);
}

.navbar__link {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  transition: background-color var(--duration-fast) var(--ease-out-expo),
    color var(--duration-fast) var(--ease-out-expo);
}

.navbar__link:hover {
  color: var(--color-text);
  background-color: var(--color-surface-alt);
}

.navbar__link:focus-visible,
.navbar__logo:focus-visible,
.navbar__toggle:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

@media (max-width: 767px) {
  .navbar__toggle {
    display: block;
  }

  .navbar__menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    background-color: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    padding: var(--space-2);
    display: none;
  }

  .navbar__menu--open {
    display: flex;
  }
}
```

- [ ] **Step 3: `src/components/Home.js` 전체 교체**

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import image1 from './image-1.png';
import image2 from './image-2.png';
import image3 from './image-3.png';
import image4 from './image-4.png';
import './Home.css';

const FEATURES = [
  {
    icon: '◉',
    title: '집중도 분석',
    desc: 'AI가 학습 영상을 분석해 집중 구간과 흐트러진 구간을 실시간으로 짚어줍니다.',
  },
  {
    icon: '✧',
    title: 'AI 리포트',
    desc: '학습이 끝나면 요약 리포트를 자동으로 생성해 다음 학습 계획을 도와줍니다.',
  },
  {
    icon: '⏱',
    title: '학습 기록',
    desc: '모든 학습 세션을 저장하고 언제든 다시 돌아볼 수 있습니다.',
  },
];

export const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home">
      <NavBar />

      <section className="home__hero">
        <div className="home__hero-text">
          <p className="home__eyebrow">Zoner : 학습에 혁신을 더하다</p>
          <h1 className="home__headline">
            Focus Smarter, <br />
            Learn Better
          </h1>
          <button
            type="button"
            className="home__cta"
            onClick={() => navigate('/login')}
          >
            시작하기
          </button>
        </div>
        <img className="home__hero-image" alt="" src={image1} />
      </section>

      <section className="home__features" aria-label="주요 기능">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="feature-card">
            <span className="feature-card__icon" aria-hidden="true">
              {feature.icon}
            </span>
            <h2 className="feature-card__title">{feature.title}</h2>
            <p className="feature-card__desc">{feature.desc}</p>
          </article>
        ))}
      </section>

      <section className="home__vision" aria-labelledby="vision-heading">
        <h2 id="vision-heading" className="home__vision-title">
          Our Vision
        </h2>
        <div className="home__vision-gallery">
          <img alt="" src={image2} />
          <img alt="" src={image3} />
          <img alt="" src={image4} />
        </div>
      </section>

      <p className="home__watermark" aria-hidden="true">
        ZONER
      </p>
    </div>
  );
};

export default Home;
```

- [ ] **Step 4: `src/components/Home.css` 전체 교체**

```css
.home {
  min-height: 100vh;
  background: radial-gradient(
      ellipse 800px 500px at 80% -10%,
      oklch(75% 0.14 200 / 0.18),
      transparent
    ),
    var(--color-bg);
  color: var(--color-text);
}

.home__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding: var(--space-section) var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
  flex-wrap: wrap;
}

.home__hero-text {
  flex: 1 1 380px;
}

.home__eyebrow {
  color: var(--color-accent);
  font-size: var(--text-sm);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 var(--space-4);
}

.home__headline {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--text-hero);
  line-height: var(--leading-tight);
  margin: 0 0 var(--space-8);
}

.home__cta {
  background-color: var(--color-accent);
  color: var(--navy-950);
  border: none;
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: var(--text-base);
  padding: var(--space-4) var(--space-8);
  cursor: pointer;
  box-shadow: var(--shadow-glow);
  transition: transform var(--duration-fast) var(--ease-out-expo),
    background-color var(--duration-fast) var(--ease-out-expo);
}

.home__cta:hover {
  background-color: var(--color-accent-hover);
  transform: translateY(-2px);
}

.home__cta:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}

.home__hero-image {
  flex: 1 1 320px;
  max-width: 480px;
  width: 100%;
  height: auto;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.home__features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-6) var(--space-section);
}

.feature-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  transition: transform var(--duration-normal) var(--ease-out-expo),
    border-color var(--duration-normal) var(--ease-out-expo);
}

.feature-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-accent);
}

.feature-card__icon {
  display: inline-block;
  font-size: var(--text-xl);
  color: var(--color-accent);
  margin-bottom: var(--space-4);
}

.feature-card__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  margin: 0 0 var(--space-2);
}

.feature-card__desc {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-body);
  margin: 0;
}

.home__vision {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-6) var(--space-section);
}

.home__vision-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  margin: 0 0 var(--space-6);
}

.home__vision-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}

.home__vision-gallery img {
  width: 100%;
  height: 320px;
  object-fit: cover;
  border-radius: var(--radius-lg);
}

.home__watermark {
  text-align: center;
  font-family: var(--font-display);
  font-weight: 900;
  font-size: clamp(3rem, 15vw, 12rem);
  letter-spacing: 0.05em;
  color: oklch(97% 0.005 260 / 0.08);
  margin: 0;
  padding-bottom: var(--space-8);
  animation: home-watermark-pulse 10s infinite;
}

@keyframes home-watermark-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

@media (max-width: 767px) {
  .home__hero {
    padding: var(--space-12) var(--space-4);
  }

  .home__headline {
    font-size: var(--text-2xl);
  }
}
```

- [ ] **Step 5: 빌드로 컴파일 확인**

Run: `cd /Users/tina/Project/Zoner/zoner && npm run build`
Expected: `Compiled successfully.`

- [ ] **Step 6: Commit**

```bash
cd /Users/tina/Project/Zoner/zoner
git add src/components/NavBar.js src/components/NavBar.css src/components/Home.js src/components/Home.css
git commit -m "feat: add NavBar component and redesign Home page"
```

---

## Task 3: Login 페이지 재작성

**Files:**
- Modify: `src/components/Login.js` (전체 교체)
- Modify: `src/components/Login.css` (전체 교체)

**Interfaces:**
- Consumes: `NavBar` (Task 2), 토큰 (Task 1)
- 기존 로직 유지: `id`/`pw`/`userData`/`isSignUpModalOpen` state, `handleLogin` 검증 규칙, `openSignUpModal`/`closeSignUpModal`
- 변경: 실패 시 `alert()` 대신 `errorMessage` state로 인라인 표시 (스펙에 명시된 예외)

- [ ] **Step 1: `src/components/Login.js` 전체 교체**

```jsx
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
```

- [ ] **Step 2: `src/components/Login.css` 전체 교체**

```css
.login {
  min-height: 100vh;
  background: radial-gradient(
      ellipse 700px 400px at 20% 0%,
      oklch(75% 0.14 200 / 0.15),
      transparent
    ),
    var(--color-bg);
  color: var(--color-text);
}

.login__main {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 72px);
  padding: var(--space-6);
}

.login-card {
  width: 100%;
  max-width: 420px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
}

.login-card__title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  margin: 0 0 var(--space-6);
}

.login-card__label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.login-card__input {
  background-color: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-base);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
}

.login-card__input:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
  border-color: var(--color-accent);
}

.login-card__error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-4);
}

.login-card__submit {
  background-color: var(--color-accent);
  color: var(--navy-950);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: var(--text-base);
  padding: var(--space-3);
  cursor: pointer;
  margin-top: var(--space-2);
  transition: background-color var(--duration-fast) var(--ease-out-expo);
}

.login-card__submit:hover {
  background-color: var(--color-accent-hover);
}

.login-card__submit:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.login-card__signup {
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin: var(--space-6) 0 0;
}

.login-card__signup-link {
  background: none;
  border: none;
  color: var(--color-accent);
  text-decoration: underline;
  cursor: pointer;
  font-size: inherit;
  padding: 0;
}
```

- [ ] **Step 3: 빌드로 컴파일 확인**

Run: `cd /Users/tina/Project/Zoner/zoner && npm run build`
Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
cd /Users/tina/Project/Zoner/zoner
git add src/components/Login.js src/components/Login.css
git commit -m "feat: redesign Login page with dark theme card"
```

---

## Task 4: SignUp 모달 재작성

**Files:**
- Modify: `src/components/SignUp.js` (전체 교체)
- Modify: `src/components/SignUp.css` (전체 교체)

**Interfaces:**
- Consumes: 토큰 (Task 1). props는 기존과 동일 — `{ closeSignUpModal, setUserData }`
- 기존 로직 100% 유지: `handleSubmit`의 `alert()` 기반 검증 흐름은 그대로 둔다 (스펙 범위 밖). 접근성 개선만 적용: `<span onClick>` → `<button>`, `<div onClick>` 닫기 아이콘 → `<button aria-label="닫기">`, 모든 입력에 `<label>` 추가.

- [ ] **Step 1: `src/components/SignUp.js` 전체 교체**

```jsx
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
```

- [ ] **Step 2: `src/components/SignUp.css` 전체 교체**

```css
.signup-overlay {
  position: fixed;
  inset: 0;
  background-color: oklch(0% 0 0 / 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: signup-fade-in var(--duration-normal) var(--ease-out-expo);
}

.signup-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  margin: var(--space-4);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-8);
  color: var(--color-text);
  animation: signup-slide-up var(--duration-normal) var(--ease-out-expo);
}

@keyframes signup-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes signup-slide-up {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.signup-card__close {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--text-xl);
  line-height: 1;
  cursor: pointer;
  padding: var(--space-1);
}

.signup-card__close:hover {
  color: var(--color-text);
}

.signup-card__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  margin: 0 0 var(--space-6);
}

.signup-card__label {
  display: block;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.signup-card__input {
  width: 100%;
  background-color: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-base);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
  box-sizing: border-box;
}

.signup-card__input:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
  border-color: var(--color-accent);
}

.signup-card__submit {
  width: 100%;
  background-color: var(--color-accent);
  color: var(--navy-950);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: var(--text-base);
  padding: var(--space-3);
  cursor: pointer;
}

.signup-card__submit:hover {
  background-color: var(--color-accent-hover);
}

.signup-card__submit:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.signup-card__login {
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin: var(--space-6) 0 0;
}

.signup-card__login-link {
  background: none;
  border: none;
  color: var(--color-accent);
  text-decoration: underline;
  cursor: pointer;
  font-size: inherit;
  padding: 0;
}
```

- [ ] **Step 3: 빌드로 컴파일 확인**

Run: `cd /Users/tina/Project/Zoner/zoner && npm run build`
Expected: `Compiled successfully.`

- [ ] **Step 4: `icon.png`가 더 이상 SignUp에서 쓰이지 않는지 확인**

Run: `grep -r "icon.png" src/components/SignUp.js || echo "unused import removed OK"`
Expected: `unused import removed OK`

- [ ] **Step 5: Commit**

```bash
cd /Users/tina/Project/Zoner/zoner
git add src/components/SignUp.js src/components/SignUp.css
git commit -m "feat: restyle SignUp modal and fix interactive element semantics"
```

---

## Task 5: Mypage 재작성

**Files:**
- Modify: `src/components/Mypage.js` (전체 교체)
- Modify: `src/components/Mypage.css` (전체 교체)

**Interfaces:**
- Consumes: 토큰 (Task 1)
- 기존 로직 유지: `useLocation`으로 전달받는 `userName`, `learningVideos`/`reportVideos` state와 `addLearningVideo`/`addReportVideo` 함수(기존에도 미사용이었음 — 이번 작업에서 제거하지 않음)

- [ ] **Step 1: `src/components/Mypage.js` 전체 교체**

```jsx
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
        <span className="mypage__user">{userName}</span>
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
```

- [ ] **Step 2: `src/components/Mypage.css` 전체 교체**

```css
.mypage {
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.mypage__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.mypage__user {
  font-family: var(--font-display);
  font-weight: 700;
}

.mypage__topbar-actions {
  display: flex;
  gap: var(--space-3);
}

.mypage__topbar-link,
.mypage__logout {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.mypage__topbar-link:hover,
.mypage__logout:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.mypage__topbar-link:focus-visible,
.mypage__logout:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.mypage__main {
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.focus-gauge {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  margin-bottom: var(--space-8);
  flex-wrap: wrap;
}

.focus-gauge__ring {
  --focus-percent: 0;
  width: 120px;
  height: 120px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: conic-gradient(
    var(--color-accent) calc(var(--focus-percent) * 1%),
    var(--color-surface-alt) 0
  );
}

.focus-gauge__value {
  width: 92px;
  height: 92px;
  border-radius: var(--radius-full);
  background-color: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--color-accent);
}

.focus-gauge__label {
  font-weight: 700;
  margin: 0 0 var(--space-1);
}

.focus-gauge__desc {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin: 0;
}

.record-section {
  margin-bottom: var(--space-8);
}

.record-section__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  margin: 0 0 var(--space-2);
}

.record-section__desc {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-4);
}

.record-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}

.record-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.record-grid__empty {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  grid-column: 1 / -1;
}

.quick-actions {
  margin-bottom: var(--space-8);
}

.quick-actions__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-4);
}

.quick-action {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: 600;
  padding: var(--space-6) var(--space-4);
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-out-expo),
    transform var(--duration-fast) var(--ease-out-expo);
}

.quick-action:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.quick-action:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.recommended-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.recommended-card {
  background-color: var(--color-surface-alt);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  text-align: center;
  font-size: var(--text-sm);
}

@media (max-width: 767px) {
  .mypage__main {
    padding: var(--space-6) var(--space-4);
  }

  .focus-gauge {
    flex-direction: column;
    text-align: center;
  }
}
```

- [ ] **Step 3: 빌드로 컴파일 확인**

Run: `cd /Users/tina/Project/Zoner/zoner && npm run build`
Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
cd /Users/tina/Project/Zoner/zoner
git add src/components/Mypage.js src/components/Mypage.css
git commit -m "feat: redesign Mypage as dashboard with focus gauge"
```

---

## Task 6: 전체 검증 및 정리

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 최종 빌드 및 정적 서버로 렌더 확인**

```bash
cd /Users/tina/Project/Zoner/zoner
npm run build
npx serve -s build -l 4173 &
sleep 2
curl -s http://localhost:4173 | grep -o '<title>[^<]*</title>'
kill %1
```

Expected: `<title>Zoner</title>` 출력

- [ ] **Step 2: 320px / 768px / 1440px 레이아웃 수동 확인**

`npm start`로 개발 서버 실행 후 브라우저 개발자도구에서 Home, Login, Mypage를 320px, 768px, 1440px 폭으로 각각 확인 — 가로 스크롤 발생 여부, 텍스트 잘림, 버튼 겹침 여부 체크.

- [ ] **Step 3: 키보드만으로 로그인 플로우 확인**

마우스 없이 Tab 키만으로: NavBar 로고 → 메뉴 → 아이디 입력 → 비밀번호 입력 → 로그인하기 버튼까지 도달 가능한지, `:focus-visible` 링이 각 요소에서 보이는지 확인.

- [ ] **Step 4: 기존 로직 회귀 확인**

브라우저에서 다음을 수동 실행:
1. Login 페이지에서 잘못된 아이디/비밀번호 입력 → 카드 내부에 인라인 에러 메시지가 뜨는지 (알림창이 아니라)
2. "회원가입하기" 클릭 → SignUp 모달 오픈 확인
3. SignUp에서 올바른 값 입력 후 제출 → 완료 알림 → Login으로 복귀 → 방금 등록한 아이디/비밀번호로 로그인 성공 시 Mypage로 이동, 상단에 이름 표시 확인

- [ ] **Step 5: 빌드 산출물 정리**

```bash
cd /Users/tina/Project/Zoner/zoner
rm -rf build
```

(Task별 `npm run build`로 생성된 `build/`는 이미 `.gitignore`에 포함되어 있어 커밋되지 않지만, 프로젝트 규칙상 불필요한 산출물은 디스크에 남기지 않는다.)
