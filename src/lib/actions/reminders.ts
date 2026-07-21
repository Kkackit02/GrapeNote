"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

/**
 * 연습 리마인더 요일 설정 — 리더 전용.
 * days: KST 요일 번호(0=일~6=토) 배열. 빈 배열이면 리마인더를 끈다(null 저장).
 */
export async function setReminderDays(days: number[]): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "리더 계정으로 로그인해 주세요." };
  }

  const clean = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  const value = clean.length > 0 ? clean.join(",") : null;

  const { error } = await createSupabaseAdmin()
    .from("academies")
    .update({ reminder_days: value })
    .eq("id", user.app_metadata.academy_id);
  if (error) return { ok: false, error: "리마인더 설정에 실패했어요." };

  revalidatePath("/teacher/settings");
  return { ok: true, data: undefined };
}
