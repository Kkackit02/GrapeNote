-- 파트장 숙제 배정 권한을 '파트장별'로. 리더가 특정 파트장에게만 권한을 준다.
-- (0030의 그룹 전체 토글 leaders_can_assign은 더 쓰지 않는다 — 컬럼은 남겨 둔다)
-- 실제 배정은 서버 액션이 '내 권한 on + 내가 파트장 + 대상이 내 팀원'을 검증한다.

alter table public.profiles
  add column if not exists can_assign_homework boolean not null default false;
