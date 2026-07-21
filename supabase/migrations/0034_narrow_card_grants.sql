-- progress_cards 컬럼 UPDATE 권한을 다시 좁힌다.
--
-- 0021이 필요한 컬럼만 남기려고 좁혔는데, 0022가 자랑하기 회귀를 고치면서
-- `grant update on progress_cards`(전체 컬럼)로 통째로 되돌려 놓았다.
-- 학생은 UPDATE 정책 자체가 없어(0002 cards_update = teacher 전용) 행을 잡지 못하므로
-- 악용 가능한 취약점은 아니지만, 같은 그룹 리더가 PostgREST로 직접 요청하면
-- 앱이 노출하지 않는 컬럼(student_id로 카드 이전, created_by, shared_at 등)까지
-- 건드릴 수 있다. 최소 권한 원칙으로 되돌린다.
--
-- 앱이 실제로 갱신하는 컬럼만 남긴다:
--   title/description/total_grapes/due_date/completed_at  (카드·곡 수정)
--   closed_at                                             (마감/해제, 0023)
--   team_id                                               (편성 이동)
-- shared_at은 share_completion RPC(security definer)가 담당하므로 grant 불필요.
-- student_id·created_by·academy_id는 생성 시에만 정해진다.

revoke update on public.progress_cards from authenticated;

grant update (
  title,
  description,
  total_grapes,
  due_date,
  completed_at,
  closed_at,
  team_id
) on public.progress_cards to authenticated;
