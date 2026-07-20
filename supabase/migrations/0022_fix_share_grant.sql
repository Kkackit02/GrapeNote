-- 보안 수정: 0021이 학생에게 자기 카드 update를 열어 준 문제.
--
-- 문제: 0021의 cards_share_self 정책(행: 본인 카드) + authenticated 컬럼 권한
-- (title/total_grapes/completed_at/due_date/team_id)이 겹쳐, 학생이 anon 키 + 자기 JWT로
-- PostgREST에 직접 요청하면 자기 카드를 셀프 완성 처리하거나 곡명·포도알 수를 바꿀 수 있었다.
-- 컬럼 권한은 role(authenticated) 단위라 학생과 선생님을 구분하지 못한다.
--
-- 해결: 학생 update 경로를 없애고, 자랑하기는 SECURITY DEFINER 함수로만 처리한다
-- (create_submission/review_submission과 같은 패턴).

-- 1) 학생 update 정책 제거 → progress_cards update는 다시 선생님(cards_update)만
drop policy if exists cards_share_self on public.progress_cards;

-- 2) 컬럼 권한 원복 (행 제한은 RLS가 담당)
grant update on public.progress_cards to authenticated;

-- 3) 자랑하기 전용 함수: 본인·완성됨·미공개를 함수 안에서 강제하고 shared_at만 건드린다
create or replace function public.share_completion(p_card_id uuid)
returns timestamptz
language plpgsql security definer set search_path = public as
$$
declare
  card progress_cards%rowtype;
  now_ts timestamptz := now();
begin
  select * into card from progress_cards
    where id = p_card_id and student_id = auth.uid();
  if not found then
    raise exception 'card not found or not owned';
  end if;
  if card.completed_at is null then
    raise exception 'card not completed';
  end if;
  if card.shared_at is not null then
    raise exception 'already shared';
  end if;

  update progress_cards set shared_at = now_ts where id = p_card_id;
  return now_ts;
end;
$$;

revoke all on function public.share_completion(uuid) from public;
revoke all on function public.share_completion(uuid) from anon;
grant execute on function public.share_completion(uuid) to authenticated;
