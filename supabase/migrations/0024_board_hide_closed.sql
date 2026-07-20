-- 멤버용 현황판에서도 마감된 숙제를 감춘다 (0023과 일관되게).
-- 멤버 홈(/me)에서는 이미 감춰지는데 공유 현황판에는 남아 있어 혼란스러웠다.

create or replace function public.get_group_board()
returns table (
  song_title   text,
  student_id   uuid,
  student_name text,
  done         int,
  total        int,
  pending      int,
  retry        int,
  completed    boolean
)
language sql stable security definer set search_path = public as
$$
  select c.title, c.student_id, p.display_name,
    (select count(distinct s.grape_index) from submissions s
      where s.card_id = c.id and s.status = 'approved')::int,
    c.total_grapes,
    (select count(*) from submissions s
      where s.card_id = c.id and s.status = 'pending')::int,
    (select count(distinct s.grape_index) from submissions s
      where s.card_id = c.id and s.status = 'needs_retry'
        and not exists (select 1 from submissions s2
          where s2.card_id = c.id and s2.grape_index = s.grape_index
            and s2.status in ('approved', 'pending')))::int,
    c.completed_at is not null
  from progress_cards c
  join profiles p on p.id = c.student_id
  where c.academy_id = auth_academy_id()
    and c.closed_at is null              -- 마감된 숙제는 제외 (0024)
    and exists (select 1 from academies a
      where a.id = auth_academy_id() and a.show_board);
$$;

revoke all on function public.get_group_board() from public;
revoke all on function public.get_group_board() from anon;
grant execute on function public.get_group_board() to authenticated;
