-- 자랑 벽 + 포도알(영상) 자랑.
--
-- B) 자랑 벽: 그룹이 공유(shared_at)한 완성 포도송이를 스킨 색과 함께 모아 본다.
-- C) 영상 자랑: 멤버가 자신 있는 합격 영상 1개를 골라 그룹에 건다.
--    저장공간을 위해 멤버당 1개만 — 새로 걸면 이전 것은 보호가 풀린다.
--    자랑 중인 영상은 야간 정리 크론에서 삭제 제외된다(라우트에서 처리).
--
-- 학생 RLS는 자기 것만 보이므로(0002), 서로의 자랑을 보려면 SECURITY DEFINER 함수로
-- 노출 범위를 고정한다. 영상 경로/코멘트는 반환하지 않는다 — 재생은 별도 액션이 권한을
-- 재확인한 뒤 짧은 signed URL을 발급한다.

-- 멤버가 고른 자랑 영상 (제출 삭제 시 자동으로 null)
alter table public.profiles
  add column if not exists showcase_submission_id uuid
  references public.submissions(id) on delete set null;

create index if not exists profiles_showcase_idx
  on public.profiles(showcase_submission_id)
  where showcase_submission_id is not null;

-- B) 자랑 벽: 공유된 완성 포도송이 (같은 학원만). 스킨·개수까지 반환해 그림으로 건다.
create or replace function get_group_wall(p_limit int default 60)
returns table (
  card_id      uuid,
  student_id   uuid,
  student_name text,
  grape_skin   text,
  song_title   text,
  total_grapes int,
  completed_at timestamptz,
  shared_at    timestamptz
)
language sql stable security definer set search_path = public as
$$
  select c.id, c.student_id, p.display_name, p.grape_skin,
         c.title, c.total_grapes, c.completed_at, c.shared_at
  from progress_cards c
  join profiles p on p.id = c.student_id
  where c.academy_id = auth_academy_id()
    and c.completed_at is not null
    and c.shared_at is not null
  order by c.shared_at desc
  limit greatest(1, least(p_limit, 200));
$$;

revoke all on function get_group_wall(int) from public;
revoke all on function get_group_wall(int) from anon;
grant execute on function get_group_wall(int) to authenticated;

-- C) 자랑 영상 목록: 멤버들이 지금 걸어 둔 합격 영상 (같은 학원, 파일이 남아 있는 것만).
--    video_path는 반환하지 않는다 — 재생 액션이 권한 확인 후 signed URL을 준다.
create or replace function get_group_showcases()
returns table (
  submission_id uuid,
  student_id    uuid,
  student_name  text,
  grape_skin    text,
  song_title    text,
  grape_index   int,
  created_at    timestamptz
)
language sql stable security definer set search_path = public as
$$
  select s.id, s.student_id, p.display_name, p.grape_skin,
         c.title, s.grape_index, s.created_at
  from profiles p
  join submissions s on s.id = p.showcase_submission_id
  join progress_cards c on c.id = s.card_id
  where p.academy_id = auth_academy_id()
    and s.status = 'approved'
    and s.video_deleted_at is null
  order by s.created_at desc;
$$;

revoke all on function get_group_showcases() from public;
revoke all on function get_group_showcases() from anon;
grant execute on function get_group_showcases() to authenticated;
