-- supabase/migrations/20260806140000_add_alerts_to_study_sessions.sql
--
-- 세션의 비집중 알림 구간을 저장한다. 기존 세션은 null로 남고, 리포트는
-- null을 렌더링하지 않으므로 깨지지 않는다.

alter table study_sessions add column alerts jsonb;

-- active_study_sessions 뷰는 컬럼을 고정 나열하므로 여기서 함께 갱신해야 한다.
-- focus_breakdown은 20260805150000에서 테이블에 추가됐지만 뷰에는 반영되지 않아
-- 지금까지 화면에서 읽을 수 없었다. alerts와 함께 이번에 노출한다.
--
-- ⚠️ create or replace view는 기존 컬럼의 이름과 순서를 바꿀 수 없다.
-- 새 컬럼은 반드시 기존 목록 "뒤에" 붙인다. 중간에 끼우면 실패한다.
create or replace view active_study_sessions with (security_invoker = true) as
select
  id,
  user_id,
  started_at,
  ended_at,
  duration_seconds,
  focus_score,
  timeline,
  created_at,
  deleted_at,
  focus_breakdown,
  alerts
from study_sessions
where deleted_at is null;
