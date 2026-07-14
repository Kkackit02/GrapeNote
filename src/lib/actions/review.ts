"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { deriveGrapes, isCardComplete } from "@/lib/grapes";
import type { ActionResult, Submission } from "@/lib/types";

/** 선생님/파트장 판정: 합격(포도알 채움) 또는 재연습(코멘트와 함께 다시 비움) */
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
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  // 학생이면 파트장으로서 팀원의 제출만 판정 가능 (RLS가 최종 강제, 여기선 친절한 에러용)
  if (user.app_metadata?.role !== "teacher") {
    const { data: target } = await supabase
      .from("submissions")
      .select("student_id")
      .eq("id", input.submissionId)
      .maybeSingle();
    if (!target || target.student_id === user.id) {
      return { ok: false, error: "검토 권한이 없어요. 파트장은 자기 팀원의 영상만 검토할 수 있어요." };
    }
  }

  // RLS: 선생님은 같은 학원, 파트장은 자기 팀원(본인 제외) submission만 update 가능
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
  // (파트장은 progress_cards update 권한이 없으므로 admin으로 기록한다.
  //  위 submissions update가 RLS를 통과했으므로 판정 권한은 이미 증명됐다)
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
        await createSupabaseAdmin()
          .from("progress_cards")
          .update({ completed_at: new Date().toISOString() })
          .eq("id", card.id);
        cardCompleted = true;
      }
    }
  }

  revalidatePath("/teacher/review");
  revalidatePath("/me/review");
  revalidatePath(`/teacher/cards/${updated.card_id}`);
  revalidatePath(`/me/cards/${updated.card_id}`);
  return { ok: true, data: { cardCompleted } };
}
