"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { calcStreak } from "@/lib/streaks";
import {
  getSkin,
  isSkinUnlocked,
  unlockedSkinIds,
  RANDOM_SKIN_ID,
  type SkinStats,
} from "@/lib/skins";
import type { ActionResult, ProgressCard, Submission } from "@/lib/types";

/**
 * 멤버가 고른 포도알 스킨을 저장한다.
 * 잠금 해제 여부를 서버에서 다시 계산해 검증하고, 통과할 때만 반영한다.
 * (프로필 쓰기는 service role 경유 — 클라이언트가 임의로 바꿀 수 없다)
 */
export async function setGrapeSkin(skinId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "student") {
    return { ok: false, error: "멤버 계정으로 로그인해 주세요." };
  }

  const isRandom = skinId === RANDOM_SKIN_ID;
  const skin = getSkin(skinId);
  if (!isRandom && skin.id !== skinId) {
    return { ok: false, error: "알 수 없는 스킨이에요." };
  }

  // 내 누적 통계로 잠금 해제 여부 재확인
  const [{ data: cardRows }, { data: subRows }] = await Promise.all([
    supabase.from("progress_cards").select("completed_at").eq("student_id", user.id),
    supabase.from("submissions").select("status, created_at").eq("student_id", user.id),
  ]);
  const cards = (cardRows ?? []) as Pick<ProgressCard, "completed_at">[];
  const subs = (subRows ?? []) as Pick<Submission, "status" | "created_at">[];
  const stats: SkinStats = {
    grapes: subs.filter((s) => s.status === "approved").length,
    bunches: cards.filter((c) => c.completed_at).length,
    videos: subs.length,
    streak: calcStreak(subs.map((s) => s.created_at)),
  };

  if (isRandom) {
    // 랜덤 포도는 가진 스킨이 2개 이상일 때만 (섞을 재료가 있어야 한다)
    if (unlockedSkinIds(stats).length < 2) {
      return { ok: false, error: "스킨을 2개 이상 모으면 랜덤 포도를 쓸 수 있어요!" };
    }
  } else if (!isSkinUnlocked(skin, stats)) {
    return { ok: false, error: "아직 잠긴 스킨이에요. 조건을 채우면 열려요!" };
  }

  // 본인 행만, grape_skin 컬럼만 갱신 (service role)
  const { error } = await createSupabaseAdmin()
    .from("profiles")
    .update({ grape_skin: isRandom ? RANDOM_SKIN_ID : skin.id })
    .eq("id", user.id);
  if (error) return { ok: false, error: "스킨 변경에 실패했어요." };

  revalidatePath("/me");
  revalidatePath("/me/vineyard");
  revalidatePath("/me/cards", "layout");
  return { ok: true, data: undefined };
}
