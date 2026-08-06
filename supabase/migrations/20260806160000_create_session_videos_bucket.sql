-- supabase/migrations/20260806160000_create_session_videos_bucket.sql
--
-- 학습 영상 저장용 비공개 버킷. 얼굴이 담긴 개인 데이터이므로 공개 URL을
-- 쓰지 않고, 재생 시 createSignedUrl로 1시간짜리 서명 URL을 발급한다.
--
-- 경로 규칙: {user_id}/{session_id}.webm
-- 첫 세그먼트가 user_id인 것이 아래 정책들의 소유자 판별 기준이다.

insert into storage.buckets (id, name, public)
values ('session-videos', 'session-videos', false)
on conflict (id) do nothing;

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
