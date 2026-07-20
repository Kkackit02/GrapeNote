-- 웹푸시 알림: 브라우저 푸시 구독 저장.
-- 새 제출 → 검토자(선생님·파트장), 판정 → 멤버, 포도송이 완성 → 그룹.

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_profile_idx
  on public.push_subscriptions(profile_id);

alter table public.push_subscriptions enable row level security;

-- 본인 구독만 다룬다 (남의 기기로 알림을 보내거나 엔드포인트를 볼 수 없다).
-- 발송은 service role이 하므로 select 정책은 본인 것만으로 충분하다.
create policy push_select on public.push_subscriptions for select
  using (profile_id = auth.uid());
create policy push_insert on public.push_subscriptions for insert
  with check (profile_id = auth.uid() and academy_id = public.auth_academy_id());
create policy push_delete on public.push_subscriptions for delete
  using (profile_id = auth.uid());
