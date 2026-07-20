-- 결제 연동 준비: 구독 만료일 + 업그레이드 문의 기록.
-- 실제 결제(토스페이먼츠 등)는 사업자등록·심사 후 붙인다. 그때 웹훅이
-- premium_orders를 paid로 바꾸고 academies.is_premium/premium_until을 갱신하면 된다.

-- 1) 구독 만료일 (null이면 무기한 — 운영자가 수동으로 켠 경우)
alter table public.academies add column if not exists premium_until timestamptz;

-- 2) 업그레이드 문의 / 주문. 결제 연동 전에는 문의(inquiry)로만 쓰인다.
create table if not exists public.premium_orders (
  id           uuid primary key default gen_random_uuid(),
  academy_id   uuid not null references public.academies(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  /** inquiry(문의) | pending(결제 대기) | paid | canceled */
  status       text not null default 'inquiry'
                 check (status in ('inquiry', 'pending', 'paid', 'canceled')),
  months       int not null default 1 check (months between 1 and 12),
  amount       int not null default 0,
  /** 결제 수단/PG 식별자 (연동 후 사용) */
  provider     text,
  provider_ref text,
  contact      text,
  memo         text,
  created_at   timestamptz not null default now(),
  paid_at      timestamptz
);
create index if not exists premium_orders_academy_idx
  on public.premium_orders(academy_id, created_at desc);

alter table public.premium_orders enable row level security;

-- 리더는 자기 그룹의 문의를 남기고 볼 수 있다. 상태 변경(결제 확정)은 service role만.
create policy orders_select on public.premium_orders for select
  using (academy_id = public.auth_academy_id() and public.auth_role() = 'teacher');
create policy orders_insert on public.premium_orders for insert
  with check (
    academy_id = public.auth_academy_id()
    and public.auth_role() = 'teacher'
    and requested_by = auth.uid()
    and status = 'inquiry'
  );
-- update/delete 정책 없음 → 금액·상태를 클라이언트가 조작할 수 없다
