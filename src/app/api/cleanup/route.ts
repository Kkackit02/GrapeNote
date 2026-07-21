import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { FREE_LIMITS, PREMIUM_LIMITS, isPremiumActive } from "@/lib/limits";
import { getAccessToken, uploadToDrive } from "@/lib/google-drive";
import { archiveFileName } from "@/lib/archive";

// 드라이브 백업(다운로드+업로드)이 있어 여유를 준다 (Vercel Hobby 상한)
export const maxDuration = 60;

const BATCH_SIZE = 200;
/**
 * 이 시간이 지나면 백업을 멈추고 나머지는 다음 실행으로 미룬다 (백업 안 된 파일은 삭제하지 않음).
 * Vercel 함수 상한(60초)보다 낮춰 중간에 잘리지 않게 한다 — 잘리면 삭제 마킹이 유실될 수 있다.
 */
const TIME_BUDGET_MS = 40_000;

const cutoffOf = (days: number) =>
  new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

interface StaleRow {
  id: string;
  video_path: string;
  academy_id: string;
  card_id: string;
  student_id: string;
  grape_index: number;
  status: "approved" | "needs_retry";
  created_at: string;
  reviewed_at: string | null;
}

/**
 * 판정(합격/재연습) 후 보존 기간이 지난 영상 파일을 정리한다.
 * 무료 그룹 1일, 프리미엄 그룹 30일. Vercel Cron이 매일 호출 (vercel.json).
 * 그룹장이 드라이브를 연결해 뒀으면 삭제 직전에 드라이브로 백업하고,
 * 백업에 실패한 파일은 삭제하지 않는다 (다음 실행에서 재시도 — 유실 없음).
 * 기록/코멘트는 보존, 파일만 삭제.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const startedAt = Date.now();

  // 프리미엄 그룹은 보존이 길다 (0018 이전엔 조회 실패 → 전부 무료 기준)
  const { data: premiumRows } = await admin
    .from("academies")
    .select("id, is_premium, premium_until")
    .eq("is_premium", true);
  // 구독이 만료된 그룹은 무료 보존 기간으로 되돌아간다
  const premiumIds = (premiumRows ?? [])
    .filter((row) => isPremiumActive(row))
    .map((row) => row.id);

  // 자랑 중인 영상은 삭제 대상에서 제외한다 (그룹이 계속 볼 수 있어야 한다).
  // SQL 레벨에서 빼지 않으면 매 실행마다 이 행들이 배치를 채워 다른 정리를 막는다.
  const { data: showcaseRows } = await admin
    .from("profiles")
    .select("showcase_submission_id")
    .not("showcase_submission_id", "is", null);
  const protectedIds = (showcaseRows ?? [])
    .map((r) => r.showcase_submission_id as string)
    .filter(Boolean);
  const protectedFilter = protectedIds.length > 0 ? `(${protectedIds.join(",")})` : null;

  const SELECT =
    "id, video_path, academy_id, card_id, student_id, grape_index, status, created_at, reviewed_at";
  const freeQuery = admin
    .from("submissions")
    .select(SELECT)
    .in("status", ["approved", "needs_retry"])
    .lt("reviewed_at", cutoffOf(FREE_LIMITS.retentionDays))
    .is("video_deleted_at", null)
    .limit(BATCH_SIZE);
  if (protectedFilter) freeQuery.not("id", "in", protectedFilter);
  if (premiumIds.length > 0) freeQuery.not("academy_id", "in", `(${premiumIds.join(",")})`);
  const { data: freeStale, error } = await freeQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let premiumStale: StaleRow[] = [];
  if (premiumIds.length > 0) {
    const premiumQuery = admin
      .from("submissions")
      .select(SELECT)
      .in("status", ["approved", "needs_retry"])
      .in("academy_id", premiumIds)
      .lt("reviewed_at", cutoffOf(PREMIUM_LIMITS.retentionDays))
      .is("video_deleted_at", null)
      .limit(BATCH_SIZE);
    if (protectedFilter) premiumQuery.not("id", "in", protectedFilter);
    const { data } = await premiumQuery;
    premiumStale = (data ?? []) as StaleRow[];
  }

  const stale = [...((freeStale ?? []) as StaleRow[]), ...premiumStale];
  if (stale.length === 0) return NextResponse.json({ cleaned: 0, archived: 0 });

  // 드라이브 연결 (0019 이전엔 조회 실패 → 백업 없이 기존 동작)
  const { data: connRows } = await admin.from("drive_connections").select("*");
  const connections = new Map(
    (connRows ?? []).map((conn) => [conn.academy_id as string, conn])
  );

  // 백업 파일명용 메타 (곡명/멤버명)
  const needMeta = stale.filter((s) => connections.has(s.academy_id));
  const [cardTitles, studentNames] = await Promise.all([
    needMeta.length > 0
      ? admin.from("progress_cards").select("id, title")
          .in("id", [...new Set(needMeta.map((s) => s.card_id))])
          .then(({ data }) => new Map((data ?? []).map((c) => [c.id, c.title])))
      : new Map<string, string>(),
    needMeta.length > 0
      ? admin.from("profiles").select("id, display_name")
          .in("id", [...new Set(needMeta.map((s) => s.student_id))])
          .then(({ data }) => new Map((data ?? []).map((p) => [p.id, p.display_name])))
      : new Map<string, string>(),
  ]);

  const accessTokens = new Map<string, string | null>();
  const toDelete: StaleRow[] = [];
  let archived = 0;
  let deferred = 0;

  for (const sub of stale) {
    const conn = connections.get(sub.academy_id);
    if (!conn) {
      toDelete.push(sub); // 백업 미연결 그룹은 바로 삭제 대상
      continue;
    }
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      deferred++;
      continue; // 시간 초과 — 삭제하지 않고 다음 실행에서 백업
    }

    if (!accessTokens.has(sub.academy_id)) {
      accessTokens.set(sub.academy_id, await getAccessToken(conn.refresh_token));
    }
    const token = accessTokens.get(sub.academy_id);
    if (!token) {
      deferred++;
      continue; // 토큰 실패 — 파일 보존
    }

    const { data: blob } = await admin.storage.from("videos").download(sub.video_path);
    if (!blob) {
      toDelete.push(sub); // 파일이 이미 없음 — 마킹만
      continue;
    }
    const fileName = archiveFileName({
      songTitle: cardTitles.get(sub.card_id) ?? "곡",
      memberName: studentNames.get(sub.student_id) ?? "멤버",
      grapeIndex: sub.grape_index,
      status: sub.status,
      createdAt: sub.created_at,
      reviewedAt: sub.reviewed_at,
      videoPath: sub.video_path,
    });

    const fileId = await uploadToDrive(token, conn.folder_id, fileName, blob);
    if (!fileId) {
      deferred++;
      continue; // 업로드 실패 — 파일 보존, 다음 실행 재시도
    }
    await admin.from("submissions").update({ drive_file_id: fileId }).eq("id", sub.id);
    archived++;
    toDelete.push(sub);
  }

  if (toDelete.length > 0) {
    const paths = toDelete.map((s) => s.video_path).filter(Boolean);
    if (paths.length > 0) {
      const { error: removeError } = await admin.storage.from("videos").remove(paths);
      if (removeError) {
        return NextResponse.json({ error: removeError.message }, { status: 500 });
      }
    }
    await admin
      .from("submissions")
      .update({ video_deleted_at: new Date().toISOString() })
      .in("id", toDelete.map((s) => s.id));
  }

  return NextResponse.json({ cleaned: toDelete.length, archived, deferred });
}
