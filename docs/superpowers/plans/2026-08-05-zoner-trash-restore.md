# Zoner 휴지통(삭제·복원) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (컨트롤러가 worktree 없이 main에서 직접 순차 실행, 비용 절감을 위해 서브에이전트 다중 디스패치 없음). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/save` 목록과 `/read` 상세에서 학습 세션을 삭제하면 휴지통(`/trash`)으로 이동하고, `/trashread`에서 복구하거나 영구삭제할 수 있게 만든다. 삭제 30일 후에는 자동으로 영구삭제된다.

**Architecture:** 프론트엔드(CRA)에서 Supabase를 직접 호출하는 기존 구조 그대로. 삭제는 소프트 삭제(`study_sessions.deleted_at`)로 처리하고, 활성 세션 조회는 `deleted_at is null`만 보여주는 Postgres 뷰 `active_study_sessions`를 거친다. 완전 삭제는 사용자의 수동 "영구삭제" 클릭 또는 `/trash` 진입 시 30일 지난 항목을 지우는 lazy hard-delete 둘 다로 지원한다. 백엔드 스케줄러(pg_cron 등)는 쓰지 않는다.

**Tech Stack:** React 19, react-router-dom v7, Supabase(Postgres+Auth).

## Global Constraints

- 소프트 삭제 컬럼: `study_sessions.deleted_at TIMESTAMPTZ NULL` — 불리언 플래그와 병용하지 않는다
- 활성 세션 조회(Save/Read/Mypage)는 반드시 `active_study_sessions` 뷰를 통해서만 한다 — `study_sessions`를 직접 조회하지 않는다 (Trash/Trashread는 예외 — 삭제된 행을 봐야 하므로 `study_sessions`를 직접 조회)
- 자동 영구삭제 보관 기간: `PURGE_AFTER_DAYS = 30`, 구현은 pg_cron 없이 조회 시점 lazy hard-delete
- 복원은 확인 단계 없이 즉시 실행
- 영구삭제는 같은 버튼 두 번 클릭으로 확인 — 모달이나 브라우저 `confirm()`은 쓰지 않는다
- 삭제 진입점은 `/save` 목록 카드와 `/read` 상세 화면 둘 다
- RLS: update/delete 정책은 `auth.uid() = user_id`로 본인 행만 허용
- 실패 시 인라인 에러 메시지 + 재시도(`role="alert"`) — alert/confirm 다이얼로그 금지
- 퍼센트는 항상 "%" 표기 ("%p" 금지, 기존 Mypage/Save/Read 규칙과 동일)

---

## Task 1: DB 마이그레이션 — `study_sessions`에 소프트 삭제 추가

**Files:**
- Create: `supabase/migrations/20260805100000_add_trash_to_study_sessions.sql`

**Interfaces:**
- Produces: `study_sessions.deleted_at` 컬럼, 인덱스 `idx_study_sessions_user_deleted_at`, RLS 정책 `study_sessions_update_own`/`study_sessions_delete_own`, 뷰 `active_study_sessions`

- [ ] **Step 1: 마이그레이션 SQL 파일 작성**

```sql
-- supabase/migrations/20260805100000_add_trash_to_study_sessions.sql

alter table study_sessions add column deleted_at timestamptz null;

create index idx_study_sessions_user_deleted_at on study_sessions (user_id, deleted_at);

create policy "study_sessions_update_own" on study_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "study_sessions_delete_own" on study_sessions for delete using (auth.uid() = user_id);

create view active_study_sessions with (security_invoker = true) as select * from study_sessions where deleted_at is null;
```

- [ ] **Step 2: Supabase SQL Editor에서 실행**

프로젝트 `https://uptgtgckddgrnimuohwa.supabase.co`의 SQL Editor에 위 SQL을 그대로 붙여넣고 Run.

**주의 (TS-001 재발 방지):** SQL Editor는 Monaco 기반이라 여는 괄호 뒤에 줄바꿈이 들어간 여러 줄 SQL을 자동화로 타이핑하면 괄호 자동완성 때문에 깨진다(`docs/TROUBLESHOOTING.md` TS-001). 위 SQL은 이미 괄호 내부 줄바꿈이 없는 한 줄짜리 statement로 평탄화돼 있다 — 이 형태 그대로 입력하고, 문장과 문장 사이(괄호가 모두 닫힌 지점)에서만 Enter를 쓴다.

- [ ] **Step 3: 검증**

SQL Editor에서 순서대로 실행:

```sql
select column_name from information_schema.columns where table_name = 'study_sessions' and column_name = 'deleted_at';
```
Expected: 1행 (`deleted_at`)

```sql
select policyname from pg_policies where tablename = 'study_sessions' order by policyname;
```
Expected: `study_sessions_delete_own`, `study_sessions_insert_own`, `study_sessions_select_own`, `study_sessions_update_own` 4행

```sql
select * from active_study_sessions limit 1;
```
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260805100000_add_trash_to_study_sessions.sql
git commit -m "feat: add soft-delete column, RLS policies, and active_study_sessions view"
```

---

## Task 2: `src/lib/trash.js` — 삭제/복원/정리 공유 로직

**Files:**
- Create: `src/lib/trash.js`
- Test: `src/lib/trash.test.js`

**Interfaces:**
- Consumes: `src/lib/supabaseClient.js`의 default export `supabase`
- Produces:
  - `PURGE_AFTER_DAYS: number` (값 30)
  - `daysUntilPurge(deletedAtIso: string, now?: Date): number` — 순수 함수, 0 미만으로 내려가지 않음
  - `async function purgeExpiredSessions(userId: string): Promise<void>`
  - `async function softDeleteSession(sessionId: string): Promise<void>`
  - `async function restoreSession(sessionId: string): Promise<void>`
  - `async function hardDeleteSession(sessionId: string): Promise<void>`

- [ ] **Step 1: 실패하는 테스트 작성 (`daysUntilPurge`만 — 나머지는 Supabase I/O라 컴포넌트 레벨에서 수동 검증)**

```js
// src/lib/trash.test.js
import { daysUntilPurge, PURGE_AFTER_DAYS } from './trash';

describe('daysUntilPurge', () => {
  test('returns the full purge window when deleted just now', () => {
    const now = new Date('2026-08-05T12:00:00.000Z');
    const deletedAt = '2026-08-05T12:00:00.000Z';
    expect(daysUntilPurge(deletedAt, now)).toBe(PURGE_AFTER_DAYS);
  });

  test('returns the remaining days when partially elapsed', () => {
    const now = new Date('2026-08-10T12:00:00.000Z');
    const deletedAt = '2026-08-05T12:00:00.000Z';
    expect(daysUntilPurge(deletedAt, now)).toBe(PURGE_AFTER_DAYS - 5);
  });

  test('clamps to 0 when already past the purge window', () => {
    const now = new Date('2026-09-10T12:00:00.000Z');
    const deletedAt = '2026-08-05T12:00:00.000Z';
    expect(daysUntilPurge(deletedAt, now)).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `CI=true npx react-scripts test src/lib/trash --watchAll=false`
Expected: FAIL — `trash.js` 모듈이 없어서 컴파일 에러

(주의: 프로젝트 전체 `npm test`는 react-router-dom v7 관련 별개 이슈(TS-014)로 깨져 있음. 경로를 `src/lib/trash`로 좁혀서 실행하면 정상 동작한다.)

- [ ] **Step 3: `daysUntilPurge` 최소 구현 작성**

```js
// src/lib/trash.js
export const PURGE_AFTER_DAYS = 30;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntilPurge(deletedAtIso, now = new Date()) {
  const elapsedMs = now.getTime() - new Date(deletedAtIso).getTime();
  const elapsedDays = Math.floor(elapsedMs / ONE_DAY_MS);
  return Math.max(0, PURGE_AFTER_DAYS - elapsedDays);
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `CI=true npx react-scripts test src/lib/trash --watchAll=false`
Expected: PASS (3개 테스트 전부)

- [ ] **Step 5: Supabase I/O 함수 추가 (테스트 없음 — `StartLearning.js`의 `loadFaceLandmarker`/`createFocusTracker`와 동일하게 컴포넌트 레벨 수동 검증 대상)**

`src/lib/trash.js` 파일 상단에 import 추가:

```js
// src/lib/trash.js 상단에 추가
import supabase from './supabaseClient';
```

파일 끝에 아래 4개 함수 추가:

```js
// src/lib/trash.js 끝에 추가

export async function purgeExpiredSessions(userId) {
  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * ONE_DAY_MS).toISOString();
  const { error } = await supabase
    .from('study_sessions')
    .delete()
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff);

  if (error) {
    throw error;
  }
}

export async function softDeleteSession(sessionId) {
  const { error } = await supabase
    .from('study_sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    throw error;
  }
}

export async function restoreSession(sessionId) {
  const { error } = await supabase
    .from('study_sessions')
    .update({ deleted_at: null })
    .eq('id', sessionId);

  if (error) {
    throw error;
  }
}

export async function hardDeleteSession(sessionId) {
  const { error } = await supabase
    .from('study_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    throw error;
  }
}
```

- [ ] **Step 6: 테스트 재실행 → 여전히 통과 확인 (import 추가로 깨지지 않았는지)**

Run: `CI=true npx react-scripts test src/lib/trash --watchAll=false`
Expected: PASS (3개 테스트 전부)

- [ ] **Step 7: 커밋**

```bash
git add src/lib/trash.js src/lib/trash.test.js
git commit -m "feat: add trash lib with soft-delete, restore, and purge logic"
```

---

## Task 3: `Save.js` + `Read.js` — 활성 세션 뷰 전환 + 삭제 버튼

**Files:**
- Modify: `src/components/Save.js`
- Modify: `src/components/Save.css`
- Modify: `src/components/Read.js`
- Modify: `src/components/SessionReport.css`

**Interfaces:**
- Consumes: `softDeleteSession(sessionId)` (Task 2), 뷰 `active_study_sessions` (Task 1)

- [ ] **Step 1: `Save.js` — 뷰 전환 + 삭제 버튼**

`src/components/Save.js` 전체를 아래로 교체:

```jsx
// src/components/Save.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { softDeleteSession } from '../lib/trash';
import './Save.css';

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
};

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
};

export const Save = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadSessions = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      const { data } = await supabase
        .from('active_study_sessions')
        .select('id, started_at, duration_seconds, focus_score')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (isMounted) {
        setSessions(data || []);
        setIsLoading(false);
      }
    };

    loadSessions();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleDelete = async (session) => {
    setDeleteError(null);
    setSessions((prev) => prev.filter((s) => s.id !== session.id));

    try {
      await softDeleteSession(session.id);
    } catch (error) {
      setSessions((prev) =>
        [...prev, session].sort(
          (a, b) => new Date(b.started_at) - new Date(a.started_at)
        )
      );
      setDeleteError('삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  if (isLoading) {
    return <div className="save-page" />;
  }

  return (
    <div className="save-page">
      <header className="save-page__topbar">
        <h1 className="save-page__title">학습 기록</h1>
        <button
          type="button"
          className="save-page__home"
          onClick={() => navigate('/mypage')}
        >
          HOME
        </button>
      </header>

      <main className="save-page__main">
        {deleteError && (
          <p className="save-page__error" role="alert">
            {deleteError}
          </p>
        )}

        {sessions.length === 0 ? (
          <p className="save-page__empty">아직 학습 세션이 없습니다.</p>
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <li key={session.id} className="session-card">
                <button
                  type="button"
                  className="session-card__link"
                  onClick={() => navigate(`/read?session=${session.id}`)}
                >
                  <span className="session-card__date">
                    {formatDate(session.started_at)}
                  </span>
                  <span className="session-card__duration">
                    {formatDuration(session.duration_seconds)}
                  </span>
                  <span className="session-card__score">
                    {session.focus_score}%
                  </span>
                </button>
                <button
                  type="button"
                  className="session-card__delete"
                  aria-label="세션 삭제"
                  onClick={() => handleDelete(session)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default Save;
```

- [ ] **Step 2: `Save.css` — 카드 구조 변경(링크+삭제 버튼 분리) 반영**

`src/components/Save.css`에서 기존 `.session-card` 규칙(`display: flex` ~ `focus-visible` 블록 전체)을 아래로 교체:

```css
.session-card {
  display: flex;
  align-items: stretch;
  gap: var(--space-2);
}

.session-card__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex: 1;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--text-sm);
  padding: var(--space-4);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--duration-normal) var(--ease-out-expo),
    transform var(--duration-normal) var(--ease-out-expo);
}

.session-card__link:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.session-card__link:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.session-card__delete {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.session-card__delete:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.session-card__delete:focus-visible {
  outline: 2px solid var(--color-danger);
  outline-offset: 2px;
}
```

`.session-card__date`, `.session-card__score` 규칙은 그대로 둔다(대상 셀렉터가 `.session-card__link` 자식이라 변경 불필요). 파일 끝에 아래 추가:

```css
.save-page__error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-4);
}
```

- [ ] **Step 3: `Read.js` — 뷰 전환 + 삭제 버튼**

`src/components/Read.js` 전체를 아래로 교체:

```jsx
// src/components/Read.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { softDeleteSession } from '../lib/trash';
import './SessionReport.css';

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

export const Read = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      if (!sessionId) {
        if (isMounted) {
          setNotFound(true);
          setIsLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from('active_study_sessions')
        .select('id, started_at, duration_seconds, focus_score, timeline')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (isMounted) {
        if (data) {
          setSession(data);
        } else {
          setNotFound(true);
        }
        setIsLoading(false);
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [navigate, sessionId]);

  const handleDelete = async () => {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await softDeleteSession(session.id);
      navigate('/save');
    } catch (error) {
      setDeleteError('삭제에 실패했습니다. 다시 시도해주세요.');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="session-report" />;
  }

  return (
    <div className="session-report">
      <header className="session-report__topbar">
        <h1 className="session-report__title">학습 리포트</h1>
        <div className="session-report__topbar-actions">
          {session && (
            <button
              type="button"
              className="session-report__delete"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </button>
          )}
          <button
            type="button"
            className="session-report__home"
            onClick={() => navigate('/save')}
          >
            목록으로
          </button>
        </div>
      </header>

      <main className="session-report__main">
        {notFound ? (
          <p className="session-report__empty">
            해당 학습 세션을 찾을 수 없습니다.
          </p>
        ) : (
          <>
            {deleteError && (
              <p className="session-report__error" role="alert">
                {deleteError}
              </p>
            )}

            <p className="session-report__date">
              {formatDate(session.started_at)}
            </p>
            <div className="session-report__score">
              <span className="session-report__score-value">
                {session.focus_score}%
              </span>
              <span className="session-report__score-label">종합 집중도</span>
            </div>

            <div
              className="focus-chart"
              role="img"
              aria-label={`시간대별 집중도 그래프. 종합 집중도 ${session.focus_score}%`}
            >
              <div className="focus-chart__track">
                {session.timeline.map((bucket) => (
                  <div
                    key={bucket.minute}
                    className="focus-chart__bar"
                    style={{ height: `${Math.round(bucket.focus_ratio * 100)}%` }}
                  />
                ))}
              </div>
              <div className="focus-chart__labels">
                {session.timeline.map((bucket) => (
                  <span key={bucket.minute} className="focus-chart__minute">
                    {bucket.minute}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Read;
```

- [ ] **Step 4: `SessionReport.css`에 삭제 버튼/에러 스타일 추가**

`src/components/SessionReport.css`의 `.session-report__home:focus-visible` 규칙 뒤에 추가:

```css
.session-report__topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.session-report__delete {
  background: none;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.session-report__delete:hover {
  background-color: var(--color-danger);
  color: white;
}

.session-report__delete:focus-visible {
  outline: 2px solid var(--color-danger);
  outline-offset: 2px;
}

.session-report__delete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.session-report__error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-4);
}
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공. 빌드 후 `build/` 폴더 삭제.

- [ ] **Step 6: 브라우저 수동 검증**

1. `/save` 접속 → 기존 세션 목록이 그대로 보이는지 확인 (뷰 전환으로 회귀 없는지)
2. 세션 카드의 "삭제" 클릭 → 카드가 즉시 목록에서 사라지는지 확인
3. Supabase 대시보드에서 해당 행의 `deleted_at`이 채워졌는지 확인
4. `/read?session=<다른 세션 id>` 접속 → 상단에 "삭제" 버튼이 보이는지, 클릭 시 `/save`로 이동하고 목록에서 사라지는지 확인

- [ ] **Step 7: 커밋**

```bash
git add src/components/Save.js src/components/Save.css src/components/Read.js src/components/SessionReport.css
git commit -m "feat: switch active views to active_study_sessions and add delete action"
```

---

## Task 4: `Mypage.js` — 최근 기록 뷰 전환

**Files:**
- Modify: `src/components/Mypage.js`

**Interfaces:**
- Consumes: 뷰 `active_study_sessions` (Task 1)

- [ ] **Step 1: `recentSessions` 쿼리 대상 변경**

`src/components/Mypage.js`에서:

```js
const { data: sessions } = await supabase
  .from('study_sessions')
  .select('id, started_at, focus_score')
  .eq('user_id', user.id)
  .order('started_at', { ascending: false })
  .limit(3);
```

를 아래로 교체:

```js
const { data: sessions } = await supabase
  .from('active_study_sessions')
  .select('id, started_at, focus_score')
  .eq('user_id', user.id)
  .order('started_at', { ascending: false })
  .limit(3);
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공. 빌드 후 `build/` 폴더 삭제.

- [ ] **Step 3: 브라우저 수동 검증**

1. `/mypage` 접속 → "최근 기록"에 활성 세션만 보이는지 확인
2. Task 3에서 삭제한 세션이 "최근 기록"에 더 이상 안 보이는지 확인

- [ ] **Step 4: 커밋**

```bash
git add src/components/Mypage.js
git commit -m "feat: exclude deleted sessions from Mypage recent records"
```

---

## Task 5: `Trash.js` — 휴지통 목록 (Figma 스캐폴드 전면 교체)

**Files:**
- Modify: `src/components/Trash.js` (전면 재작성)
- Modify: `src/components/Trash.css` (전면 재작성)

**Interfaces:**
- Consumes: `purgeExpiredSessions(userId)`, `daysUntilPurge(deletedAtIso)` (Task 2)

- [ ] **Step 1: `Trash.js` 전면 재작성**

```jsx
// src/components/Trash.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { purgeExpiredSessions, daysUntilPurge } from '../lib/trash';
import './Trash.css';

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
};

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
};

export const Trash = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadTrash = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      try {
        await purgeExpiredSessions(user.id);
      } catch (error) {
        // 정리 실패는 무시 — 조회 자체는 계속 진행, 다음 방문 때 다시 시도된다
      }

      const { data } = await supabase
        .from('study_sessions')
        .select('id, started_at, duration_seconds, focus_score, deleted_at')
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (isMounted) {
        setSessions(data || []);
        setIsLoading(false);
      }
    };

    loadTrash();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (isLoading) {
    return <div className="trash-page" />;
  }

  return (
    <div className="trash-page">
      <header className="trash-page__topbar">
        <h1 className="trash-page__title">휴지통</h1>
        <button
          type="button"
          className="trash-page__home"
          onClick={() => navigate('/mypage')}
        >
          HOME
        </button>
      </header>

      <main className="trash-page__main">
        {sessions.length === 0 ? (
          <p className="trash-page__empty">휴지통이 비어 있습니다.</p>
        ) : (
          <ul className="trash-list">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className="trash-card"
                  onClick={() => navigate(`/trashread?session=${session.id}`)}
                >
                  <span className="trash-card__date">
                    {formatDate(session.started_at)}
                  </span>
                  <span className="trash-card__duration">
                    {formatDuration(session.duration_seconds)}
                  </span>
                  <span className="trash-card__score">
                    {session.focus_score}%
                  </span>
                  <span className="trash-card__purge">
                    {daysUntilPurge(session.deleted_at)}일 후 자동 삭제
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default Trash;
```

- [ ] **Step 2: `Trash.css` 전면 교체**

```css
/* src/components/Trash.css */
.trash-page {
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.trash-page__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.trash-page__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  margin: 0;
}

.trash-page__home {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.trash-page__home:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.trash-page__home:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.trash-page__main {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.trash-page__empty {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.trash-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.trash-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  width: 100%;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--text-sm);
  padding: var(--space-4);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--duration-normal) var(--ease-out-expo),
    transform var(--duration-normal) var(--ease-out-expo);
}

.trash-card:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.trash-card:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.trash-card__date {
  color: var(--color-text-muted);
}

.trash-card__score {
  font-weight: 700;
  color: var(--color-accent);
}

.trash-card__purge {
  color: var(--color-danger);
  font-size: var(--text-xs);
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공. 빌드 후 `build/` 폴더 삭제.

- [ ] **Step 4: 브라우저 수동 검증**

1. Task 3에서 삭제한 세션으로 `/trash` 접속 → 목록에 날짜·시간·점수·"n일 후 자동 삭제"가 표시되는지 확인
2. 항목 클릭 시 `/trashread?session=<id>`로 이동하는지 확인 (Task 6에서 상세 구현 전이라 스캐폴드가 보이는 게 정상 — 이 단계에선 URL만 확인)
3. 세션이 하나도 없는 계정으로 `/trash` 접속 → "휴지통이 비어 있습니다" 표시 확인

- [ ] **Step 5: 커밋**

```bash
git add src/components/Trash.js src/components/Trash.css
git commit -m "feat: rebuild trash list screen with real deleted sessions"
```

---

## Task 6: `Trashread.js` — 휴지통 상세 (복구/영구삭제)

**Files:**
- Modify: `src/components/Trashread.js` (전면 재작성, CSS import를 `./TrashDetail.css`로 변경)
- Create: `src/components/TrashDetail.css`
- Delete: `src/components/Read.css`

**Interfaces:**
- Consumes: `restoreSession(sessionId)`, `hardDeleteSession(sessionId)` (Task 2)

**주의:** `Trashread.js`는 지금 `./Read.css`를 쓰고 있다. `Read.js`는 파이프라인 서브프로젝트에서 이미 `./SessionReport.css`로 갈아탔기 때문에(grep으로 확인함 — `Read.css`를 참조하는 곳은 `Trashread.js` 하나뿐), 이 태스크에서 `Trashread.js`가 새 CSS 파일로 옮겨가면 `Read.css`는 더 이상 아무도 쓰지 않는 고아 파일이 된다. Step 3에서 삭제한다.

- [ ] **Step 1: `Trashread.js` 전면 재작성**

```jsx
// src/components/Trashread.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { restoreSession, hardDeleteSession } from '../lib/trash';
import './TrashDetail.css';

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

export const Trashread = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [confirmingPurge, setConfirmingPurge] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      if (!sessionId) {
        if (isMounted) {
          setNotFound(true);
          setIsLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from('study_sessions')
        .select('id, started_at, duration_seconds, focus_score, timeline, deleted_at')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .single();

      if (isMounted) {
        if (data) {
          setSession(data);
        } else {
          setNotFound(true);
        }
        setIsLoading(false);
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [navigate, sessionId]);

  const handleRestore = async () => {
    setActionError(null);
    setIsRestoring(true);

    try {
      await restoreSession(session.id);
      navigate('/save');
    } catch (error) {
      setActionError('복구에 실패했습니다. 다시 시도해주세요.');
      setIsRestoring(false);
    }
  };

  const handlePurgeClick = async () => {
    if (!confirmingPurge) {
      setConfirmingPurge(true);
      return;
    }

    setActionError(null);
    setIsPurging(true);

    try {
      await hardDeleteSession(session.id);
      navigate('/trash');
    } catch (error) {
      setActionError('영구삭제에 실패했습니다. 다시 시도해주세요.');
      setIsPurging(false);
    }
  };

  if (isLoading) {
    return <div className="trash-detail" />;
  }

  return (
    <div className="trash-detail">
      <header className="trash-detail__topbar">
        <h1 className="trash-detail__title">삭제한 항목</h1>
        <button
          type="button"
          className="trash-detail__home"
          onClick={() => navigate('/trash')}
        >
          휴지통으로
        </button>
      </header>

      <main className="trash-detail__main">
        {notFound ? (
          <p className="trash-detail__empty">
            해당 학습 세션을 찾을 수 없습니다.
          </p>
        ) : (
          <>
            {actionError && (
              <p className="trash-detail__error" role="alert">
                {actionError}
              </p>
            )}

            <p className="trash-detail__date">
              {formatDate(session.started_at)}
            </p>
            <div className="trash-detail__score">
              <span className="trash-detail__score-value">
                {session.focus_score}%
              </span>
              <span className="trash-detail__score-label">종합 집중도</span>
            </div>

            <div
              className="focus-chart"
              role="img"
              aria-label={`시간대별 집중도 그래프. 종합 집중도 ${session.focus_score}%`}
            >
              <div className="focus-chart__track">
                {session.timeline.map((bucket) => (
                  <div
                    key={bucket.minute}
                    className="focus-chart__bar"
                    style={{ height: `${Math.round(bucket.focus_ratio * 100)}%` }}
                  />
                ))}
              </div>
              <div className="focus-chart__labels">
                {session.timeline.map((bucket) => (
                  <span key={bucket.minute} className="focus-chart__minute">
                    {bucket.minute}
                  </span>
                ))}
              </div>
            </div>

            <div className="trash-detail__actions">
              <button
                type="button"
                className="trash-detail__restore"
                onClick={handleRestore}
                disabled={isRestoring || isPurging}
              >
                {isRestoring ? '복구 중...' : '복구'}
              </button>
              <button
                type="button"
                className={`trash-detail__purge${
                  confirmingPurge ? ' is-confirming' : ''
                }`}
                onClick={handlePurgeClick}
                disabled={isRestoring || isPurging}
              >
                {isPurging
                  ? '삭제 중...'
                  : confirmingPurge
                  ? '정말 삭제하려면 다시 클릭'
                  : '영구삭제'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Trashread;
```

- [ ] **Step 2: `TrashDetail.css` 신설**

```css
/* src/components/TrashDetail.css */
.trash-detail {
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.trash-detail__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.trash-detail__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  margin: 0;
}

.trash-detail__home {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
}

.trash-detail__home:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.trash-detail__home:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.trash-detail__main {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.trash-detail__empty {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.trash-detail__error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-4);
}

.trash-detail__date {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-4);
}

.trash-detail__score {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  margin-bottom: var(--space-8);
}

.trash-detail__score-value {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-accent);
}

.trash-detail__score-label {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.focus-chart {
  padding: var(--space-4);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.focus-chart__track {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  height: 150px;
}

.focus-chart__bar {
  width: 12px;
  min-width: 12px;
  min-height: 2px;
  background-color: var(--color-accent);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.focus-chart__labels {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.focus-chart__minute {
  width: 12px;
  min-width: 12px;
  text-align: center;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.trash-detail__actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-8);
}

.trash-detail__restore {
  background-color: var(--color-accent);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  font-size: var(--text-sm);
  font-weight: 700;
  padding: var(--space-3) var(--space-6);
  cursor: pointer;
}

.trash-detail__restore:hover {
  background-color: var(--color-accent-hover);
}

.trash-detail__restore:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.trash-detail__restore:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.trash-detail__purge {
  background: none;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: var(--text-sm);
  font-weight: 700;
  padding: var(--space-3) var(--space-6);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out-expo),
    color var(--duration-fast) var(--ease-out-expo);
}

.trash-detail__purge:hover {
  background-color: var(--color-danger);
  color: white;
}

.trash-detail__purge:focus-visible {
  outline: 2px solid var(--color-danger);
  outline-offset: 2px;
}

.trash-detail__purge:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.trash-detail__purge.is-confirming {
  background-color: var(--color-danger);
  color: white;
}
```

- [ ] **Step 3: 고아 파일 삭제**

```bash
git rm src/components/Read.css
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공, `Read.css` 삭제로 인한 참조 에러 없음. 빌드 후 `build/` 폴더 삭제.

- [ ] **Step 5: 브라우저 수동 검증**

1. `/trash`에서 항목 클릭 → `/trashread?session=<id>`에서 점수·그래프가 정상 표시되는지 확인
2. "복구" 클릭 → `/save`로 이동하고 해당 세션이 목록에 다시 나타나는지, `/trash`에서는 사라졌는지 확인
3. 다시 삭제 후 `/trashread`에서 "영구삭제" 첫 클릭 → 버튼 라벨이 "정말 삭제하려면 다시 클릭"으로 바뀌는지 확인
4. 같은 버튼 두 번째 클릭 → `/trash`로 이동하고, Supabase 대시보드에서 해당 행이 실제로 삭제됐는지 확인
5. Supabase 대시보드에서 임의 행의 `deleted_at`을 31일 전으로 수정한 뒤 `/trash` 재방문 → 자동으로 목록에서 사라지는지(lazy purge) 확인
6. 다른 계정으로 로그인해 `/trash`, `/trashread?session=<다른 계정 세션 id>` 접근 시 서로의 데이터가 안 보이는지(RLS) 확인

- [ ] **Step 6: 커밋**

```bash
git add src/components/Trashread.js src/components/TrashDetail.css
git commit -m "feat: rebuild trash detail screen with restore and permanent delete"
```

---

## 완료 후

모든 태스크 완료 후 `superpowers:finishing-a-development-branch`로 마무리 (이번 작업은 main에 직접 커밋했으므로 별도 머지 없이 `npm run build` 최종 확인 후 push 여부만 사용자에게 확인).
