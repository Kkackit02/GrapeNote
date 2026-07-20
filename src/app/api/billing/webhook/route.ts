import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * 결제 완료 웹훅 (연동 대기 중인 자리).
 *
 * 실제 PG(토스페이먼츠 등)를 붙이면 이 엔드포인트가 결제 승인 결과를 받아
 * 주문을 paid로 바꾸고 그룹 프리미엄을 켠다. 지금은 운영자가 수동 확인 후
 * 같은 시크릿으로 호출해 프리미엄을 켜는 용도로도 쓸 수 있다.
 *
 * body: { orderId: string, months?: number, providerRef?: string }
 * header: authorization: Bearer <BILLING_SECRET>
 */
export async function POST(request: Request) {
  const secret = process.env.BILLING_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: { orderId?: string; months?: number; providerRef?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: order } = await admin
    .from("premium_orders")
    .select("*")
    .eq("id", body.orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });
  if (order.status === "paid") return NextResponse.json({ ok: true, already: true });

  const { data: academy } = await admin
    .from("academies")
    .select("premium_until")
    .eq("id", order.academy_id)
    .maybeSingle();

  // 남은 기간이 있으면 이어서 연장한다
  const base =
    academy?.premium_until && new Date(academy.premium_until).getTime() > Date.now()
      ? new Date(academy.premium_until)
      : new Date();
  const months = body.months ?? order.months ?? 1;
  const until = new Date(base);
  until.setMonth(until.getMonth() + months);

  const { error: academyError } = await admin
    .from("academies")
    .update({ is_premium: true, premium_until: until.toISOString() })
    .eq("id", order.academy_id);
  if (academyError) {
    return NextResponse.json({ error: academyError.message }, { status: 500 });
  }

  await admin
    .from("premium_orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      provider_ref: body.providerRef ?? order.provider_ref,
    })
    .eq("id", order.id);

  return NextResponse.json({ ok: true, premiumUntil: until.toISOString() });
}
