-- 학원 공용(그룹) 초대코드: 코드 하나로 여러 학생이 가입 (가입 시 본인이 이름 입력)
alter table academies add column join_code text unique;

-- 기존 학원 백필 (형식: CLASS-XXXX). 신규 학원은 앱에서 생성 시 발급.
update academies
set join_code = 'CLASS-' || upper(substr(md5(random()::text || id::text), 1, 4))
where join_code is null;

-- 선생님이 자기 학원의 공용 코드를 재발급할 수 있도록 update 허용
create policy academies_update on academies for update
  using (id = auth_academy_id() and auth_role() = 'teacher')
  with check (id = auth_academy_id() and auth_role() = 'teacher');
