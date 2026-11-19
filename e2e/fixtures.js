// 가짜 Supabase 세션과 REST 응답. 실제 프로젝트에 붙지 않고도 인증 화면을
// 렌더하기 위한 것이다. 네트워크는 전부 가로채므로 외부로 나가지 않는다.

const USER_ID = '00000000-0000-0000-0000-000000000001';

const user = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'e2e@example.com',
  app_metadata: {},
  user_metadata: { name: 'E2E' },
  created_at: '2026-08-01T00:00:00Z',
};

const session = {
  access_token: 'e2e.fake.token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'e2e-fake-refresh',
  user,
};

// supabase-js는 세션을 sb-<project-ref>-auth-token 키에 넣는다.
// ref는 빌드에 박힌 REACT_APP_SUPABASE_URL에서 나오므로 같은 값에서 유도한다.
function projectRef() {
  const raw = process.env.REACT_APP_SUPABASE_URL || '';
  try {
    return new URL(raw).hostname.split('.')[0];
  } catch {
    return 'localhost';
  }
}

const timeline = Array.from({ length: 42 }, (_, minute) => ({
  minute,
  focus_ratio: Math.max(0.15, Math.min(1, 0.82 + Math.sin(minute / 4) * 0.22 - minute * 0.004)),
}));

const studySession = (i) => ({
  id: `1111111${i}-1111-4111-8111-111111111111`,
  user_id: USER_ID,
  started_at: `2026-11-1${i}T09:00:00Z`,
  ended_at: `2026-11-1${i}T09:42:00Z`,
  duration_seconds: 2520,
  focus_score: [78, 64, 85][i % 3],
  timeline,
  focus_breakdown: {
    focused: 0.62, looking_down: 0.16, head_turned: 0.1,
    looking_up: 0.04, eyes_closed: 0.03, absent: 0.05,
  },
  alerts: [{ at: 720, reason: 'head_turned' }, { at: 1980, reason: 'absent' }],
  video_path: null,
  deleted_at: null,
  created_at: `2026-11-1${i}T09:42:00Z`,
});

const sessions = [studySession(1), studySession(2), studySession(3)];

const json = (route, body, count) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: count === undefined ? {} : { 'Content-Range': `0-${Math.max(count - 1, 0)}/${count}` },
    body: JSON.stringify(body),
  });

/** 로그인된 것처럼 보이게 한다. page.goto 전에 부른다. */
async function signIn(context) {
  await context.addInitScript(
    ([ref, value]) => {
      try {
        window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value));
      } catch (e) {
        /* 사생활 보호 모드 등에서 실패해도 테스트는 진행한다 */
      }
    },
    [projectRef(), session]
  );
  await mockApi(context);
}

/** 세션 없이 보호 라우트를 때릴 때도 API는 막아 둔다(외부로 나가지 않게). */
async function mockApi(context, { signedIn = true } = {}) {
  await context.route('**/auth/v1/user*', (route) =>
    signedIn ? json(route, user) : route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
  );
  await context.route('**/auth/v1/**', (route) => json(route, signedIn ? session : {}));
  await context.route('**/rest/v1/profiles*', (route) =>
    json(route, [{ id: USER_ID, name: 'E2E', created_at: '2026-08-01T00:00:00Z' }], 1)
  );
  await context.route('**/rest/v1/study_sessions*', (route) => {
    const trashed = route.request().url().includes('deleted_at=not.is.null');
    const rows = trashed ? [{ ...sessions[0], deleted_at: '2026-11-17T00:00:00Z' }] : sessions;
    return json(route, rows, rows.length);
  });
  // 리포트·저장 화면은 테이블이 아니라 active_study_sessions 뷰를 읽는다.
  // 뷰에는 deleted_at 이 없다 — TS-012가 났던 자리라 모양을 다르게 둔다.
  await context.route('**/rest/v1/active_study_sessions*', (route) => {
    const rows = sessions.map(({ deleted_at, ...rest }) => rest);
    return json(route, rows, rows.length);
  });
  await context.route('**/rest/v1/conversations*', (route) =>
    json(route, [{
      id: '22222222-2222-4222-8222-222222222222',
      user_id: USER_ID, title: 'e2e 대화',
      created_at: '2026-11-17T00:00:00Z', updated_at: '2026-11-17T01:00:00Z',
    }], 1)
  );
  await context.route('**/rest/v1/**', (route) => json(route, [], 0));
  // 어떤 이유로도 실제 외부 호출이 나가지 않게 마지막 그물을 친다.
  await context.route('**supabase.co/**', (route) => json(route, []));
}

module.exports = { user, session, sessions, signIn, mockApi, projectRef, USER_ID };
