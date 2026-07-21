-- 계정 연결: 같은 사람이 리더 계정과 멤버 계정을 둘 다 가진 경우 서로 연결해
-- 재로그인 없이 원탭으로 전환한다. 양방향(서로가 서로를 가리킴).
--
-- 연결은 상대 계정의 로그인 자격을 증명해야만 걸 수 있고(서버 액션에서 검증),
-- 전환은 연결된 계정으로만 가능하다. 각 계정의 역할(RLS)은 그대로 유지된다.

alter table public.profiles
  add column if not exists linked_account_id uuid
  references public.profiles(id) on delete set null;
