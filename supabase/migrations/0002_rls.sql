-- RLS: role/academy_id는 auth app_metadata(JWT)에서 읽는다.
-- app_metadata는 클라이언트에서 수정 불가하므로 신뢰 가능. DB 조회 없이 판별되어 빠르다.

create or replace function auth_academy_id() returns uuid
language sql stable as
$$ select ((auth.jwt() -> 'app_metadata') ->> 'academy_id')::uuid $$;

create or replace function auth_role() returns text
language sql stable as
$$ select (auth.jwt() -> 'app_metadata') ->> 'role' $$;

alter table academies       enable row level security;
alter table profiles        enable row level security;
alter table student_invites enable row level security;
alter table progress_cards  enable row level security;
alter table submissions     enable row level security;

-- academies: 자기 학원만 조회 (생성은 service role 경유)
create policy academies_select on academies for select
  using (id = auth_academy_id());

-- profiles: 본인 행 + (선생님이면) 같은 학원 전체 조회. 쓰기는 service role 경유.
create policy profiles_select on profiles for select
  using (id = auth.uid() or (academy_id = auth_academy_id() and auth_role() = 'teacher'));

-- student_invites: 선생님만 같은 학원 범위에서 CRUD (학생 가입은 service role 경유)
create policy invites_teacher_all on student_invites for all
  using (academy_id = auth_academy_id() and auth_role() = 'teacher')
  with check (academy_id = auth_academy_id() and auth_role() = 'teacher');

-- progress_cards
create policy cards_select on progress_cards for select
  using ((academy_id = auth_academy_id() and auth_role() = 'teacher') or student_id = auth.uid());
create policy cards_insert on progress_cards for insert
  with check (academy_id = auth_academy_id() and auth_role() = 'teacher' and created_by = auth.uid());
create policy cards_update on progress_cards for update
  using (academy_id = auth_academy_id() and auth_role() = 'teacher')
  with check (academy_id = auth_academy_id() and auth_role() = 'teacher');
create policy cards_delete on progress_cards for delete
  using (academy_id = auth_academy_id() and auth_role() = 'teacher');

-- submissions: 학생은 자기 것 조회 + pending insert만 (셀프 합격 차단), 판정(update)은 선생님만
create policy submissions_select on submissions for select
  using ((academy_id = auth_academy_id() and auth_role() = 'teacher') or student_id = auth.uid());
create policy submissions_insert on submissions for insert
  with check (student_id = auth.uid() and status = 'pending' and academy_id = auth_academy_id());
create policy submissions_update on submissions for update
  using (academy_id = auth_academy_id() and auth_role() = 'teacher')
  with check (academy_id = auth_academy_id() and auth_role() = 'teacher');
