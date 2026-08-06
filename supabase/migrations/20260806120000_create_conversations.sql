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
with new_conversations as (
  insert into conversations (user_id, title, created_at, updated_at)
  select m.user_id, '이전 대화', min(m.created_at), max(m.created_at)
  from chat_messages m
  group by m.user_id
  returning id, user_id
)
update chat_messages m
set conversation_id = nc.id
from new_conversations nc
where nc.user_id = m.user_id
  and m.conversation_id is null;

-- 백필 3: 전부 채워진 것을 전제로 not null 승격 + 조회 인덱스.
alter table chat_messages
  alter column conversation_id set not null;

create index idx_chat_messages_conversation_id_created_at
  on chat_messages (conversation_id, created_at);
