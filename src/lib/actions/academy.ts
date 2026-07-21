"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
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

/** 특정 파트장에게 숙제 배정 권한을 주거나 회수한다 — 리더 전용 */
export async function setLeaderAssignPermission(
  profileId: string,
  enabled: boolean
): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "리더 계정으로 로그인해 주세요." };
  }
  const academyId = user.app_metadata.academy_id as string;

  const admin = createSupabaseAdmin();
  // 우리 그룹 멤버인지 확인 후에만 변경
  const { data: target } = await admin
    .from("profiles")
    .select("id, academy_id, role")
    .eq("id", profileId)
    .maybeSingle();
  if (!target || target.academy_id !== academyId || target.role !== "student") {
    return { ok: false, error: "우리 그룹 멤버가 아니에요." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ can_assign_homework: enabled })
    .eq("id", profileId);
  if (error) return { ok: false, error: "권한 변경에 실패했어요." };

  revalidatePath("/teacher/settings");
  revalidatePath("/me");
  return { ok: true, data: undefined };
}
