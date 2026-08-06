-- supabase/migrations/20260806150000_add_video_path_to_study_sessions.sql
--
-- 학습 영상의 Storage 경로. 영상을 저장하지 않은 세션은 null로 남고,
-- 리포트는 null이면 영상 섹션 자체를 렌더하지 않으므로 깨지지 않는다.

alter table study_sessions add column video_path text null;

-- active_study_sessions 뷰는 컬럼을 고정 나열하므로 여기서 함께 갱신해야 한다.
-- 갱신하지 않으면 저장은 되는데 화면에서 읽을 수 없다 (TS-012).
--
-- ⚠️ create or replace view는 기존 컬럼의 이름과 순서를 바꿀 수 없다.
-- video_path는 반드시 기존 목록 "뒤에" 붙인다.
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
  alerts,
  video_path
from study_sessions
where deleted_at is null;
