-- 보안 수정 (Finding 2): 미인증 초대코드 검증에 IP 기반 rate limit.
-- 코드공간 무차별 대입으로 학원명/학생명 수집·무단 가입을 막는다.
-- Vercel 서버 액션엔 기본 rate limit이 없으므로 DB에 고정 윈도우 카운터를 둔다.

create table auth_rate_limits (
  key          text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);

-- true = 허용, false = 한도 초과. service role(서버 액션)만 호출한다.
create or replace function hit_rate_limit(
  p_key            text,
  p_limit          int,
  p_window_seconds int
) returns boolean
language plpgsql security definer set search_path = public as
$$
declare
  v_count int;
  v_start timestamptz;
begin
  insert into auth_rate_limits (key) values (p_key)
    on conflict (key) do nothing;

  select count, window_start into v_count, v_start
    from auth_rate_limits where key = p_key for update;

  -- 윈도우가 지났으면 리셋
  if v_start < now() - make_interval(secs => p_window_seconds) then
    update auth_rate_limits set count = 1, window_start = now() where key = p_key;
    return true;
  end if;

  if v_count >= p_limit then
    return false;
  end if;

  update auth_rate_limits set count = count + 1 where key = p_key;
  return true;
end;
$$;

revoke all on function hit_rate_limit(text, int, int) from public;
revoke all on function hit_rate_limit(text, int, int) from anon;
revoke all on function hit_rate_limit(text, int, int) from authenticated;
-- service role은 모든 함수 실행 권한을 가지므로 별도 grant 불필요.

-- 접근 차단 (service role만 사용)
alter table auth_rate_limits enable row level security;
