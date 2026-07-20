-- 숙제 마감: 리더가 마감하면 멤버 화면에서 사라지고 더 이상 제출할 수 없다.
-- (기록은 그대로 남고, 마감 시 지난 제출은 드라이브로 자동 백업된다 — 앱에서 처리)

alter table public.progress_cards add column if not exists closed_at timestamptz;

-- 마감된 카드에는 제출할 수 없다 (RPC가 DB 레벨에서 막는다)
create or replace function public.create_submission(
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

  -- 마감된 숙제 (0023)
  if card.closed_at is not null then
    raise exception 'card closed';
  end if;

  -- 포도알 인덱스 범위
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

  -- 경로 접두사 검증: {academy}/{uid}/{card}/{grape}- 형식만 허용
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

revoke all on function public.create_submission(uuid, int, text, bigint, text, text, text) from public;
revoke all on function public.create_submission(uuid, int, text, bigint, text, text, text) from anon;
grant execute on function public.create_submission(uuid, int, text, bigint, text, text, text) to authenticated;

-- 마감된 숙제는 그룹 피드에도 새로 오르지 않는다 (완성 자랑은 마감 전까지)
-- get_group_feed는 shared_at 기준이라 그대로 두어도 이미 자랑한 건 남는다.
