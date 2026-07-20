"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getAccessToken, uploadToDrive } from "@/lib/google-drive";
import { archiveFileName } from "@/lib/archive";
import type { ActionResult } from "@/lib/types";

const MAX_BATCH = 50;
/** 서버 액션 시간 예산 — 넘으면 나머지는 건너뛰고 개수로 알려준다 */
const TIME_BUDGET_MS = 40_000;

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

/** 선택한 영상들을 지금 즉시 드라이브로 백업한다 (파일은 그대로 유지) */
export async function archiveSubmissions(
  ids: string[]
): Promise<ActionResult<{ archived: number; failed: number; deferred: number }>> {
  const auth = await verifyTeacher();
  if (!auth.ok) return auth;
  const targetIds = [...new Set(ids)].slice(0, MAX_BATCH);
  if (targetIds.length === 0) return { ok: false, error: "백업할 영상을 선택해 주세요." };

  const admin = createSupabaseAdmin();
  const { data: conn } = await admin
    .from("drive_connections")
    .select("*")
    .eq("academy_id", auth.academyId)
    .maybeSingle();
  if (!conn) {
    return { ok: false, error: "구글 드라이브가 연결되어 있지 않아요. 대시보드에서 먼저 연결해 주세요." };
  }

  const { data: subs } = await admin
    .from("submissions")
    .select("id, video_path, card_id, student_id, grape_index, status, created_at, reviewed_at, drive_file_id")
    .in("id", targetIds)
    .eq("academy_id", auth.academyId)
    .is("video_deleted_at", null)
    .neq("status", "pending");
  const targets = (subs ?? []).filter((sub) => !sub.drive_file_id);
  if (targets.length === 0) {
    return { ok: false, error: "백업할 대상이 없어요 (이미 백업됐거나 검토 대기 중이에요)." };
  }

  const [{ data: cards }, { data: profiles }] = await Promise.all([
    admin.from("progress_cards").select("id, title")
      .in("id", [...new Set(targets.map((s) => s.card_id))]),
    admin.from("profiles").select("id, display_name")
      .in("id", [...new Set(targets.map((s) => s.student_id))]),
  ]);
  const titleOf = new Map((cards ?? []).map((c) => [c.id, c.title]));
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const token = await getAccessToken(conn.refresh_token);
  if (!token) return { ok: false, error: "드라이브 인증에 실패했어요. 연결을 해제 후 다시 연결해 주세요." };

  const startedAt = Date.now();
  let archived = 0;
  let failed = 0;
  let deferred = 0;
  for (const sub of targets) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      deferred++;
      continue;
    }
    const { data: blob } = await admin.storage.from("videos").download(sub.video_path);
    if (!blob) {
      failed++;
      continue;
    }
    const fileName = archiveFileName({
      songTitle: titleOf.get(sub.card_id) ?? "곡",
      memberName: nameOf.get(sub.student_id) ?? "멤버",
      grapeIndex: sub.grape_index,
      status: sub.status as "approved" | "needs_retry",
      createdAt: sub.created_at,
      reviewedAt: sub.reviewed_at,
      videoPath: sub.video_path,
    });
    const fileId = await uploadToDrive(token, conn.folder_id, fileName, blob);
    if (!fileId) {
      failed++;
      continue;
    }
    await admin.from("submissions").update({ drive_file_id: fileId }).eq("id", sub.id);
    archived++;
  }

  revalidatePath("/teacher/videos");
  return { ok: true, data: { archived, failed, deferred } };
}

/** 선택한 영상 파일을 정리한다 — 판정 기록은 보존, 검토 대기 영상은 건너뛴다 */
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
