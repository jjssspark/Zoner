-- supabase/migrations/20260806120000_create_conversations.sql
--
-- ⚠️ 이 마이그레이션은 딱 한 번만 실행할 수 있다.
-- 아래 백필은 "사용자당 대화가 정확히 하나뿐인 시점"에만 안전하다.
-- 배포된 뒤(사용자가 대화를 여러 개 만든 뒤)에 다시 돌리면 메시지가 엉뚱한
-- 대화에 붙는다. 재실행 금지.

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '새 대화',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table conversations enable row level security;

create index idx_conversations_user_id_updated_at
  on conversations (user_id, updated_at desc);

create policy "conversations_select_own"
  on conversations for select
  using (auth.uid() = user_id);

create policy "conversations_insert_own"
  on conversations for insert
  with check (auth.uid() = user_id);

create policy "conversations_update_own"
  on conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "conversations_delete_own"
  on conversations for delete
  using (auth.uid() = user_id);

-- 컬럼은 nullable로 먼저 추가한다. 백필 전에 not null을 걸면 실패한다.
alter table chat_messages
  add column conversation_id uuid references conversations(id) on delete cascade;

-- 백필: 메시지를 가진 사용자마다 대화 1건 생성 + 기존 메시지 연결.
-- CTE로 INSERT와 UPDATE를 원자적으로 수행하여 대화 오배정 위험 제거.
-- created_at은 그 사용자의 가장 오래된 메시지 시각, updated_at은 가장 최근 메시지 시각.
-- INSERT의 select에도 "이미 대화가 있는 사용자 제외" 가드를 건다. 이 스크립트는
-- 재실행 금지가 원칙이지만, TS-001 우회(Supabase SQL Editor에 문장을 하나씩 입력)로
-- 인해 이 백필 문장만 재실행될 수 있다. 가드가 없으면 재실행마다 사용자당
-- 빈 '이전 대화'가 하나씩 더 생긴다.
with new_conversations as (
  insert into conversations (user_id, title, created_at, updated_at)
  select m.user_id, '이전 대화', min(m.created_at), max(m.created_at)
  from chat_messages m
  where not exists (
    select 1 from conversations c where c.user_id = m.user_id
  )
  group by m.user_id
  returning id, user_id
)
update chat_messages m
set conversation_id = nc.id
from new_conversations nc
where nc.user_id = m.user_id
  and m.conversation_id is null;

create index idx_chat_messages_conversation_id_created_at
  on chat_messages (conversation_id, created_at);

-- conversation_id의 not null 승격은 이 마이그레이션에서 하지 않는다.
-- 이 시점에는 OLD Edge Function이 여전히 배포되어 있고, 그 함수는
-- conversation_id 없이 chat_messages를 insert한다. 여기서 not null을 걸면
-- 모든 사용자의 모든 메시지 전송이 즉시 500으로 실패한다.
-- not null 승격은 새 Edge Function 배포 이후에만 적용해야 하며,
-- supabase/migrations/20260806130000_chat_messages_conversation_id_not_null.sql에서 수행한다.
