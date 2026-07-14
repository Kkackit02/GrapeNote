-- 판정 후 30일 지난 영상 파일 자동 정리용 마커.
-- 파일만 삭제되고 판정 기록/코멘트는 영구 보존된다.
alter table submissions add column video_deleted_at timestamptz;

create index submissions_cleanup_idx
  on submissions(reviewed_at)
  where video_deleted_at is null and status in ('approved', 'needs_retry');
