-- supabase/migrations/20260806160000_create_session_videos_bucket.sql
--
-- 학습 영상 저장용 비공개 버킷. 얼굴이 담긴 개인 데이터이므로 공개 URL을
-- 쓰지 않고, 재생 시 createSignedUrl로 1시간짜리 서명 URL을 발급한다.
--
-- 경로 규칙: {user_id}/{session_id}.webm
-- 첫 세그먼트가 user_id인 것이 아래 정책들의 소유자 판별 기준이다.

-- file_size_limit을 명시하지 않으면 프로젝트 기본값(무료 티어 50MB)이 걸린다.
-- 이 기능의 목표치가 400kbps × 45분 ≈ 135MB라 그대로 두면 정작 목표 시나리오가
-- 업로드에 실패한다. 200MB(209715200 B)로 올린다 — src/lib/sessionVideos.js의
-- MAX_VIDEO_BYTES와 같은 값이어야 한다.
--
-- allowed_mime_types는 업로드가 보내는 contentType과 맞아야 한다. 레코더는
-- 'video/webm;codecs=vp8'로 올리는데(RECORDER_MIME_TYPE), Supabase가 코덱
-- 파라미터를 떼고 비교하는지 원문 그대로 비교하는지가 버전에 따라 다르므로
-- 두 형태를 모두 허용한다.
--
-- do nothing이면 이미 버킷이 있을 때 위 한도가 반영되지 않는다. 재실행해도
-- 항상 같은 상태로 끝나도록 do update로 덮어쓴다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-videos',
  'session-videos',
  false,
  209715200,
  array['video/webm', 'video/webm;codecs=vp8']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- create policy는 멱등하지 않다. 재실행할 수 있도록 먼저 지운다.
drop policy if exists "session_videos_select_own" on storage.objects;
drop policy if exists "session_videos_insert_own" on storage.objects;
drop policy if exists "session_videos_update_own" on storage.objects;
drop policy if exists "session_videos_delete_own" on storage.objects;

create policy "session_videos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "session_videos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "session_videos_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "session_videos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'session-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
