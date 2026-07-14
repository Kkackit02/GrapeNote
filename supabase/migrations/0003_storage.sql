-- 영상 버킷: private, 50MB 제한, video만 허용.
-- Storage RLS 정책은 의도적으로 만들지 않는다(전부 잠금):
--   업로드 = 서버 액션이 발급한 signed upload URL 토큰
--   재생   = 서버 액션이 권한 검증 후 발급하는 signed URL (1시간)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 52428800, array['video/*'])
on conflict (id) do nothing;
