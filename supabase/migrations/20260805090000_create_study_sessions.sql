-- supabase/migrations/20260805090000_create_study_sessions.sql

create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds int not null,
  focus_score int not null,
  timeline jsonb not null,
  created_at timestamptz not null default now()
);

alter table study_sessions enable row level security;

create policy "study_sessions_select_own"
  on study_sessions for select
  using (auth.uid() = user_id);

create policy "study_sessions_insert_own"
  on study_sessions for insert
  with check (auth.uid() = user_id);
