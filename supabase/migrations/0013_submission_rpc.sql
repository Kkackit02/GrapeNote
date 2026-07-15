-- 보안 수정 (Finding 1, 6): 제출 생성을 직접 INSERT → SECURITY DEFINER RPC로 교체.
--
-- 문제: 0002의 submissions_insert 정책은 student_id=본인만 확인하고 card_id 소유권을
-- 검증하지 않았다. 학생이 anon 키 + 자기 JWT로 PostgREST에 직접 insert하면 남의 카드에
-- 제출을 주입(진도 오염)하거나 포도알을 pending으로 선점(DoS)할 수 있었다.
-- grape_index 상한(total_grapes)도 검증되지 않았다(Finding 6).

-- 1) 취약한 직접 INSERT 정책 제거 (select/delete 정책은 유지)
drop policy if exists submissions_insert on submissions;

-- 2) 제출 생성 전용 함수: 소유권·포도알 상태·인덱스 범위·경로 접두사를 모두 강제한다.
create or replace function create_submission(
  p_card_id     uuid,
  p_grape_index int,
  p_video_path  text,
  p_video_size  bigint,
  p_video_hash  text,
  p_title       text,
  p_comment     text
) returns uuid
language plpgsql security definer set search_path = public as
$$
declare
  card    progress_cards%rowtype;
  new_id  uuid;
  approved_exists bool;
  pending_exists  bool;
begin
  -- 내 카드인지 (소유권). RLS 우회 함수이므로 여기서 직접 강제한다.
  select * into card from progress_cards
    where id = p_card_id and student_id = auth.uid();
  if not found then
    raise exception 'card not found or not owned';
  end if;

  -- 포도알 인덱스 범위 (Finding 6)
  if p_grape_index < 1 or p_grape_index > card.total_grapes then
    raise exception 'invalid grape index';
  end if;

  -- 포도알 상태: 합격(종결)엔 재제출 불가, 검토 대기 중복 불가
  select exists(select 1 from submissions
    where card_id = p_card_id and grape_index = p_grape_index and status = 'approved')
    into approved_exists;
  if approved_exists then
    raise exception 'grape already approved';
  end if;
  select exists(select 1 from submissions
    where card_id = p_card_id and grape_index = p_grape_index and status = 'pending')
    into pending_exists;
  if pending_exists then
    raise exception 'grape already pending';
  end if;

  -- 경로 접두사 검증: {academy}/{uid}/{card}/{grape}- 형식만 허용 (임의 경로 등록 차단)
  if p_video_path is null or
     p_video_path not like card.academy_id::text || '/' || auth.uid()::text || '/'
       || p_card_id::text || '/' || p_grape_index::text || '-%' then
    raise exception 'invalid video path';
  end if;

  insert into submissions
    (card_id, student_id, academy_id, grape_index, video_path, video_size_bytes,
     video_hash, status, student_title, student_comment)
  values
    (p_card_id, auth.uid(), card.academy_id, p_grape_index, p_video_path, p_video_size,
     nullif(p_video_hash, ''), 'pending',
     nullif(btrim(p_title), ''), nullif(btrim(p_comment), ''))
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function create_submission(uuid, int, text, bigint, text, text, text) from public;
revoke all on function create_submission(uuid, int, text, bigint, text, text, text) from anon;
grant execute on function create_submission(uuid, int, text, bigint, text, text, text) to authenticated;
