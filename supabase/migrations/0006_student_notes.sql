-- 학생이 제출에 다는 제목 + 선생님께 보내는 코멘트
alter table submissions add column student_title text;
alter table submissions add column student_comment text;

-- 학생이 자기 "검토 대기" 영상을 삭제(다시 찍기)할 수 있게 허용.
-- 판정이 끝난(approved/needs_retry) 제출은 이력이므로 삭제 불가.
create policy submissions_delete_own_pending on submissions for delete
  using (student_id = auth.uid() and status = 'pending');
