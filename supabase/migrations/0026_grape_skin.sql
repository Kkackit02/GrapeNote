-- 포도알 스킨: 멤버가 고른 합격 포도알 색을 프로필에 저장한다.
-- 값은 앱의 스킨 id 문자열(예: 'violet','flame','rainbow'). 기본은 'violet'.
-- 쓰기는 서버 액션(service role)이 잠금 해제 여부를 검증한 뒤 수행한다 — 컬럼 grant 없음.

alter table public.profiles
  add column if not exists grape_skin text not null default 'violet';
