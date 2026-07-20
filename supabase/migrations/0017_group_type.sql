-- 공개 서비스 기반: 그룹 유형 (화면 용어 프리셋의 기준).
-- academy(학원: 선생님/학생) · club(동아리·밴드: 운영진/멤버) · other(그룹: 리더/멤버)
-- DB 스키마 용어(academies, teacher role 등)는 그대로 두고 화면 표기만 바꾼다.

alter table public.academies
  add column if not exists group_type text not null default 'academy';

alter table public.academies drop constraint if exists academies_group_type_check;
alter table public.academies
  add constraint academies_group_type_check
  check (group_type in ('academy', 'club', 'other'));
