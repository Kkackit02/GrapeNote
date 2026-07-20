import type { ProgressCard, Submission } from "@/lib/types";

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  earned: boolean;
}

/** 내 카드·제출 기록에서 배지를 유도한다 (저장 없음 — 항상 다시 계산) */
export function calcBadges(
  cards: ProgressCard[],
  submissions: Submission[],
  streak: number
): Badge[] {
  const approved = submissions.filter((s) => s.status === "approved").length;
  const completed = cards.filter((c) => c.completed_at).length;
  // 같은 포도알에서 재연습을 받은 뒤 끝내 합격했는가
  const overcame = submissions.some(
    (s) =>
      s.status === "approved" &&
      submissions.some(
        (r) =>
          r.status === "needs_retry" &&
          r.card_id === s.card_id &&
          r.grape_index === s.grape_index
      )
  );

  return [
    { id: "first-video", emoji: "🌱", name: "첫 발자국", desc: "첫 연습 영상 올리기", earned: submissions.length > 0 },
    { id: "first-grape", emoji: "🍇", name: "첫 포도알", desc: "첫 합격 받기", earned: approved >= 1 },
    { id: "first-bunch", emoji: "🏆", name: "첫 포도송이", desc: "카드 하나 완성하기", earned: completed >= 1 },
    { id: "comeback", emoji: "💪", name: "다시 일어서기", desc: "재연습을 극복하고 합격", earned: overcame },
    { id: "streak-3", emoji: "🔥", name: "사흘 불꽃", desc: "3일 연속 연습", earned: streak >= 3 },
    { id: "streak-7", emoji: "⚡", name: "일주일 폭주", desc: "7일 연속 연습", earned: streak >= 7 },
    { id: "grapes-10", emoji: "🎯", name: "포도알 10개", desc: "합격 10번 모으기", earned: approved >= 10 },
    { id: "grapes-50", emoji: "🌟", name: "포도알 50개", desc: "합격 50번 모으기", earned: approved >= 50 },
    { id: "grapes-100", emoji: "👑", name: "포도알 100개", desc: "합격 100번 모으기", earned: approved >= 100 },
    { id: "bunch-5", emoji: "🍷", name: "포도밭 부자", desc: "포도송이 5개 완성하기", earned: completed >= 5 },
  ];
}
