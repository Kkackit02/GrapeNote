-- 팀 숙제: 카드에 팀 연결을 달고, 팀에 새 멤버가 들어오면 그 팀 숙제를 자동 배정한다.

alter table progress_cards add column team_id uuid references teams(id) on delete set null;
create index cards_team_idx on progress_cards(team_id);

-- 새 팀원 합류 시 팀 숙제 자동 배정.
-- 곡(title) 단위로 팀의 카드 템플릿을 골라, 아직 없는 것만 새 멤버에게 생성한다.
-- created_by는 원래 배정한 선생님을 그대로 쓴다.
create or replace function assign_team_cards() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  insert into progress_cards
    (academy_id, student_id, team_id, title, description, total_grapes, due_date, created_by)
  select distinct on (c.title)
    c.academy_id, new.profile_id, c.team_id, c.title, c.description,
    c.total_grapes, c.due_date, c.created_by
  from progress_cards c
  where c.team_id = new.team_id
    and not exists (
      select 1 from progress_cards mine
      where mine.student_id = new.profile_id
        and mine.team_id = c.team_id
        and mine.title = c.title
    )
  order by c.title, c.created_at desc; -- 곡별 최신 배정 기준
  return new;
end;
$$;

create trigger team_member_added
  after insert on team_members
  for each row execute function assign_team_cards();
