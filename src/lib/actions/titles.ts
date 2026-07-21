"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { calcStreak } from "@/lib/streaks";
import { calcTitleStats, isTitleUnlocked } from "@/lib/titles";
import type { ActionResult, ProgressCard, Submission } from "@/lib/types";

/**
 * 멤버가 고른 칭호를 저장한다 (id, 또는 null=칭호 없음).
 * 획득 여부를 서버에서 다시 계산해 검증하고 통과할 때만 반영한다.
 */
export async function setTitle(titleId: string | null): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "student") {
    return { ok: false, error: "멤버 계정으로 로그인해 주세요." };
  }

  if (titleId) {
    const [{ data: cardRows }, { data: subRows }] = await Promise.all([
      supabase.from("progress_cards").select("*").eq("student_id", user.id),
      supabase.from("submissions").select("*").eq("student_id", user.id),
    ]);
    const stats = calcTitleStats(
      (cardRows ?? []) as ProgressCard[],
      (subRows ?? []) as Submission[],
      calcStreak(((subRows ?? []) as Submission[]).map((s) => s.created_at))
    );
    if (!isTitleUnlocked(titleId, stats)) {
      return { ok: false, error: "아직 잠긴 칭호예요. 도전과제를 깨면 열려요!" };
    }
  }

  const { error } = await createSupabaseAdmin()
    .from("profiles")
    .update({ title: titleId })
    .eq("id", user.id);
  if (error) return { ok: false, error: "칭호 변경에 실패했어요." };

  revalidatePath("/me");
  revalidatePath("/me/vineyard");
  revalidatePath("/me/wall");
  return { ok: true, data: undefined };
}
