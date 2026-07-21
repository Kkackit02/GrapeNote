import type { ProgressCard, Submission } from "@/lib/types";

/**
 * 칭호(=도전과제). 조건을 채우면 열리고, 멤버가 그중 하나를 골라 이름 옆에 단다.
 * 저장 없이 항상 다시 계산한다(획득 여부). 고른 칭호 id만 profiles.title에 저장.
 */
export interface Title {
  id: string;
  emoji: string;
  /** 이름 옆에 붙는 칭호 문구 */
  name: string;
  /** 획득 조건 설명 */
  desc: string;
}

export interface TitleStats {
  grapes: number; // 합격(포도알) 수
  bunches: number; // 완성 포도송이 수
  videos: number; // 올린 영상 수
  streak: number; // 연속 연습일
  comeback: boolean; // 재연습을 극복하고 합격
  selfStarter: boolean; // 스스로 곡을 추가
  bigBunch: boolean; // 20알 이상 포도송이 완성
  distinctSongs: number; // 서로 다른 곡 완성 수
}

interface TitleDef extends Title {
  unlocked: (s: TitleStats) => boolean;
}

/** 전체 칭호 목록 (쉬운 순 → 어려운 순 대략). */
const DEFS: TitleDef[] = [
  { id: "sprout", emoji: "🌱", name: "새싹", desc: "첫 연습 영상 올리기", unlocked: (s) => s.videos >= 1 },
  { id: "first-grape", emoji: "🍇", name: "첫 수확", desc: "첫 합격 받기", unlocked: (s) => s.grapes >= 1 },
  { id: "first-bunch", emoji: "🏆", name: "첫 송이", desc: "포도송이 1개 완성", unlocked: (s) => s.bunches >= 1 },
  { id: "comeback", emoji: "💪", name: "오뚝이", desc: "재연습을 극복하고 합격", unlocked: (s) => s.comeback },
  { id: "self-starter", emoji: "🙋", name: "자기주도", desc: "스스로 연습할 곡 추가", unlocked: (s) => s.selfStarter },
  { id: "streak-3", emoji: "🔥", name: "불꽃", desc: "3일 연속 연습", unlocked: (s) => s.streak >= 3 },
  { id: "streak-7", emoji: "⚡", name: "폭주", desc: "7일 연속 연습", unlocked: (s) => s.streak >= 7 },
  { id: "streak-14", emoji: "🌋", name: "화산", desc: "14일 연속 연습", unlocked: (s) => s.streak >= 14 },
  { id: "streak-30", emoji: "☄️", name: "혜성", desc: "30일 연속 연습", unlocked: (s) => s.streak >= 30 },
  { id: "grapes-10", emoji: "🎯", name: "명사수", desc: "합격 10개 모으기", unlocked: (s) => s.grapes >= 10 },
  { id: "grapes-50", emoji: "🌟", name: "스타", desc: "합격 50개 모으기", unlocked: (s) => s.grapes >= 50 },
  { id: "grapes-100", emoji: "👑", name: "제왕", desc: "합격 100개 모으기", unlocked: (s) => s.grapes >= 100 },
  { id: "grapes-200", emoji: "🐉", name: "전설", desc: "합격 200개 모으기", unlocked: (s) => s.grapes >= 200 },
  { id: "bunch-3", emoji: "🍷", name: "포도밭지기", desc: "포도송이 3개 완성", unlocked: (s) => s.bunches >= 3 },
  { id: "bunch-5", emoji: "🏡", name: "포도밭 부자", desc: "포도송이 5개 완성", unlocked: (s) => s.bunches >= 5 },
  { id: "bunch-10", emoji: "🏰", name: "포도 영주", desc: "포도송이 10개 완성", unlocked: (s) => s.bunches >= 10 },
  { id: "bunch-20", emoji: "🗿", name: "포도 신화", desc: "포도송이 20개 완성", unlocked: (s) => s.bunches >= 20 },
  { id: "big-bunch", emoji: "🍒", name: "대송이", desc: "20알 이상 포도송이 완성", unlocked: (s) => s.bigBunch },
  { id: "videos-50", emoji: "🎬", name: "영상 장인", desc: "연습 영상 50개 올리기", unlocked: (s) => s.videos >= 50 },
  { id: "videos-100", emoji: "📽️", name: "다작왕", desc: "연습 영상 100개 올리기", unlocked: (s) => s.videos >= 100 },
  { id: "variety-5", emoji: "🎨", name: "만능 연주자", desc: "서로 다른 곡 5개 완성", unlocked: (s) => s.distinctSongs >= 5 },
];

export const TITLES: Title[] = DEFS.map((d) => ({
  id: d.id,
  emoji: d.emoji,
  name: d.name,
  desc: d.desc,
}));

const BY_ID = new Map(DEFS.map((d) => [d.id, d]));

/** 카드·제출 기록에서 칭호 판정용 통계를 계산한다 */
export function calcTitleStats(
  cards: ProgressCard[],
  submissions: Submission[],
  streak: number
): TitleStats {
  const grapes = submissions.filter((s) => s.status === "approved").length;
  const completed = cards.filter((c) => c.completed_at);
  const comeback = submissions.some(
    (s) =>
      s.status === "approved" &&
      submissions.some(
        (r) =>
          r.status === "needs_retry" && r.card_id === s.card_id && r.grape_index === s.grape_index
      )
  );
  return {
    grapes,
    bunches: completed.length,
    videos: submissions.length,
    streak,
    comeback,
    selfStarter: cards.some((c) => c.created_by === c.student_id),
    bigBunch: completed.some((c) => c.total_grapes >= 20),
    distinctSongs: new Set(completed.map((c) => c.title)).size,
  };
}

export function isTitleUnlocked(id: string, stats: TitleStats): boolean {
  return BY_ID.get(id)?.unlocked(stats) ?? false;
}

/** 이름 옆에 표시할 칭호 (없거나 잘못된 id면 null) */
export function getTitle(id: string | null | undefined): Title | null {
  if (!id) return null;
  const def = BY_ID.get(id);
  return def ? { id: def.id, emoji: def.emoji, name: def.name, desc: def.desc } : null;
}
