import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPushTo } from "@/lib/push";

export const maxDuration = 60;

const KST_SHIFT = 9 * 3600 * 1000;

/**
 * 연습 리마인더: 리더가 고른 요일 저녁에, 오늘 아직 연습(제출) 안 한 멤버에게 넛지.
 * Vercel Cron이 매일 저녁(KST) 호출한다 (vercel.json). 오늘 요일이 그룹 설정에 없으면 건너뛴다.
 * 진행 중(미완성·미마감) 카드가 있는 멤버에게만 보낸다 — 할 게 없는 멤버는 조용히 둔다.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // KST 기준 오늘 요일 + 오늘 0시(UTC 환산)
  const kstNow = new Date(Date.now() + KST_SHIFT);
  const weekday = kstNow.getUTCDay(); // 0=일 ~ 6=토 (KST)
  const kstMidnightUtc = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - KST_SHIFT
  ).toISOString();

  const admin = createSupabaseAdmin();
  const { data: academies } = await admin
    .from("academies")
    .select("id, reminder_days")
    .not("reminder_days", "is", null);

  const targets = (academies ?? []).filter((a) =>
    (a.reminder_days as string).split(",").map((s) => s.trim()).includes(String(weekday))
  );
  if (targets.length === 0) return NextResponse.json({ groups: 0, reminded: 0 });

  let reminded = 0;
  for (const group of targets) {
    // 진행 중 카드가 있는 멤버 (미완성·미마감)
    const { data: activeCards } = await admin
      .from("progress_cards")
      .select("student_id")
      .eq("academy_id", group.id)
      .is("completed_at", null)
      .is("closed_at", null);
    const activeIds = [...new Set((activeCards ?? []).map((c) => c.student_id as string))];
    if (activeIds.length === 0) continue;

    // 오늘(KST) 이미 제출한 멤버
    const { data: todaySubs } = await admin
      .from("submissions")
      .select("student_id")
      .eq("academy_id", group.id)
      .gte("created_at", kstMidnightUtc);
    const practiced = new Set((todaySubs ?? []).map((s) => s.student_id as string));

    const remind = activeIds.filter((id) => !practiced.has(id));
    if (remind.length === 0) continue;

    reminded += await sendPushTo(remind, {
      title: "🎵 연습할 시간이에요!",
      body: "오늘 아직 연습 영상을 안 올렸어요. 포도알 하나 채워 볼까요?",
      url: "/me",
      tag: "practice-reminder",
    });
  }

  return NextResponse.json({ groups: targets.length, reminded });
}
