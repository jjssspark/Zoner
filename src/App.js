// src/App.js

/* eslint-disable react/jsx-pascal-case */
import './styles/tokens.css';
import './styles/motion.css';
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import Home from './features/marketing/Home';
import UserGuide from './features/marketing/UserGuide';
import Pricing from './features/marketing/Pricing';
import FAQ from './features/marketing/FAQ';
import NotFound from './features/marketing/NotFound';
import Login from './features/auth/Login';
import Mypage from './features/profile/Mypage';
import StartLearning from './features/learning/StartLearning';
import Save from './features/records/Save';
import Read from './features/records/Read';
import Trash from './features/records/Trash';
import Trashread from './features/records/Trashread';
import SignUp from './features/auth/SignUp';
import AiChat from './features/chat/AiChat';
import ErrorBoundary from './components/ui/ErrorBoundary';
import ProtectedRoute from './components/routing/ProtectedRoute';
/* eslint-enable react/jsx-pascal-case */

// 화면이 바뀔 때 툭 끊기지 않도록 진입 페이드를 준다. pathname을 key로 주면
// 라우트가 바뀔 때마다 래퍼가 다시 마운트돼 애니메이션이 다시 재생된다.
//
// transform은 쓰지 않는다. 조상에 transform이 걸리면 position: fixed 자손의
// 기준이 그 조상으로 바뀌는데, Mypage의 고정 배경과 SignUp, ConfirmDialog가
// 전부 fixed라 전환 중에 배경이 튄다. opacity는 그 문제가 없다.
function AnimatedRoutes({ children }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="route-enter">
      <Routes location={location}>{children}</Routes>
    </div>
  );
}

// 로그인이 필요한 화면을 한 줄로 감싼다. 가드를 화면마다 복사하지 않는다.
const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

function App() {
  return (
    // 렌더 중 터진 예외를 여기서 받는다. 없으면 흰 화면만 남는다.
    // Router 바깥에 두어 라우팅 자체가 깨져도 안내가 나오게 한다.
    <ErrorBoundary>
      <Router>
        <AnimatedRoutes>
          {/* 공개 */}
          <Route path="/" element={<Home />} />
          <Route path="/guide" element={<UserGuide />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />

          {/* 로그인 필요 */}
          <Route path="/mypage" element={protect(<Mypage />)} />
          <Route path="/start-learning" element={protect(<StartLearning />)} />
          <Route path="/save" element={protect(<Save />)} />
          <Route path="/read" element={protect(<Read />)} />
          <Route path="/trash" element={protect(<Trash />)} />
          <Route path="/trashread" element={protect(<Trashread />)} />
          <Route path="/ai-chat" element={protect(<AiChat />)} />

          {/* 어디에도 걸리지 않은 주소 */}
          <Route path="*" element={<NotFound />} />
        </AnimatedRoutes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
