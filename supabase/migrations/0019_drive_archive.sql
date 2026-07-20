-- 구글 드라이브 아카이브: 정리 삭제 직전에 판정 영상을 그룹장 드라이브로 백업.

-- 1) 그룹별 드라이브 연결 (OAuth refresh token — 비밀!)
--    RLS를 켜고 정책을 만들지 않는다 → API로는 아무도 못 읽고 service role만 접근.
create table if not exists public.drive_connections (
  academy_id   uuid primary key references public.academies(id) on delete cascade,
  refresh_token text not null,
  folder_id    text not null,
  connected_by uuid not null references public.profiles(id) on delete cascade,
  connected_at timestamptz not null default now()
);
alter table public.drive_connections enable row level security;

-- 2) 백업된 드라이브 파일 id (정리된 영상이 어디 보관됐는지 표시용)
alter table public.submissions add column if not exists drive_file_id text;
