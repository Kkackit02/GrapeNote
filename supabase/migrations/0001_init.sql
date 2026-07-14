-- GrapeNote 초기 스키마
create type user_role as enum ('teacher', 'student');
create type submission_status as enum ('pending', 'approved', 'needs_retry');

-- 학원 (개인 사용자는 추후 "1인 학원"으로 수용)
create table academies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- 선생님/학생 공용 프로필 (auth.users 1:1)
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  academy_id   uuid not null references academies(id),
  role         user_role not null,
  display_name text not null,
  username     text unique,            -- 학생 로그인 아이디 (teacher는 null)
  created_at   timestamptz not null default now()
);

-- 학생 초대코드
create table student_invites (
  id           uuid primary key default gen_random_uuid(),
  academy_id   uuid not null references academies(id),
  code         text unique not null,   -- 예: 'GRAPE-3F7K'
  student_name text not null,
  created_by   uuid not null references profiles(id),
  used_by      uuid references profiles(id),
  used_at      timestamptz,
  expires_at   timestamptz not null default now() + interval '7 days',
  created_at   timestamptz not null default now()
);

-- 진도카드 (곡 1개 = 카드 1장)
create table progress_cards (
  id           uuid primary key default gen_random_uuid(),
  academy_id   uuid not null references academies(id),
  student_id   uuid not null references profiles(id),
  title        text not null,
  description  text,
  total_grapes int  not null default 30 check (total_grapes between 1 and 60),
  completed_at timestamptz,
  created_by   uuid not null references profiles(id),
  created_at   timestamptz not null default now()
);

-- 영상 제출 = 포도알 채우기 시도. 포도알 상태는 이 테이블에서 유도된다.
create table submissions (
  id               uuid primary key default gen_random_uuid(),
  card_id          uuid not null references progress_cards(id) on delete cascade,
  student_id       uuid not null references profiles(id),
  academy_id       uuid not null references academies(id),  -- RLS 단순화용 비정규화
  grape_index      int  not null check (grape_index >= 1),
  video_path       text not null,
  video_size_bytes bigint,
  status           submission_status not null default 'pending',
  teacher_comment  text,
  reviewed_by      uuid references profiles(id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

-- 상태 머신 불변식: 포도알당 pending 1개, approved 1개(종결 상태)만 허용
create unique index one_pending_per_grape  on submissions(card_id, grape_index) where status = 'pending';
create unique index one_approved_per_grape on submissions(card_id, grape_index) where status = 'approved';

create index submissions_card_idx    on submissions(card_id);
create index submissions_review_idx  on submissions(academy_id, status, created_at);
create index cards_student_idx       on progress_cards(student_id);
create index profiles_academy_idx    on profiles(academy_id);
