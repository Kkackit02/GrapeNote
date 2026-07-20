import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { FREE_LIMITS, PREMIUM_LIMITS } from "@/lib/limits";

const BATCH_SIZE = 200;

const cutoffOf = (days: number) =>
  new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

/**
 * 판정(합격/재연습) 후 보존 기간이 지난 영상 파일을 정리한다.
 * 무료 그룹 7일, 프리미엄 그룹 30일. Vercel Cron이 매일 호출 (vercel.json).
 * 기록/코멘트는 보존, 파일만 삭제.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createSupabaseAdmin();
  // 0018 이전(컬럼 없음)이면 조회 실패 → 전부 무료 기준으로 정리
  const { data: premiumRows } = await admin
    .from("academies")
    .select("id")
    .eq("is_premium", true);
  const premiumIds = (premiumRows ?? []).map((row) => row.id);

  const freeQuery = admin
    .from("submissions")
    .select("id, video_path")
    .in("status", ["approved", "needs_retry"])
    .lt("reviewed_at", cutoffOf(FREE_LIMITS.retentionDays))
    .is("video_deleted_at", null)
    .limit(BATCH_SIZE);
  const { data: freeStale, error } = await (premiumIds.length > 0
    ? freeQuery.not("academy_id", "in", `(${premiumIds.join(",")})`)
    : freeQuery);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let premiumStale: { id: string; video_path: string }[] = [];
  if (premiumIds.length > 0) {
    const { data } = await admin
      .from("submissions")
      .select("id, video_path")
      .in("status", ["approved", "needs_retry"])
      .in("academy_id", premiumIds)
      .lt("reviewed_at", cutoffOf(PREMIUM_LIMITS.retentionDays))
      .is("video_deleted_at", null)
      .limit(BATCH_SIZE);
    premiumStale = data ?? [];
  }

  const stale = [...(freeStale ?? []), ...premiumStale];
  if (stale.length === 0) return NextResponse.json({ cleaned: 0 });

  const paths = stale.map((s) => s.video_path).filter(Boolean);
  if (paths.length > 0) {
    const { error: removeError } = await admin.storage.from("videos").remove(paths);
    if (removeError) {
      return NextResponse.json({ error: removeError.message }, { status: 500 });
    }
  }

  await admin
    .from("submissions")
    .update({ video_deleted_at: new Date().toISOString() })
    .in("id", stale.map((s) => s.id));

  return NextResponse.json({ cleaned: stale.length });
}
