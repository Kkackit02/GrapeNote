"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deriveGrapes, isCardComplete } from "@/lib/grapes";
import type { ActionResult, Submission } from "@/lib/types";

/** 선생님 판정: 합격(포도알 채움) 또는 재연습(코멘트와 함께 다시 비움) */
export async function reviewSubmission(input: {
  submissionId: string;
  verdict: "approved" | "needs_retry";
  comment: string;
}): Promise<ActionResult<{ cardCompleted: boolean }>> {
  const comment = input.comment.trim();
  if (input.verdict === "needs_retry" && !comment) {
    return { ok: false, error: "재연습에는 코멘트를 남겨 주세요. 학생이 무엇을 고칠지 알아야 해요." };
  }

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "선생님 계정으로 로그인해 주세요." };
  }

  // RLS: 같은 학원 submission만 update 가능
  const { data: updated, error } = await supabase
    .from("submissions")
    .update({
      status: input.verdict,
      teacher_comment: comment || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.submissionId)
    .eq("status", "pending") // 이미 판정된 건 재판정 불가
    .select("card_id")
    .maybeSingle();
  if (error || !updated) {
    return { ok: false, error: "판정에 실패했습니다. 이미 처리된 제출일 수 있어요." };
  }

  // 합격이면 카드 완성 여부 확인
  let cardCompleted = false;
  if (input.verdict === "approved") {
    const { data: card } = await supabase
      .from("progress_cards")
      .select("id, total_grapes, completed_at")
      .eq("id", updated.card_id)
      .single();
    if (card && !card.completed_at) {
      const { data: subs } = await supabase
        .from("submissions")
        .select("*")
        .eq("card_id", card.id);
      const grapes = deriveGrapes(card.total_grapes, (subs ?? []) as Submission[]);
      if (isCardComplete(grapes)) {
        await supabase
          .from("progress_cards")
          .update({ completed_at: new Date().toISOString() })
          .eq("id", card.id);
        cardCompleted = true;
      }
    }
  }

  revalidatePath("/teacher/review");
  revalidatePath(`/teacher/cards/${updated.card_id}`);
  revalidatePath(`/me/cards/${updated.card_id}`);
  return { ok: true, data: { cardCompleted } };
}
