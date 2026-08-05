-- supabase/migrations/20260805120000_create_chat_messages.sql

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;

create index idx_chat_messages_user_id_created_at on chat_messages (user_id, created_at);

create policy "chat_messages_select_own"
  on chat_messages for select
  using (auth.uid() = user_id);

create policy "chat_messages_insert_own"
  on chat_messages for insert
  with check (auth.uid() = user_id);
