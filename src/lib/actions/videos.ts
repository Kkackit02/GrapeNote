"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

const MAX_BATCH = 50;

async function verifyTeacher(): Promise<
  { ok: true; academyId: string } | { ok: false; error: string }
> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "리더 계정으로 로그인해 주세요." };
  }
  return { ok: true, academyId: user.app_metadata.academy_id };
}

export async function purgeSubmissions(
  ids: string[]
): Promise<ActionResult<{ purged: number; skippedPending: number }>> {
  const auth = await verifyTeacher();
  if (!auth.ok) return auth;
  const targetIds = [...new Set(ids)].slice(0, MAX_BATCH);
  if (targetIds.length === 0) return { ok: false, error: "정리할 영상을 선택해 주세요." };

  const admin = createSupabaseAdmin();
  const { data: subs } = await admin
    .from("submissions")
    .select("id, video_path, status")
    .in("id", targetIds)
    .eq("academy_id", auth.academyId)
    .is("video_deleted_at", null);
  const rows = subs ?? [];
  const targets = rows.filter((sub) => sub.status !== "pending");
  const skippedPending = rows.length - targets.length;
  if (targets.length === 0) {
    return { ok: false, error: "정리할 대상이 없어요 (검토 대기 영상은 정리할 수 없어요)." };
  }

  const paths = targets.map((sub) => sub.video_path).filter(Boolean);
  if (paths.length > 0) {
    const { error } = await admin.storage.from("videos").remove(paths);
    if (error) return { ok: false, error: "파일 정리에 실패했어요." };
  }
  await admin
    .from("submissions")
    .update({ video_deleted_at: new Date().toISOString() })
    .in("id", targets.map((sub) => sub.id));

  revalidatePath("/teacher/videos");
  revalidatePath("/teacher");
  return { ok: true, data: { purged: targets.length, skippedPending } };
}
