-- 팀 다중 소속 전환: profiles.team_id (학생당 1팀) → team_members (M:N).
-- 학생 1명이 팀 1, 2에 동시에 속할 수 있다 (예: 곡별 합주 편성).

create table team_members (
  team_id    uuid not null references teams(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  academy_id uuid not null references academies(id), -- RLS 단순화용 비정규화
  added_at   timestamptz not null default now(),
  primary key (team_id, profile_id)
);
create index team_members_profile_idx on team_members(profile_id);

-- 기존 단일 소속 데이터 이전
insert into team_members (team_id, profile_id, academy_id)
select team_id, id, academy_id from profiles where team_id is not null;

alter table team_members enable row level security;

-- 같은 학원이면 명단 조회 가능 (teams_select와 동일 철학 — 학생도 팀 명단 확인)
create policy team_members_select on team_members for select
  using (academy_id = auth_academy_id());
-- 쓰기는 선생님만
create policy team_members_teacher_insert on team_members for insert
  with check (academy_id = auth_academy_id() and auth_role() = 'teacher');
create policy team_members_teacher_delete on team_members for delete
  using (academy_id = auth_academy_id() and auth_role() = 'teacher');

-- 파트장 판별을 M:N 기준으로 교체.
-- 이 함수를 쓰는 곳: 파트장 RLS(profiles/cards/submissions select, 0009)와
-- 판정 RPC review_submission(0010) — 함수만 바꾸면 전부 M:N으로 동작한다.
create or replace function is_team_leader_of(target uuid) returns boolean
language sql stable security definer set search_path = public as
$$
  select exists (
    select 1
    from team_members m
    join teams t on t.id = m.team_id
    where m.profile_id = target
      and t.leader_id = auth.uid()
      and t.academy_id = ((auth.jwt() -> 'app_metadata') ->> 'academy_id')::uuid
  )
$$;

-- 단일 소속 컬럼 제거
alter table profiles drop column team_id;
