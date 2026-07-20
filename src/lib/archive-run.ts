import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getAccessToken, uploadToDrive } from "@/lib/google-drive";
import { archiveFileName } from "@/lib/archive";

export interface ArchiveResult {
  archived: number;
  failed: number;
  deferred: number;
  /** 드라이브가 연결되어 있지 않아 아무것도 하지 않음 */
  notConnected: boolean;
}

/**
 * 제출물들을 그룹장의 드라이브 아카이브로 백업한다 (파일은 서버에 그대로 둔다).
 * 일괄 백업 액션과 숙제 마감이 함께 쓴다. 시간 예산을 넘으면 나머지는 다음 실행으로 미룬다.
 */
export async function archiveSubmissionIds(
  academyId: string,
  submissionIds: string[],
  timeBudgetMs = 40_000
): Promise<ArchiveResult> {
  const empty: ArchiveResult = { archived: 0, failed: 0, deferred: 0, notConnected: false };
  if (submissionIds.length === 0) return empty;

  const admin = createSupabaseAdmin();
  const { data: conn } = await admin
    .from("drive_connections")
    .select("*")
    .eq("academy_id", academyId)
    .maybeSingle();
  if (!conn) return { ...empty, notConnected: true };

  const { data: subs } = await admin
    .from("submissions")
    .select("id, video_path, card_id, student_id, grape_index, status, created_at, reviewed_at, drive_file_id")
    .in("id", submissionIds)
    .eq("academy_id", academyId)
    .is("video_deleted_at", null);
  const targets = (subs ?? []).filter((sub) => !sub.drive_file_id && sub.status !== "pending");
  if (targets.length === 0) return empty;

  const [{ data: cards }, { data: profiles }] = await Promise.all([
    admin.from("progress_cards").select("id, title")
      .in("id", [...new Set(targets.map((s) => s.card_id))]),
    admin.from("profiles").select("id, display_name")
      .in("id", [...new Set(targets.map((s) => s.student_id))]),
  ]);
  const titleOf = new Map((cards ?? []).map((c) => [c.id, c.title]));
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const token = await getAccessToken(conn.refresh_token);
  if (!token) return { ...empty, failed: targets.length };

  const startedAt = Date.now();
  const result: ArchiveResult = { ...empty };
  for (const sub of targets) {
    if (Date.now() - startedAt > timeBudgetMs) {
      result.deferred++;
      continue;
    }
    const { data: blob } = await admin.storage.from("videos").download(sub.video_path);
    if (!blob) {
      result.failed++;
      continue;
    }
    const fileId = await uploadToDrive(
      token,
      conn.folder_id,
      archiveFileName({
        songTitle: titleOf.get(sub.card_id) ?? "곡",
        memberName: nameOf.get(sub.student_id) ?? "멤버",
        grapeIndex: sub.grape_index,
        status: sub.status as "approved" | "needs_retry",
        createdAt: sub.created_at,
        reviewedAt: sub.reviewed_at,
        videoPath: sub.video_path,
      }),
      blob
    );
    if (!fileId) {
      result.failed++;
      continue;
    }
    await admin.from("submissions").update({ drive_file_id: fileId }).eq("id", sub.id);
    result.archived++;
  }
  return result;
}
