-- 포도알에 '어떤 악기로 연습했는지'를 남긴다.
-- 악기 전용 스킨은 "그 악기를 맡았는지"가 아니라 "그 악기로 포도알을 몇 개 모았는지"로 열린다
-- → 다른 악기에 도전할 동기가 생긴다.

alter table public.submissions
  add column if not exists instrument text;

-- 기존 제출은 그동안의 연습을 인정해 멤버의 주 세션으로 채운다 (첫 번째 악기)
update public.submissions s
set instrument = nullif(btrim(split_part(p.instrument, ',', 1)), '')
from public.profiles p
where p.id = s.student_id
  and s.instrument is null
  and p.instrument is not null;

create index if not exists submissions_instrument_idx
  on public.submissions(student_id, instrument)
  where status = 'approved';

-- 제출 생성 RPC에 악기 인자 추가 (기존 7-인자 버전은 아래에서 제거)
create or replace function public.create_submission(
  p_card_id     uuid,
  p_grape_index int,
  p_video_path  text,
  p_video_size  bigint,
  p_video_hash  text,
  p_title       text,
  p_comment     text,
  p_instrument  text
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
     video_hash, status, student_title, student_comment, instrument)
  values
    (p_card_id, auth.uid(), card.academy_id, p_grape_index, p_video_path, p_video_size,
     nullif(p_video_hash, ''), 'pending',
     nullif(btrim(p_title), ''), nullif(btrim(p_comment), ''),
     nullif(btrim(p_instrument), ''))
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.create_submission(uuid, int, text, bigint, text, text, text, text) from public;
revoke all on function public.create_submission(uuid, int, text, bigint, text, text, text, text) from anon;
grant execute on function public.create_submission(uuid, int, text, bigint, text, text, text, text) to authenticated;

-- 악기 인자가 없는 구버전은 제거 (호출 모호성 방지)
drop function if exists public.create_submission(uuid, int, text, bigint, text, text, text);
