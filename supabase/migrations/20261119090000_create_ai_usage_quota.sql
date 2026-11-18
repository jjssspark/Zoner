-- supabase/migrations/20261119090000_create_ai_usage_quota.sql
--
-- AI 호출 사용량을 하루 단위로 센다.
--
-- 왜 테이블을 따로 두는가.
--   1) ai-chat은 chat_messages의 행을 세어 제한했다. 세는 것과 넣는 것이 두 번의
--      왕복이라, 동시에 들어온 요청들이 전부 "아직 한도 아래"를 보고 통과한다.
--   2) 리포트 조언(report-insight)은 아무 행도 남기지 않는 호출이라 셀 대상이 없다.
--      그래서 제한이 아예 없었고, 로그인만 하면 Anthropic API를 무제한으로 쓸 수 있었다.
--
-- 하루 경계는 KST다. Edge Function의 startOfTodayKST와 같은 기준이어야 한다.

create table ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  kind text not null check (kind in ('chat', 'report')),
  used int not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date, kind)
);

alter table ai_usage enable row level security;

-- 정책을 하나도 만들지 않는다. RLS가 켜진 테이블에 정책이 없으면 클라이언트는
-- select도 insert도 할 수 없다. 이 테이블은 Edge Function(service_role)만 만진다.
-- 사용자가 자기 사용량을 직접 지우거나 고칠 수 있으면 제한이 의미를 잃는다.

-- 한도를 확인하고 1을 더하는 일을 한 문장 안에서 끝낸다.
-- on conflict ... do update 는 충돌한 행에 잠금을 잡으므로, 동시에 들어온
-- 요청들은 줄을 서서 차례로 used 를 읽는다. 세고 나서 넣는 두 단계가 아니다.
--
-- 반환값: 증가한 뒤의 used. 한도에 걸리면 do update 의 where 가 거짓이 되어
--        갱신도 반환도 일어나지 않으므로 NULL 이 나온다. 호출 쪽은 NULL 을
--        "거절"로 읽는다.
create or replace function consume_ai_quota(
  p_user_id uuid,
  p_kind text,
  p_limit int
)
returns int
language sql
security definer
set search_path = public
as $$
  -- values 가 아니라 select ... where 인 이유: p_limit 이 0 이하일 때
  -- 첫 호출(insert 경로)이 한도 검사를 건너뛰고 통과하는 것을 막는다.
  insert into ai_usage (user_id, usage_date, kind, used, updated_at)
  select p_user_id, (now() at time zone 'Asia/Seoul')::date, p_kind, 1, now()
  where p_limit > 0
  on conflict (user_id, usage_date, kind) do update
    set used = ai_usage.used + 1,
        updated_at = now()
    where ai_usage.used < p_limit
  returning used;
$$;

-- 모델을 부르기 전에 차감하므로, 모델에 닿지도 못한 실패는 돌려준다.
-- (자정을 넘겨 환불하면 다음 날 칸을 깎지만, 그 경계에 걸릴 확률과
--  복잡도를 맞바꿨다. used 는 0 아래로 내려가지 않는다.)
create or replace function refund_ai_quota(p_user_id uuid, p_kind text)
returns void
language sql
security definer
set search_path = public
as $$
  update ai_usage
  set used = greatest(used - 1, 0),
      updated_at = now()
  where user_id = p_user_id
    and usage_date = (now() at time zone 'Asia/Seoul')::date
    and kind = p_kind;
$$;

-- ⚠️ 이게 빠지면 제한이 통째로 무력해진다.
-- SECURITY DEFINER 함수는 기본적으로 public 이 실행할 수 있다. 그대로 두면
-- 클라이언트가 anon 키로 refund_ai_quota 를 직접 호출해 자기 사용량을 0으로
-- 되돌릴 수 있다. 실행 권한은 Edge Function 이 쓰는 service_role 에만 준다.
revoke all on function consume_ai_quota(uuid, text, int) from public, anon, authenticated;
revoke all on function refund_ai_quota(uuid, text) from public, anon, authenticated;
grant execute on function consume_ai_quota(uuid, text, int) to service_role;
grant execute on function refund_ai_quota(uuid, text) to service_role;
