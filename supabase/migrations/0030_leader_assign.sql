-- 파트장 숙제 배정 허용: 리더가 켜면 파트장(세션장)이 자기 팀원에게 숙제를 낼 수 있다.
-- 기본은 꺼짐. 실제 배정은 서버 액션이 '허용됨 + 내가 파트장 + 대상이 내 팀원'을
-- 검증한 뒤 service role로 수행한다 (카드 insert RLS는 여전히 리더 전용).

alter table public.academies
  add column if not exists leaders_can_assign boolean not null default false;
