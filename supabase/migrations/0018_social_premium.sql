-- 응원 리액션 + 멤버 현황 공개 토글 + 그룹 프리미엄 토글

-- 1) 그룹 설정 컬럼
alter table public.academies add column if not exists show_board boolean not null default false;
alter table public.academies add column if not exists is_premium boolean not null default false;

-- is_premium은 결제/운영자만 바꾼다 — 컬럼 권한으로 API 수정 차단
-- (RLS update 정책은 행 단위라 컬럼을 못 가리므로 grant를 컬럼 목록으로 좁힌다)
revoke update on public.academies from authenticated;
grant update (name, join_code, group_type, show_board) on public.academies to authenticated;

-- 2) 응원 리액션: 피드의 합격(submission)/완성(card) 이벤트에 이모지로 응원
create table if not exists public.feed_reactions (
  id           uuid primary key default gen_random_uuid(),
  academy_id   uuid not null references public.academies(id) on delete cascade,
  target_kind  text not null check (target_kind in ('submission', 'card')),
  target_id    uuid not null,
  reactor_id   uuid not null references public.profiles(id) on delete cascade,
  reactor_name text not null,
  emoji        text not null check (emoji in ('🔥', '👏', '🎉', '💜')),
  created_at   timestamptz not null default now(),
  unique (target_kind, target_id, reactor_id, emoji)
);
create index if not exists feed_reactions_target_idx on public.feed_reactions(target_id);

alter table public.feed_reactions enable row level security;
create policy reactions_select on public.feed_reactions for select
  using (academy_id = public.auth_academy_id());
create policy reactions_insert on public.feed_reactions for insert
  with check (academy_id = public.auth_academy_id() and reactor_id = auth.uid());
create policy reactions_delete on public.feed_reactions for delete
  using (reactor_id = auth.uid());

-- 3) 피드 v2: 리액션 대상 id 포함 (반환 타입이 바뀌므로 drop 후 재생성)
drop function if exists public.get_group_feed(int, int);
create function public.get_group_feed(p_days int default 7, p_limit int default 30)
returns table (
  event_type   text,        -- 'card_completed' | 'grape_approved'
  target_kind  text,        -- 'card' | 'submission' (리액션 앵커)
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
           c.title as song_title, c.completed_at as happened_at
    from progress_cards c
    join profiles p on p.id = c.student_id
    where c.academy_id = auth_academy_id()
      and c.completed_at is not null
      and c.completed_at > now() - make_interval(days => greatest(1, least(p_days, 30)))
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

-- 4) 멤버용 현황판: 리더가 공개(show_board)했을 때만 결과를 돌려준다.
--    영상/코멘트는 노출하지 않고 곡×멤버별 개수만 반환한다.
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
    and exists (select 1 from academies a
      where a.id = auth_academy_id() and a.show_board);
$$;

revoke all on function public.get_group_board() from public;
revoke all on function public.get_group_board() from anon;
grant execute on function public.get_group_board() to authenticated;

-- 5) 프리미엄 720p 녹화 대비: videos 버킷 파일 상한 50MB → 200MB
--    (그룹 총량은 앱의 저장 한도(무료 500MB/프리미엄 5GB)가 막는다)
update storage.buckets set file_size_limit = 209715200 where id = 'videos';
