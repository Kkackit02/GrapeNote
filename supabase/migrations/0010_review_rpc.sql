-- 보안 수정: 파트장(학생) 제출 판정을 RLS UPDATE 정책 → SECURITY DEFINER 함수로 교체.
--
-- 문제: 0009의 submissions_update_leader 정책은 파트장(student 역할)에게 팀원 제출에
-- 대한 직접 UPDATE를 열어 줬다. Postgres RLS는 "어떤 컬럼을 바꾸는지"를 제한하지 못하고
-- 상태(pending) 조건도 없어서, 파트장이 anon 키 + 자기 JWT로 PostgREST에 직접 요청하면
-- 이미 판정된 제출을 다시 뒤집거나 reviewed_by(선생님 사칭)/video_path/academy_id 등
-- 임의 컬럼을 조작할 수 있었다. 서버 액션의 검증은 우회 가능하므로 DB에서 강제해야 한다.

-- 1) 취약한 직접 UPDATE 정책 제거 (선생님용 submissions_update(0002)는 그대로 둔다)
drop policy if exists submissions_update_leader on submissions;

-- 2) 판정 전용 함수: 상태(pending)·대상 권한·수정 컬럼을 모두 함수 안에서 강제한다.
create or replace function review_submission(
  sub_id  uuid,
  verdict submission_status,
  comment text
) returns uuid
language plpgsql security definer set search_path = public as
$$
declare
  sub          submissions%rowtype;
  caller_role  text := (auth.jwt() -> 'app_metadata') ->> 'role';
  caller_acad  uuid := ((auth.jwt() -> 'app_metadata') ->> 'academy_id')::uuid;
begin
  if verdict not in ('approved', 'needs_retry') then
    raise exception 'invalid verdict';
  end if;

  select * into sub from submissions where id = sub_id;
  if not found then
    raise exception 'submission not found';
  end if;
  if sub.status <> 'pending' then
    raise exception 'already reviewed';
  end if;

  -- 권한: 같은 학원 선생님이거나, 그 학생의 팀 파트장(본인 제출 제외)
  if caller_role = 'teacher' and sub.academy_id = caller_acad then
    null; -- 허용
  elsif sub.student_id <> auth.uid() and is_team_leader_of(sub.student_id) then
    null; -- 허용
  else
    raise exception 'not authorized';
  end if;

  update submissions
    set status          = verdict,
        teacher_comment = comment,
        reviewed_by     = auth.uid(),  -- 호출자 본인으로 고정 (임의 지정 불가)
        reviewed_at     = now()
    where id = sub_id;

  return sub.card_id;
end;
$$;

-- 익명(anon)에게는 실행 권한을 주지 않는다.
revoke all on function review_submission(uuid, submission_status, text) from public;
revoke all on function review_submission(uuid, submission_status, text) from anon;
grant execute on function review_submission(uuid, submission_status, text) to authenticated;
