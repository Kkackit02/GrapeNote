"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { archiveSubmissionIds } from "@/lib/archive-run";
import type { ActionResult } from "@/lib/types";

const MAX_BATCH = 50;
/**
 * 서버 액션 시간 예산. Vercel 함수 상한(60초)보다 넉넉히 낮춰 중간에 잘리지 않게 한다.
 * 남은 건 deferred로 알려주고, 클라이언트가 이어서 다시 호출한다.
 */
const TIME_BUDGET_MS = 30_000;

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

  const result = await archiveSubmissionIds(auth.academyId, targetIds, TIME_BUDGET_MS);
  if (result.notConnected) {
    return { ok: false, error: "구글 드라이브가 연결되어 있지 않아요. 대시보드에서 먼저 연결해 주세요." };
  }
  if (result.archived + result.failed + result.deferred === 0) {
    return { ok: false, error: "백업할 대상이 없어요 (이미 백업됐거나 검토 대기 중이에요)." };
  }

  revalidatePath("/teacher/videos");
  return {
    ok: true,
    data: { archived: result.archived, failed: result.failed, deferred: result.deferred },
  };
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
