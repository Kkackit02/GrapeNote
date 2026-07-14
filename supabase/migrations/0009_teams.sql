-- 팀(그룹) + 파트장
create table teams (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id),
  name       text not null,
  leader_id  uuid references profiles(id) on delete set null, -- 파트장(학생). 팀원 중에서 지정
  created_at timestamptz not null default now()
);

alter table profiles add column team_id uuid references teams(id) on delete set null;
create index profiles_team_idx on profiles(team_id);

alter table teams enable row level security;

-- teams: 같은 학원이면 조회 가능 (학생도 자기 팀/파트장을 확인). 쓰기는 선생님만.
create policy teams_select on teams for select
  using (academy_id = auth_academy_id());
create policy teams_teacher_insert on teams for insert
  with check (academy_id = auth_academy_id() and auth_role() = 'teacher');
create policy teams_teacher_update on teams for update
  using (academy_id = auth_academy_id() and auth_role() = 'teacher')
  with check (academy_id = auth_academy_id() and auth_role() = 'teacher');
create policy teams_teacher_delete on teams for delete
  using (academy_id = auth_academy_id() and auth_role() = 'teacher');

-- 파트장 여부 판별. RLS 정책 안에서 profiles/teams를 참조하면 해당 테이블의
-- RLS가 다시 적용되어 순환하므로 security definer로 우회한다.
create or replace function is_team_leader_of(target uuid) returns boolean
language sql stable security definer set search_path = public as
$$
  select exists (
    select 1
    from profiles p
    join teams t on t.id = p.team_id
    where p.id = target
      and t.leader_id = auth.uid()
      and t.academy_id = ((auth.jwt() -> 'app_metadata') ->> 'academy_id')::uuid
  )
$$;

-- 파트장은 팀원의 프로필(이름)·진도카드·제출물을 볼 수 있다
create policy profiles_select_leader on profiles for select
  using (is_team_leader_of(id));
create policy cards_select_leader on progress_cards for select
  using (is_team_leader_of(student_id));
create policy submissions_select_leader on submissions for select
  using (is_team_leader_of(student_id));

-- 파트장은 팀원의 제출을 판정할 수 있다. 단 자기 제출은 불가(셀프 합격 차단).
-- 주의: 이 정책은 0010에서 SECURITY DEFINER 함수로 교체된다 (컬럼 조작 취약점 수정).
create policy submissions_update_leader on submissions for update
  using (student_id <> auth.uid() and is_team_leader_of(student_id))
  with check (student_id <> auth.uid() and is_team_leader_of(student_id));
