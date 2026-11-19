// src/components/routing/ProtectedRoute.js
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import supabase from '../../lib/supabaseClient';
import Skeleton from '../ui/Skeleton';
import { AuthContext } from './AuthContext';
import './ProtectedRoute.css';

// 로그인이 필요한 화면을 라우트 단계에서 막는다.
//
// 이전에는 화면마다 getUser() + navigate('/login')을 직접 넣었는데,
// StartLearning에는 그게 빠져 있었다. 비로그인 상태로 측정 화면에 들어가
// 카메라를 켜고 세션을 다 돌린 뒤 종료를 누르면, 저장 코드가 user.id를
// 역참조하다 터졌다. 같은 가드를 일곱 번 복사하는 대신 한 곳에 둔다.
export function ProtectedRoute({ children }) {
  // checking -> 아직 모름. 이 동안 /login으로 보내면 새로고침마다 로그인
  // 화면이 한 번 번쩍인다.
  const [status, setStatus] = useState('checking');
  // 통과시킨 사용자를 자식에게 내려 준다. 화면마다 getUser()를 다시 부르지 않게.
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    // getSession은 localStorage를 읽는다. 네트워크 왕복이 없어 판정이 빠르다.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data?.session?.user ?? null);
        setStatus(data?.session ? 'signedIn' : 'signedOut');
      })
      .catch(() => {
        if (!cancelled) setStatus('signedOut');
      });

    // ⚠️ SIGNED_OUT만 본다. 토큰 갱신 실패까지 여기서 쫓아내면, 측정 중이던
    // 사용자가 화면 밖으로 끌려나가면서 그때까지의 기록이 통째로 사라진다.
    // 명시적 로그아웃(다른 탭 포함)은 의도된 행동이므로 즉시 반영한다.
    // 만료된 세션으로 저장을 시도하는 경우는 저장 쪽에서 따로 처리한다.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setStatus('signedOut');
      } else if (session) {
        setUser(session.user);
        setStatus('signedIn');
      }
    });

    return () => {
      cancelled = true;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  if (status === 'checking') {
    return (
      <div className="protected-route">
        <Skeleton variant="card" count={2} />
      </div>
    );
  }

  if (status === 'signedOut') {
    // replace를 쓰는 이유: 뒤로가기로 보호 화면에 다시 들어가지지 않게 한다.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}

export default ProtectedRoute;
