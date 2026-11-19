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
import Login from './features/auth/Login';
import Mypage from './features/profile/Mypage';
import StartLearning from './features/learning/StartLearning';
import Save from './features/records/Save';
import Read from './features/records/Read';
import Trash from './features/records/Trash';
import Trashread from './features/records/Trashread';
import SignUp from './features/auth/SignUp';
import AiChat from './features/chat/AiChat';
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

function App() {
  return (
    <Router>
      <AnimatedRoutes>
        <Route path="/" element={<Home />} />
        <Route path="/guide" element={<UserGuide />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/login" element={<Login />} />
        <Route path="/mypage" element={<Mypage />} />
        <Route path="/start-learning" element={<StartLearning />} />
        <Route path="/save" element={<Save />} />
        <Route path="/read" element={<Read />} />
        <Route path="/trash" element={<Trash />} />
        <Route path="/trashread" element={<Trashread />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/ai-chat" element={<AiChat />} />
      </AnimatedRoutes>
    </Router>
  );
}

export default App;
