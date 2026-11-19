// src/components/routing/AuthContext.js
import { createContext, useContext } from 'react';

// ProtectedRoute가 통과시킨 뒤의 사용자를 담는다.
//
// 이전에는 화면 7개가 각자 supabase.auth.getUser()를 부르고 각자
// navigate('/login')을 했다. 복사본이 일곱 개면 하나가 빠진 것을 눈으로
// 확인할 방법이 없다 — 실제로 측정 화면에서 빠져 있었다 (TS-022).
// 가드는 ProtectedRoute 한 곳에 두고, 화면은 이미 확인된 사용자를 여기서 받는다.
//
// 덤으로 왕복이 줄어든다. getUser()는 서버에 묻지만, ProtectedRoute가 쓰는
// getSession()은 localStorage를 읽는다. 화면마다 있던 네트워크 왕복이 사라진다.
// 신분 자체는 어차피 DB가 RLS로 다시 판단하므로, 화면이 들고 있는 값은
// "내 user_id가 무엇인가"를 아는 용도면 충분하다.
export const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);

  if (value === null) {
    // ProtectedRoute 바깥에서 부른 경우. null을 그대로 돌려주면 호출한 쪽이
    // user.id에서 터지고, 그 자리는 원인에서 멀다. 여기서 끊는다.
    throw new Error('useAuth는 ProtectedRoute 안에서만 쓸 수 있습니다.');
  }

  return value;
}

export default useAuth;
