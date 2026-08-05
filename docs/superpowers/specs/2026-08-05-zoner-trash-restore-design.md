# Zoner 휴지통(삭제·복원) — 설계

## 배경

`study_sessions` 학습 세션·집중도 리포트 파이프라인(`2026-08-04-zoner-focus-session-pipeline-design.md`)이 완료된 상태다. 다음 서브프로젝트는 이 데이터에 대한 삭제/복원(휴지통) 기능이다. `/trash`, `/trashread` 라우트는 앱에 등록돼 있고 Mypage의 "휴지통" 퀵액션도 `/trash`로 연결돼 있지만, 두 컴포넌트 모두 Figma-export 스캐폴드 그대로다 — "rectangle" div가 콘텐츠 자리를 채우고 있고, 이름은 "Jisu"/"tina"로 하드코딩돼 있으며, "복구"/"영구삭제" 버튼도 실제 동작이 없다.

## 아키텍처

프론트엔드에서 Supabase를 직접 호출하는 기존 구조를 그대로 따른다(별도 백엔드 없음). 삭제는 소프트 삭제(`deleted_at` 컬럼)로 처리한다 — `~/.claude/standards/db-conventions.md`의 "소프트 삭제가 필요하면 `deleted_at TIMESTAMPTZ NULL`, 불리언 플래그와 병용하지 않는다" 규약을 그대로 따른다.

완전 삭제(하드 삭제)는 두 경로로 지원한다:
1. 사용자가 휴지통 상세에서 "영구삭제"를 직접 클릭
2. 삭제 후 30일이 지난 항목은 자동으로 사라짐

30일 자동 삭제는 백엔드 스케줄러(pg_cron 등) 없이, **조회 시점 lazy 하드삭제**로 구현한다 — `/trash` 진입 시 만료된 행을 먼저 지운 뒤 남은 행을 조회한다. 이 프로젝트는 서버리스 구조가 원칙이라, DB 확장 활성화나 별도 스케줄링 설정 없이 프론트엔드 로직만으로 해결한다.

소프트 삭제된 행이 기존 조회(Mypage 최근 기록, `/save`, `/read`)에 실수로 다시 노출되는 걸 막기 위해, `deleted_at is null`만 보여주는 Postgres 뷰 `active_study_sessions`를 둔다. db-conventions.md의 "소프트 삭제 필터를 빼먹기 쉽다, 뷰나 ORM 기본 스코프로 강제하라" 권고를 그대로 따른 것 — 매 쿼리에 수동으로 `.is('deleted_at', null)`을 반복하지 않고, 다음에 새 화면이 `study_sessions`를 조회하더라도 뷰를 쓰는 한 삭제된 행이 구조적으로 섞이지 않는다.

## 데이터 모델

```sql
alter table study_sessions add column deleted_at timestamptz null;

create index idx_study_sessions_user_deleted_at
  on study_sessions (user_id, deleted_at);

create policy "study_sessions_update_own"
  on study_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "study_sessions_delete_own"
  on study_sessions for delete
  using (auth.uid() = user_id);

create view active_study_sessions
  with (security_invoker = true) as
  select * from study_sessions where deleted_at is null;
```

- 기존 select/insert 정책(`study_sessions_select_own`, `study_sessions_insert_own`)은 그대로 유지.
- `update`/`delete` 정책을 신규 추가 — 소프트 삭제·복원은 update(`deleted_at` 값 변경), 영구삭제는 delete.
- `active_study_sessions`는 `security_invoker = true`로 만들어 RLS가 뷰를 거쳐도 그대로 적용되게 한다(뷰 소유자 권한이 아니라 호출자 권한으로 평가).
- 인덱스는 `(user_id, deleted_at)` 복합 — 휴지통 목록(`deleted_at is not null`)과 활성 목록(`deleted_at is null`) 조회 양쪽에 쓰인다.

## 공유 로직 — `src/lib/trash.js`

`focusTracker.js`와 같은 패턴으로, 삭제/복원/정리 로직을 화면 4개(Save/Read/Trash/Trashread)가 공유한다. 시그니처:

| 함수 | 역할 | 호출 위치 |
|---|---|---|
| `purgeExpiredSessions(userId): Promise<void>` | `deleted_at`이 `PURGE_AFTER_DAYS`(30일)보다 오래된 행을 실제로 delete (lazy hard-delete) | `Trash.js` 마운트 시 |
| `softDeleteSession(sessionId): Promise<void>` | `deleted_at = now()`로 update | `Save.js`/`Read.js`의 "삭제" 버튼 |
| `restoreSession(sessionId): Promise<void>` | `deleted_at = null`로 update | `Trashread.js`의 "복구" 버튼 |
| `hardDeleteSession(sessionId): Promise<void>` | 행 자체를 delete | `Trashread.js`의 "영구삭제" 두 번째 클릭 |
| `daysUntilPurge(deletedAtIso, now = new Date()): number` | `PURGE_AFTER_DAYS`에서 경과일을 뺀 나머지(순수 계산) | `Trash.js` 목록의 "n일 후 자동 삭제" 표시 |

`PURGE_AFTER_DAYS = 30` 상수도 이 모듈에서 export. `daysUntilPurge`만 순수 계산이라 `focusTracker.test.js`처럼 단위 테스트를 붙인다. 나머지 네 함수는 Supabase I/O라 컴포넌트 레벨 수동 검증 대상이다.

## 프론트엔드 변경

### 수정 파일

**`src/components/Save.js`** (학습 기록 목록)
- 조회 대상을 `study_sessions` → `active_study_sessions`로 변경
- 각 세션 카드에 "삭제" 버튼 추가 → `softDeleteSession(id)` 호출 후 로컬 state에서 즉시 제거(옵티미스틱)

**`src/components/Read.js`** (세션 상세)
- 조회 대상을 `study_sessions` → `active_study_sessions`로 변경
- "삭제" 버튼 추가 → `softDeleteSession(id)` 호출 후 `/save`로 이동

**`src/components/Mypage.js`**
- "최근 기록" 쿼리 대상만 `study_sessions` → `active_study_sessions`로 변경. 그 외 변경 없음 — "휴지통" 퀵액션은 이미 `/trash`로 연결돼 있다.

**`src/components/Trash.js`** (휴지통 목록 — Figma 스캐폴드 전면 교체)
- 마운트 시: `purgeExpiredSessions(userId)` 먼저 호출 → 이후 `study_sessions`에서 `user_id` + `deleted_at is not null` 조회, `deleted_at` 최신순 정렬
- `Save.js`와 동일한 리스트 패턴(날짜·지속시간·점수) + `daysUntilPurge`로 계산한 "n일 후 자동 삭제" 표시
- 항목 클릭 → `/trashread?session=<id>`
- 빈 상태: "휴지통이 비어 있습니다"

**`src/components/Trashread.js`** (휴지통 상세 — Figma 스캐폴드 전면 교체)
- `study_sessions`에서 해당 id + `user_id` + `deleted_at is not null` 조회 (RLS로 본인 것만)
- `Read.js`와 동일한 점수+시간대별 그래프 표시
- "복구" 버튼 → `restoreSession(id)` → `/save`로 즉시 이동 (확인 단계 없음)
- "영구삭제" 버튼 → 첫 클릭 시 버튼 라벨이 "정말 삭제하려면 다시 클릭"으로 바뀌며 danger 스타일로 전환(로컬 state, 모달/`confirm()` 없음) → 같은 버튼 두 번째 클릭에 `hardDeleteSession(id)` 실행 → `/trash`로 이동. 확인 상태는 별도 타임아웃으로 되돌리지 않고, 페이지를 벗어나기 전까지 유지
- 대상 세션이 없거나(잘못된 id), 이미 복구·영구삭제된 경우 "찾을 수 없습니다" (`Read.js`의 `notFound` 패턴과 동일)

### 신규 파일
- `src/lib/trash.js` / `src/lib/trash.test.js` — 위 공유 로직
- `supabase/migrations/<timestamp>_add_trash_to_study_sessions.sql`

## 화면 흐름

1. `/save` 목록 또는 `/read` 상세에서 "삭제" 클릭 → `softDeleteSession` → 해당 화면에서 즉시 사라짐, `/save`로 남음(또는 이동)
2. Mypage "휴지통" 클릭 → `/trash` → 만료분 자동 정리 후 삭제된 세션 목록 표시
3. 목록 항목 클릭 → `/trashread?session=<id>`
4. "복구" 클릭 → 즉시 `deleted_at` null 처리 → `/save`로 이동, 목록에 다시 나타남
5. "영구삭제" 두 번 클릭 → 행 삭제 → `/trash`로 이동

## 에러 처리

- 삭제/복원/영구삭제 Supabase 호출 실패: 인라인 에러 메시지 + 재시도 버튼(`role="alert"`, 파이프라인 스펙의 저장 실패 패턴과 동일). 옵티미스틱으로 제거했던 로컬 state는 롤백.
- `purgeExpiredSessions` 실패: 조용히 무시하고 목록 조회는 정상 진행한다 — 정리 실패가 조회 자체를 막으면 안 되며, 다음 방문 때 다시 시도된다.
- 다른 사용자의 세션 id로 `/trashread?session=` 접근: RLS로 애초에 조회되지 않아 자연히 notFound로 처리됨.

## 범위 밖 (명시적 제외)

- 휴지통 다건 선택/일괄 복원·삭제 — 이번엔 단건 액션만 지원
- pg_cron 등 서버 사이드 스케줄링 — lazy 방식만 사용
- 삭제 취소(undo 토스트) — "삭제" 클릭은 즉시 휴지통행, 되돌리려면 `/trash`를 통해 복원해야 함
- AI 채팅 — 별도 서브프로젝트

## 검증

- `/save`에서 세션 삭제 → 목록에서 즉시 사라지고, `/trash`에 나타나는지 확인
- `/trash`에서 항목 클릭 → `/trashread`에서 점수·그래프가 정상 표시되는지 확인
- "복구" 클릭 → `/save`에 다시 나타나고 `/trash`에서 사라지는지 확인
- "영구삭제" 첫 클릭에 확인 상태로 바뀌고, 두 번째 클릭에 Supabase에서 행이 실제로 삭제되는지 확인
- Supabase 대시보드에서 임의 행의 `deleted_at`을 31일 전으로 수정한 뒤 `/trash` 재방문 → 자동으로 사라지는지(lazy purge) 확인
- 다른 계정으로 로그인해 서로의 휴지통이 안 보이는지(RLS) 확인
- `npm run build` 컴파일 성공
- `daysUntilPurge` 단위 테스트 통과
