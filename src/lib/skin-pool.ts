import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { calcStreak } from "@/lib/streaks";
import { unlockedSkinIds, type SkinStats } from "@/lib/skins";

/**
 * 멤버별로 '가진(해금한) 스킨 id 목록'을 구한다 — 랜덤 포도의 재료.
 * 남의 기록은 학생 RLS로 못 보므로 service role로 한 번에 집계한다.
 */
export async function getSkinPools(studentIds: string[]): Promise<Map<string, string[]>> {
  const ids = [...new Set(studentIds)].filter(Boolean);
  const pools = new Map<string, string[]>();
  if (ids.length === 0) return pools;

  const admin = createSupabaseAdmin();
  const [{ data: cardRows }, { data: subRows }] = await Promise.all([
    admin.from("progress_cards").select("student_id, completed_at").in("student_id", ids),
    admin.from("submissions").select("student_id, status, created_at").in("student_id", ids),
  ]);

  const cards = (cardRows ?? []) as { student_id: string; completed_at: string | null }[];
  const subs = (subRows ?? []) as { student_id: string; status: string; created_at: string }[];

  for (const id of ids) {
    const myCards = cards.filter((c) => c.student_id === id);
    const mySubs = subs.filter((s) => s.student_id === id);
    const stats: SkinStats = {
      grapes: mySubs.filter((s) => s.status === "approved").length,
      bunches: myCards.filter((c) => c.completed_at).length,
      videos: mySubs.length,
      streak: calcStreak(mySubs.map((s) => s.created_at)),
    };
    pools.set(id, unlockedSkinIds(stats));
  }
  return pools;
}
