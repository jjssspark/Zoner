alter table study_sessions add column deleted_at timestamptz null;

create index idx_study_sessions_user_deleted_at on study_sessions (user_id, deleted_at);

create policy "study_sessions_update_own" on study_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "study_sessions_delete_own" on study_sessions for delete using (auth.uid() = user_id);

create view active_study_sessions with (security_invoker = true) as select * from study_sessions where deleted_at is null;
