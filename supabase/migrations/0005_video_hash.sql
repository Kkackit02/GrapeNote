-- 같은 영상 재탕 방지: 파일 SHA-256 해시를 저장하고 학생별로 중복 제출을 차단
alter table submissions add column video_hash text;

create unique index submissions_unique_video_per_student
  on submissions(student_id, video_hash)
  where video_hash is not null;
