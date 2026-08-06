-- supabase/migrations/20260806130000_chat_messages_conversation_id_not_null.sql
--
-- ⚠️ 이 마이그레이션은 새 ai-chat Edge Function이 배포된 "이후"에만 적용한다.
-- OLD Edge Function이 아직 배포된 상태에서 이 마이그레이션을 먼저 적용하면,
-- OLD 함수는 conversation_id 없이 chat_messages를 insert하므로 모든 사용자의
-- 모든 메시지 전송이 즉시 not null 제약 위반(500)으로 실패한다.
--
-- 배포 순서: 20260806120000 적용 → 새 Edge Function 배포 → (배포 공백 동안
-- 쌓인 conversation_id가 NULL인 행이 있는지 재확인하고 있으면 먼저 백필) →
-- 이 마이그레이션 적용.

do $$
declare
  orphan_count bigint;
begin
  select count(*) into orphan_count
  from chat_messages
  where conversation_id is null;

  if orphan_count > 0 then
    raise exception
      'chat_messages에 conversation_id가 NULL인 행이 %건 있습니다. '
      'not null 제약을 걸기 전에 먼저 이 행들을 올바른 대화로 백필하세요.',
      orphan_count;
  end if;
end $$;

alter table chat_messages
  alter column conversation_id set not null;
