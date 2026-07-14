-- 숙제(진도카드) 기한
alter table progress_cards add column due_date date;

-- 학생이 자기 숙제(진도카드)를 직접 추가할 수 있게 허용.
-- update/delete 정책은 선생님 전용 그대로이므로 학생은 추가만 가능하다.
create policy cards_insert_student on progress_cards for insert
  with check (
    academy_id = auth_academy_id()
    and auth_role() = 'student'
    and student_id = auth.uid()
    and created_by = auth.uid()
  );
