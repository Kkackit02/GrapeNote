-- 곡 중심 개편: 멤버 악기(세션) + 곡별 연습 트랙(MR).

-- 1) 멤버가 맡은 악기 (자유 텍스트, UI는 프리셋 제공).
--    곡 편성 화면의 악기별 그룹핑과 "악기 파트 팀 만들기"(세션장 지정용)의 기준.
alter table profiles add column if not exists instrument text;

-- 2) 곡별 연습 트랙(MR/반주). 곡 정체성은 이 코드베이스 관례대로 (academy_id, 곡명).
--    선생님(리더)이 올리면 "기본 MR", 학생도 자기 연습용을 올려 그룹에 공유할 수 있다.
create table if not exists song_tracks (
  id            uuid primary key default gen_random_uuid(),
  academy_id    uuid not null references academies(id) on delete cascade,
  song_title    text not null,
  uploaded_by   uuid not null references profiles(id) on delete cascade,
  -- 학생 RLS는 남의 profiles를 못 보므로 표시용 이름/역할을 비정규화해 둔다
  uploader_name text not null,
  uploader_role text not null check (uploader_role in ('teacher', 'student')),
  label         text,
  file_path     text not null,
  created_at    timestamptz not null default now()
);
create index if not exists song_tracks_song_idx on song_tracks(academy_id, song_title);

alter table song_tracks enable row level security;

-- 같은 학원(그룹)이면 모두 듣는다
create policy tracks_select on song_tracks for select
  using (academy_id = auth_academy_id());

-- 본인 명의 + 우리 학원 + 경로 접두사 강제 (남의 파일 경로 등록 차단)
create policy tracks_insert on song_tracks for insert
  with check (
    academy_id = auth_academy_id()
    and uploaded_by = auth.uid()
    and file_path like auth_academy_id()::text || '/tracks/%'
  );

-- 내 것은 내가, 선생님은 전부 정리 가능
create policy tracks_delete on song_tracks for delete
  using (
    uploaded_by = auth.uid()
    or (academy_id = auth_academy_id() and auth_role() = 'teacher')
  );

-- 3) 트랙 버킷: private, 20MB, 오디오만. videos 버킷과 같은 잠금 원칙(0003) —
--    업로드/재생 모두 서버 액션이 발급하는 signed URL로만 이뤄진다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tracks', 'tracks', false, 20971520, array['audio/*'])
on conflict (id) do nothing;
