-- Phase 3 동기부여: 그룹 활동 피드 + 주간 통계 RPC.
--
-- 학생 RLS는 자기 데이터만 보이므로(0002), 멤버끼리 서로의 완성/합격 소식을 보려면
-- SECURITY DEFINER 함수가 필요하다. 노출 범위는 함수가 반환하는 컬럼으로 고정한다:
-- 이름·곡명·시각·개수만 반환하고, 영상 경로/코멘트/판정 내용은 절대 반환하지 않는다.

-- 1) 그룹 활동 피드: 최근 포도송이 완성 + 포도알 합격 이벤트 (같은 학원만)
create or replace function get_group_feed(p_days int default 7, p_limit int default 30)
returns table (
  event_type   text,        -- 'card_completed' | 'grape_approved'
  student_id   uuid,
  student_name text,
  song_title   text,
  happened_at  timestamptz
)
language sql stable security definer set search_path = public as
$$
  select ev.event_type, ev.student_id, ev.student_name, ev.song_title, ev.happened_at
  from (
    select 'card_completed'::text as event_type,
           c.student_id, p.display_name as student_name,
           c.title as song_title, c.completed_at as happened_at
    from progress_cards c
    join profiles p on p.id = c.student_id
    where c.academy_id = auth_academy_id()
      and c.completed_at is not null
      and c.completed_at > now() - make_interval(days => greatest(1, least(p_days, 30)))
    union all
    select 'grape_approved',
           s.student_id, p.display_name,
           c.title, s.reviewed_at
    from submissions s
    join progress_cards c on c.id = s.card_id
    join profiles p on p.id = s.student_id
    where s.academy_id = auth_academy_id()
      and s.status = 'approved'
      and s.reviewed_at is not null
      and s.reviewed_at > now() - make_interval(days => greatest(1, least(p_days, 30)))
  ) ev
  order by ev.happened_at desc
  limit greatest(1, least(p_limit, 100));
$$;

revoke all on function get_group_feed(int, int) from public;
revoke all on function get_group_feed(int, int) from anon;
grant execute on function get_group_feed(int, int) to authenticated;

-- 2) 주간 통계: 멤버별 이번 주(월요일 시작, KST) 제출/합격 수 + 마지막 제출 시각.
--    학생 홈의 "이번 주 연습왕"과 리더의 주간 통계 화면이 함께 쓴다.
create or replace function get_weekly_stats()
returns table (
  student_id        uuid,
  student_name      text,
  submitted_week    int,
  approved_week     int,
  last_submitted_at timestamptz
)
language sql stable security definer set search_path = public as
$$
  select p.id, p.display_name,
         count(s.id) filter (
           where (s.created_at at time zone 'Asia/Seoul')
             >= date_trunc('week', now() at time zone 'Asia/Seoul')
         )::int,
         count(s.id) filter (
           where s.status = 'approved' and s.reviewed_at is not null
             and (s.reviewed_at at time zone 'Asia/Seoul')
             >= date_trunc('week', now() at time zone 'Asia/Seoul')
         )::int,
         max(s.created_at)
  from profiles p
  left join submissions s on s.student_id = p.id
  where p.academy_id = auth_academy_id() and p.role = 'student'
  group by p.id, p.display_name
  order by 3 desc, 2;
$$;

revoke all on function get_weekly_stats() from public;
revoke all on function get_weekly_stats() from anon;
grant execute on function get_weekly_stats() to authenticated;
