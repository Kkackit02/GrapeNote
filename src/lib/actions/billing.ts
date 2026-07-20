"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PREMIUM_MONTHLY_PRICE } from "@/lib/limits";
import type { ActionResult } from "@/lib/types";

/**
 * 프리미엄 업그레이드 문의를 남긴다.
 * 결제 연동 전이라 실제 결제는 일어나지 않고, 운영자가 확인 후 수동으로 켜 준다.
 * (연동 후에는 이 레코드가 그대로 주문이 되고 웹훅이 paid로 바꾼다)
 */
export async function requestPremium(input: {
  months: number;
  contact: string;
  memo?: string;
}): Promise<ActionResult> {
  const months = Math.min(12, Math.max(1, Math.round(input.months)));
  const contact = input.contact.trim();
  if (!contact) {
    return { ok: false, error: "연락받을 이메일이나 연락처를 남겨 주세요." };
  }

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "리더 계정으로 로그인해 주세요." };
  }

  // 같은 그룹에 아직 처리되지 않은 문의가 있으면 중복 접수하지 않는다
  const { data: open } = await supabase
    .from("premium_orders")
    .select("id")
    .in("status", ["inquiry", "pending"])
    .limit(1);
  if ((open ?? []).length > 0) {
    return { ok: false, error: "이미 접수된 문의가 있어요. 확인 후 연락드릴게요!" };
  }

  const { error } = await supabase.from("premium_orders").insert({
    academy_id: user.app_metadata.academy_id,
    requested_by: user.id,
    status: "inquiry",
    months,
    amount: months * PREMIUM_MONTHLY_PRICE,
    contact: contact.slice(0, 200),
    memo: input.memo?.trim().slice(0, 500) || null,
  });
  if (error) return { ok: false, error: "문의 접수에 실패했어요. 잠시 후 다시 시도해 주세요." };

  revalidatePath("/teacher/premium");
  return { ok: true, data: undefined };
}
