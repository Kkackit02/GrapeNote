"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

/** 드라이브 아카이브 연결 해제 — 이미 백업된 파일은 드라이브에 그대로 남는다 */
export async function disconnectDrive(): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "리더 계정으로 로그인해 주세요." };
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("drive_connections")
    .delete()
    .eq("academy_id", user.app_metadata.academy_id);
  if (error) return { ok: false, error: "연결 해제에 실패했어요." };

  revalidatePath("/teacher");
  return { ok: true, data: undefined };
}
