"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { deriveGrapes, isCardComplete } from "@/lib/grapes";
import { sendPushTo } from "@/lib/push";
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

  // 판정은 review_submission RPC로만 처리한다. 함수(security definer)가 상태(pending)·
  // 권한(선생님/파트장, 본인 제출 제외)·수정 컬럼을 DB 레벨에서 강제하므로, 클라이언트가
  // submissions를 직접 조작할 수 없다.
  const { data: cardId, error } = await supabase.rpc("review_submission", {
    sub_id: input.submissionId,
    verdict: input.verdict,
    comment: comment || null,
  });
  if (error || !cardId) {
    return { ok: false, error: "판정에 실패했습니다. 권한이 없거나 이미 처리된 제출일 수 있어요." };
  }
  const updated = { card_id: cardId as string };

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

  // 판정 결과를 멤버 본인에게만 알린다. 완성 소식을 그룹에 알릴지는 본인이 정한다
  // (자랑하기 → shareCompletion). 알림 실패는 판정에 영향을 주지 않는다.
  try {
    const { data: card } = await supabase
      .from("progress_cards")
      .select("title, student_id")
      .eq("id", updated.card_id)
      .single();
    if (card) {
      await sendPushTo([card.student_id], {
        title: cardCompleted
          ? "🎉 포도송이 완성!"
          : input.verdict === "approved"
            ? "🍇 합격이에요!"
            : "↺ 다시 도전해 볼까요?",
        body: cardCompleted
          ? `${card.title}를 끝까지 해냈어요! 자랑하기로 친구들에게 알릴 수 있어요.`
          : input.verdict === "approved"
            ? `${card.title} 포도알이 채워졌어요!`
            : `${card.title} — ${comment}`,
        url: `/me/cards/${updated.card_id}`,
        tag: `verdict-${updated.card_id}`,
      });
    }
  } catch {
    // 무시
  }

  revalidatePath("/teacher/review");
  revalidatePath("/me/review");
  revalidatePath(`/teacher/cards/${updated.card_id}`);
  revalidatePath(`/me/cards/${updated.card_id}`);
  return { ok: true, data: { cardCompleted } };
}
