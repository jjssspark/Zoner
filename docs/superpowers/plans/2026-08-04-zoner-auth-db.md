# Zoner 인증 + DB 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (컨트롤러가 직접 순차 실행 — 비용 절감을 위해 subagent-driven-development는 이번엔 사용하지 않음). Steps use checkbox (`- [ ]`) syntax for tracking.

> **상태 (2026-08-07 확인)**: 이 계획의 기능은 구현되어 코드베이스에 있다.
> **아래 체크박스는 실행 중에 갱신되지 않았다 — 진행 표시로 신뢰하지 말 것.**
> 미체크는 "안 했다"가 아니라 "표시를 안 했다"이다. 실제 반영 여부는 `src/`
> 코드와 테스트(214건 통과)로 확인한다.

**Goal:** Zoner의 가짜 회원가입/로그인(브라우저 메모리 mock)을 Supabase 기반 실제 인증+DB로 교체한다.

**Architecture:** CRA 프론트엔드에서 `supabase-js`로 Supabase(Postgres + Auth)를 직접 호출한다. 커스텀 백엔드 서버 없음. `profiles` 테이블 하나로 표시 이름을 저장하고, `auth.users`는 Supabase가 관리한다.

**Tech Stack:** React 19, react-router-dom 7, `@supabase/supabase-js` (신규), Supabase(Postgres + Auth, 이미 생성된 프로젝트).

## Global Constraints

- 신규 npm 의존성은 `@supabase/supabase-js` 하나만 추가한다.
- 비밀값(anon key 포함)은 `.env`에만 두고 코드에 하드코딩하지 않는다 (`.claude/standards/env-config.md`).
- DB 스키마는 `.claude/standards/db-conventions.md` 규약(snake_case, `created_at`/`updated_at`, RLS)을 따른다.
- 이번 라운드는 이메일 인증(email confirmation) 비활성화 상태로 간다 — Supabase 대시보드 설정이며 코드 변경 아님.
- 자동화 테스트는 이번 범위에 포함하지 않는다 — `docs/TROUBLESHOOTING.md`의 TS-014(CRA 번들 Jest와 react-router-dom v7 비호환)로 인해 기존 `App.test.js`조차 실행 불가능한 상태이고, Supabase 네트워크 호출을 모킹하는 테스트 인프라를 새로 구축하는 것은 이번 스펙의 범위 밖이다. 검증은 `npm run build` 컴파일 확인 + 수동 브라우저 시나리오로 한다.
- Save, Read, Report_a, Save_report, Trash, Trashread, Pricing, FAQ, UserGuide, `learningVideos`/`reportVideos`/`addLearningVideo`/`addReportVideo` 로직은 건드리지 않는다.

---

## Task 1: `profiles` 테이블 마이그레이션

**Files:**
- Create: `supabase/migrations/20260804120000_create_profiles.sql`

**Interfaces:**
- Produces: `profiles` 테이블 — 컬럼 `id uuid` (PK, `auth.users.id` 참조), `name text not null`, `created_at timestamptz`, `updated_at timestamptz`. RLS 활성화, `select`/`update`/`insert` 정책 각 1개 (본인 행만).

- [ ] **Step 1: 마이그레이션 SQL 파일 작성**

```sql
-- supabase/migrations/20260804120000_create_profiles.sql

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "본인 프로필만 조회"
  on profiles for select
  using (auth.uid() = id);

create policy "본인 프로필만 수정"
  on profiles for update
  using (auth.uid() = id);

create policy "가입 시 본인 프로필 생성"
  on profiles for insert
  with check (auth.uid() = id);
```

- [ ] **Step 2: Supabase 대시보드에서 실행**

1. https://supabase.com/dashboard/project/uptgtgckddgrnimuohwa/sql/new 접속 (또는 대시보드 → SQL Editor → New query)
2. Step 1의 SQL 전체를 붙여넣고 Run
3. 왼쪽 메뉴 Table Editor에서 `profiles` 테이블이 생성됐는지, 컬럼이 `id`/`name`/`created_at`/`updated_at` 4개인지 확인
4. `profiles` 테이블 우측 상단에 RLS가 "Enabled" 상태인지 확인 (초록 방패 아이콘)

- [ ] **Step 3: Supabase 대시보드에서 이메일 확인 비활성화**

1. 대시보드 → Authentication → Sign In / Providers (또는 Providers → Email)
2. "Confirm email" 옵션을 끈다 (OFF)

- [ ] **Step 4: Commit**

```bash
cd /Users/tina/Project/Zoner/zoner
git add supabase/migrations/20260804120000_create_profiles.sql
git commit -m "feat: add profiles table migration with RLS policies"
```

---

## Task 2: Supabase 클라이언트 설정 (env, 의존성, `supabaseClient.js`)

**Files:**
- Modify: `.gitignore` (순수 `.env` 추가)
- Create: `.env.example`
- Create: `.env` (커밋 안 함 — 실제 URL/anon key는 사용자가 대화에서 제공한 값을 그대로 사용한다. 이 값은 보안상 계획 문서에 적지 않는다.)
- Modify: `package.json` (`@supabase/supabase-js` 의존성 추가 — `npm install`로 자동 반영)
- Create: `src/lib/supabaseClient.js`

**Interfaces:**
- Produces: `src/lib/supabaseClient.js`의 `export default supabase` — 이후 모든 컴포넌트가 `import supabase from '../lib/supabaseClient'`로 사용하는 싱글턴 Supabase 클라이언트.

- [ ] **Step 1: `.gitignore`에 `.env` 추가**

`.env.local` 줄 바로 위에 `.env`를 추가한다:

```gitignore
.DS_Store
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

- [ ] **Step 2: `.env.example` 작성**

```bash
# .env.example
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 3: `.env` 작성 (실제 값, 커밋 안 됨)**

```bash
REACT_APP_SUPABASE_URL=<사용자가 제공한 실제 프로젝트 URL>
REACT_APP_SUPABASE_ANON_KEY=<사용자가 제공한 실제 anon key>
```

- [ ] **Step 4: 패키지 설치**

Run: `cd /Users/tina/Project/Zoner/zoner && npm install @supabase/supabase-js`
Expected: `package.json`의 `dependencies`에 `"@supabase/supabase-js"` 추가됨, 설치 에러 없음

- [ ] **Step 5: `src/lib/supabaseClient.js` 작성**

```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
```

- [ ] **Step 6: 빌드로 컴파일 확인**

Run: `cd /Users/tina/Project/Zoner/zoner && npm run build`
Expected: `Compiled successfully.` (아직 어느 컴포넌트도 `supabaseClient`를 import하지 않으므로 이 시점엔 그냥 빌드만 깨지지 않으면 됨)

- [ ] **Step 7: `.env`가 git에 안 잡히는지 확인**

Run: `git status --short | grep -E "^\?\? \.env$" `
Expected: 아무 출력 없음 (즉, `.env`가 untracked 목록에도 안 뜸 = gitignore가 제대로 작동)

- [ ] **Step 8: Commit**

```bash
cd /Users/tina/Project/Zoner/zoner
git add .gitignore .env.example src/lib/supabaseClient.js package.json package-lock.json
git commit -m "feat: add Supabase client setup and env config"
```

---

## Task 3: SignUp — 실제 Supabase 가입으로 교체

**Files:**
- Modify: `src/components/SignUp.js` (전체 교체)

**Interfaces:**
- Consumes: `supabase` (Task 2), `supabase.auth.signUp({ email, password })`, `supabase.from('profiles').insert(...)` (Task 1의 스키마)
- Props 변경: 기존 `{ closeSignUpModal, setUserData }` → `{ closeSignUpModal }` (`setUserData` 제거 — Task 4에서 Login.js도 같이 맞춘다)

- [ ] **Step 1: `src/components/SignUp.js` 전체 교체**

```jsx
import React, { useState, useEffect, useRef } from 'react';
import supabase from '../lib/supabaseClient';
import './SignUp.css';

const FOCUSABLE_SELECTOR =
  'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])';

const SignUp = ({ closeSignUpModal }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setIsSubmitting(false);
      if (error.message.includes('already registered')) {
        alert('이미 가입된 이메일입니다.');
      } else {
        alert('일시적인 오류입니다. 잠시 후 다시 시도해주세요.');
      }
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, name });

    setIsSubmitting(false);

    if (profileError) {
      alert('일시적인 오류입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    alert('회원가입이 완료되었습니다. 다시 로그인해주세요.');
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

          <button
            type="submit"
            className="signup-card__submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? '처리 중...' : '회원가입'}
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

- [ ] **Step 2: 빌드 확인 (Login.js가 아직 `setUserData`를 넘기고 있어 경고 가능성 있음 — Task 4에서 같이 맞춰지므로 이 시점의 경고는 무시)**

Run: `cd /Users/tina/Project/Zoner/zoner && npm run build`
Expected: 컴파일 성공 (신규 에러 없음). `setUserData` 관련 미사용 prop 경고가 떠도 Task 4 완료 후 사라지므로 지금은 무시.

- [ ] **Step 3: Commit**

```bash
cd /Users/tina/Project/Zoner/zoner
git add src/components/SignUp.js
git commit -m "feat: wire SignUp to real Supabase auth.signUp"
```

---

## Task 4: Login — 실제 Supabase 로그인으로 교체 (아이디→이메일)

**Files:**
- Modify: `src/components/Login.js` (전체 교체)

**Interfaces:**
- Consumes: `supabase` (Task 2), `supabase.auth.signInWithPassword({ email, password })`, `SignUp` (Task 3, 새 props `{ closeSignUpModal }`)

- [ ] **Step 1: `src/components/Login.js` 전체 교체**

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import SignUp from './SignUp';
import supabase from '../lib/supabaseClient';
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
```

- [ ] **Step 2: 빌드 확인**

Run: `cd /Users/tina/Project/Zoner/zoner && npm run build`
Expected: `Compiled successfully.` — `setUserData` 관련 경고도 이제 사라짐 (SignUp/Login 양쪽에서 완전히 제거됨)

- [ ] **Step 3: Commit**

```bash
cd /Users/tina/Project/Zoner/zoner
git add src/components/Login.js
git commit -m "feat: wire Login to real Supabase auth.signInWithPassword"
```

---

## Task 5: Mypage — 실제 세션에서 사용자 조회 + 로그아웃

**Files:**
- Modify: `src/components/Mypage.js` (전체 교체)

**Interfaces:**
- Consumes: `supabase` (Task 2), `supabase.auth.getUser()`, `supabase.auth.signOut()`, `supabase.from('profiles').select('name').eq('id', ...).single()`

- [ ] **Step 1: `src/components/Mypage.js` 전체 교체**

```jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
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
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [learningVideos, setLearningVideos] = useState([]);
  const [reportVideos, setReportVideos] = useState([]);

  const addLearningVideo = (video) => {
    setLearningVideos([...learningVideos, video]);
  };

  const addReportVideo = (video) => {
    setReportVideos([...reportVideos, video]);
  };

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      if (isMounted) {
        setUserName(profile ? profile.name : 'Guest');
        setIsLoading(false);
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (isLoading) {
    return <div className="mypage" />;
  }

  return (
    <div className="mypage">
      <header className="mypage__topbar">
        <h1 className="mypage__user">{userName}</h1>
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
            onClick={handleLogout}
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

- [ ] **Step 2: 빌드 확인**

Run: `cd /Users/tina/Project/Zoner/zoner && npm run build`
Expected: `Compiled successfully.`

- [ ] **Step 3: Commit**

```bash
cd /Users/tina/Project/Zoner/zoner
git add src/components/Mypage.js
git commit -m "feat: load Mypage user from Supabase session, wire real logout"
```

---

## Task 6: 전체 수동 검증 + 문제 발생 시 트러블슈팅 기록

**Files:** 없음 (검증 전용). 문제가 생기면 `docs/TROUBLESHOOTING.md`에 문제/원인/해결방안/추후 방안/왜 그렇게 했나를 포함해 기록한다.

- [ ] **Step 1: 개발 서버 기동**

Run: `cd /Users/tina/Project/Zoner/zoner && npm start` (백그라운드)

- [ ] **Step 2: 회원가입 시나리오**

1. `http://localhost:3000/login` → "회원가입하기" 클릭
2. 이름/이메일(실제 받을 수 있는 아무 이메일, 예: 테스트용)/비밀번호(6자 이상)/비밀번호 확인을 채워서 제출
3. "회원가입이 완료되었습니다" alert 확인 → 모달 닫힘
4. Supabase 대시보드 → Authentication → Users에 방금 가입한 이메일이 실제로 떠 있는지 확인
5. Supabase 대시보드 → Table Editor → `profiles`에 같은 `id`로 row가 있고 `name`이 맞는지 확인

- [ ] **Step 3: 로그인 시나리오**

1. 방금 가입한 이메일/비밀번호로 로그인
2. 이메일 확인 절차 없이 바로 `/mypage`로 이동하는지 확인 (Task 1 Step 3에서 이메일 확인을 껐으므로)
3. Mypage 상단에 가입 시 입력한 이름이 뜨는지 확인

- [ ] **Step 4: 세션 유지 확인 (mock 대비 핵심 차이)**

1. Mypage에서 브라우저 새로고침(F5)
2. 로그인 상태가 유지되고 이름이 그대로 뜨는지 확인 (기존엔 새로고침하면 다 날아갔음)

- [ ] **Step 5: 비로그인 접근 차단 확인**

1. 로그아웃(LOGOUT 버튼) 클릭 → Home으로 이동하는지 확인
2. 로그아웃된 상태에서 주소창에 직접 `http://localhost:3000/mypage` 입력
3. `/login`으로 리다이렉트되는지 확인

- [ ] **Step 6: 에러 케이스 확인**

1. 로그인 화면에서 존재하지 않는 이메일/틀린 비밀번호로 로그인 시도
2. "이메일 또는 비밀번호가 올바르지 않습니다" 인라인 에러가 뜨는지 확인 (alert 아님)
3. 이미 가입된 이메일로 재가입 시도 → "이미 가입된 이메일입니다" alert 확인

- [ ] **Step 7: 문제가 있었다면 `docs/TROUBLESHOOTING.md`에 기록**

Step 2~6 중 예상과 다르게 동작한 것이 있었다면, `docs/TROUBLESHOOTING.md`의 "기록 템플릿"을 복사해 문제/원인/해결방안/추후 방안/왜 그렇게 했나를 채워 넣고 인덱스 표 맨 위에 행을 추가한다. 문제없이 전부 통과했다면 이 단계는 생략.

- [ ] **Step 8: 최종 커밋 (검증 중 코드 수정이 있었던 경우만)**

Step 1~6 검증 과정에서 버그를 발견해 코드를 고쳤다면:

```bash
cd /Users/tina/Project/Zoner/zoner
git add -A
git commit -m "fix: address issues found during auth+DB manual verification"
```

검증만 하고 코드 변경이 없었다면 커밋 생략.
