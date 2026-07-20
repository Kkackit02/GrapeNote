-- 포도송이 완성 공개는 본인 선택 (2026-07-20 사용자 요청).
-- 완성해도 자동으로 그룹에 알리지 않고, 멤버가 "자랑하기"를 눌러야 피드·알림에 올라간다.

alter table public.progress_cards add column if not exists shared_at timestamptz;

-- 본인 카드의 공개 여부만 바꿀 수 있게 update 정책 추가 (다른 컬럼은 컬럼 권한으로 제한)
drop policy if exists cards_share_self on public.progress_cards;
create policy cards_share_self on public.progress_cards for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

revoke update on public.progress_cards from authenticated;
grant update (shared_at) on public.progress_cards to authenticated;
-- 선생님용 카드 수정은 별도 컬럼 권한으로 유지 (RLS cards_update가 행을 제한)
grant update (title, description, total_grapes, due_date, completed_at, team_id)
  on public.progress_cards to authenticated;

-- 피드 v3: 완성 이벤트는 공개(shared_at)된 것만, 시각도 공개 시점 기준
drop function if exists public.get_group_feed(int, int);
create function public.get_group_feed(p_days int default 7, p_limit int default 30)
returns table (
  event_type   text,
  target_kind  text,
  target_id    uuid,
  student_id   uuid,
  student_name text,
  song_title   text,
  happened_at  timestamptz
)
language sql stable security definer set search_path = public as
$$
  select ev.event_type, ev.target_kind, ev.target_id,
         ev.student_id, ev.student_name, ev.song_title, ev.happened_at
  from (
    select 'card_completed'::text as event_type, 'card'::text as target_kind, c.id as target_id,
           c.student_id, p.display_name as student_name,
           c.title as song_title, c.shared_at as happened_at
    from progress_cards c
    join profiles p on p.id = c.student_id
    where c.academy_id = auth_academy_id()
      and c.completed_at is not null
      and c.shared_at is not null   -- 본인이 자랑하기를 누른 것만 공개
      and c.shared_at > now() - make_interval(days => greatest(1, least(p_days, 30)))
    union all
    select 'grape_approved', 'submission', s.id,
           s.student_id, p.display_name, c.title, s.reviewed_at
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

revoke all on function public.get_group_feed(int, int) from public;
revoke all on function public.get_group_feed(int, int) from anon;
grant execute on function public.get_group_feed(int, int) to authenticated;
