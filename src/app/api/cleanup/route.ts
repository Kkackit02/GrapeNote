import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const RETENTION_DAYS = 30;
const BATCH_SIZE = 200;

/**
 * 판정(합격/재연습) 후 30일 지난 영상 파일을 정리한다.
 * Vercel Cron이 매일 호출 (vercel.json). 기록/코멘트는 보존, 파일만 삭제.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();

  const { data: stale, error } = await admin
    .from("submissions")
    .select("id, video_path")
    .in("status", ["approved", "needs_retry"])
    .lt("reviewed_at", cutoff)
    .is("video_deleted_at", null)
    .limit(BATCH_SIZE);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!stale || stale.length === 0) return NextResponse.json({ cleaned: 0 });

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
