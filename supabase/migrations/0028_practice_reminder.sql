-- 연습 리마인더: 리더가 고른 요일 저녁에, 그날 아직 연습 안 한 멤버에게 넛지 푸시.
--
-- reminder_days: KST 요일 번호(0=일 ~ 6=토) 콤마 목록. 비어 있으면(null) 리마인더 꺼짐.
-- 예: '1,3,5' = 월·수·금. 발송은 매일 저녁 크론(/api/reminders)이 오늘 요일과 대조해 처리.
-- Vercel Hobby 크론은 하루 1회라 "저녁 고정 시간 + 요일 선택" 방식으로 간다.

alter table public.academies
  add column if not exists reminder_days text;
