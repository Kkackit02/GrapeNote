-- 칭호: 멤버가 획득한 도전과제 중 하나를 골라 이름 옆에 단다.
-- 값은 앱의 칭호 id(lib/titles.ts). null이면 칭호 없음.
-- 쓰기는 서버 액션(service role)이 획득 여부를 검증한 뒤 수행 — 컬럼 grant 없음.

alter table public.profiles
  add column if not exists title text;
