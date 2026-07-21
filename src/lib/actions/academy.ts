"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

/** 멤버에게 읽기 전용 현황판 공개/비공개 — 리더 전용 */
export async function setBoardVisibility(visible: boolean): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "리더 계정으로 로그인해 주세요." };
  }

  const { error } = await supabase
    .from("academies")
    .update({ show_board: visible })
    .eq("id", user.app_metadata.academy_id);
  if (error) return { ok: false, error: "설정 변경에 실패했어요." };

  revalidatePath("/teacher");
  revalidatePath("/me");
  return { ok: true, data: undefined };
}

/** 파트장이 자기 팀원에게 숙제를 낼 수 있게 허용/차단 — 리더 전용 */
export async function setLeaderAssign(enabled: boolean): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "리더 계정으로 로그인해 주세요." };
  }

  const { error } = await supabase
    .from("academies")
    .update({ leaders_can_assign: enabled })
    .eq("id", user.app_metadata.academy_id);
  if (error) return { ok: false, error: "설정 변경에 실패했어요." };

  revalidatePath("/teacher/settings");
  revalidatePath("/me");
  return { ok: true, data: undefined };
}
