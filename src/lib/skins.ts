/**
 * 포도알 스킨 — 합격한 포도알의 색/광택을 바꾸는 개인 꾸미기.
 * 잠금 해제 기준을 여러 종류(포도알 수·포도송이 수·연습 영상 수·연속일)로 섞어
 * "무엇을 열심히 하든" 새 스킨이 열리게 한다. 멤버가 개인적으로 고른다.
 */

export type SkinUnlock =
  | { kind: "free" }
  | { kind: "grapes"; n: number } // 모은 포도알(합격) 수
  | { kind: "bunches"; n: number } // 완성한 포도송이 수
  | { kind: "videos"; n: number } // 올린 연습 영상 수
  | { kind: "streak"; n: number }; // 연속 연습일 🔥

/** 움직이는 이펙트 — 합격 포도알에 덧입힌다 */
export type SkinEffect = "flame" | "glow" | "sparkle";

export interface GrapeSkin {
  id: string;
  name: string;
  emoji: string;
  /** 합격 포도알 radial 그라데이션 (안 → 밖, 2색 이상) */
  colors: string[];
  /** 테두리 색 */
  stroke: string;
  /** 광택(하이라이트) 색 */
  gloss: string;
  /** 특수 이펙트 (있으면 애니메이션) */
  effect?: SkinEffect;
  unlock: SkinUnlock;
}

/** 잠금 해제 판정에 쓰는 멤버 누적 통계 */
export interface SkinStats {
  grapes: number;
  bunches: number;
  videos: number;
  streak: number;
}

export const DEFAULT_SKIN_ID = "violet";

/**
 * 스킨 목록. 위에서부터 쉬운 순서(대략)로 둔다.
 * 기준을 일부러 골고루 섞었다 — 꾸준함(연속일)·양(영상)·성취(포도송이)·기본기(포도알).
 */
export const SKINS: GrapeSkin[] = [
  {
    id: "violet",
    name: "머루",
    emoji: "🍇",
    colors: ["#a855f7", "#6b21a8"],
    stroke: "#581c87",
    gloss: "#e9d5ff",
    unlock: { kind: "free" },
  },
  {
    id: "green",
    name: "청포도",
    emoji: "🍏",
    colors: ["#a3e635", "#4d7c0f"],
    stroke: "#3f6212",
    gloss: "#ecfccb",
    unlock: { kind: "grapes", n: 10 },
  },
  {
    id: "flame",
    name: "불꽃",
    emoji: "🔥",
    colors: ["#fb923c", "#dc2626"],
    stroke: "#7f1d1d",
    gloss: "#fed7aa",
    effect: "flame",
    unlock: { kind: "streak", n: 7 },
  },
  {
    id: "ruby",
    name: "루비",
    emoji: "❤️",
    colors: ["#fb7185", "#be123c"],
    stroke: "#881337",
    gloss: "#ffe4e6",
    unlock: { kind: "videos", n: 20 },
  },
  {
    id: "gold",
    name: "황금",
    emoji: "💛",
    colors: ["#fcd34d", "#d97706"],
    stroke: "#92400e",
    gloss: "#fef9c3",
    effect: "glow",
    unlock: { kind: "bunches", n: 3 },
  },
  {
    id: "sky",
    name: "블루베리",
    emoji: "💙",
    colors: ["#60a5fa", "#1d4ed8"],
    stroke: "#1e3a8a",
    gloss: "#dbeafe",
    unlock: { kind: "grapes", n: 40 },
  },
  {
    id: "neon",
    name: "네온",
    emoji: "💚",
    colors: ["#4ade80", "#06b6d4"],
    stroke: "#0e7490",
    gloss: "#ccfbf1",
    effect: "glow",
    unlock: { kind: "videos", n: 50 },
  },
  {
    id: "galaxy",
    name: "은하",
    emoji: "🌌",
    colors: ["#f472b6", "#8b5cf6", "#3b82f6"],
    stroke: "#4c1d95",
    gloss: "#ede9fe",
    effect: "sparkle",
    unlock: { kind: "bunches", n: 5 },
  },
  {
    id: "magma",
    name: "용암",
    emoji: "🌋",
    colors: ["#fde047", "#ea580c", "#7f1d1d"],
    stroke: "#450a0a",
    gloss: "#fef08a",
    effect: "flame",
    unlock: { kind: "grapes", n: 100 },
  },
  {
    id: "diamond",
    name: "다이아",
    emoji: "💎",
    colors: ["#e0f2fe", "#38bdf8", "#0284c7"],
    stroke: "#0369a1",
    gloss: "#ffffff",
    effect: "sparkle",
    unlock: { kind: "bunches", n: 10 },
  },
  {
    id: "rainbow",
    name: "무지개",
    emoji: "🌈",
    colors: ["#f472b6", "#a855f7", "#38bdf8", "#4ade80", "#facc15"],
    stroke: "#7c3aed",
    gloss: "#ffffff",
    effect: "sparkle",
    unlock: { kind: "bunches", n: 15 },
  },
];

const SKIN_BY_ID = new Map(SKINS.map((s) => [s.id, s]));

/** id로 스킨을 찾되, 없거나 비어 있으면 기본 스킨으로 안전하게 되돌린다. */
export function getSkin(id: string | null | undefined): GrapeSkin {
  return (id && SKIN_BY_ID.get(id)) || SKIN_BY_ID.get(DEFAULT_SKIN_ID)!;
}

/** 이 스킨의 잠금 해제 기준에 대한 현재 진행값(가진 수). free면 null. */
export function unlockCurrent(unlock: SkinUnlock, stats: SkinStats): number | null {
  switch (unlock.kind) {
    case "free":
      return null;
    case "grapes":
      return stats.grapes;
    case "bunches":
      return stats.bunches;
    case "videos":
      return stats.videos;
    case "streak":
      return stats.streak;
  }
}

/** 스킨이 지금 열려 있는지. */
export function isSkinUnlocked(skin: GrapeSkin, stats: SkinStats): boolean {
  if (skin.unlock.kind === "free") return true;
  const have = unlockCurrent(skin.unlock, stats) ?? 0;
  return have >= skin.unlock.n;
}

/** 잠금 조건 안내 문구. */
export function unlockLabel(unlock: SkinUnlock): string {
  switch (unlock.kind) {
    case "free":
      return "기본 제공";
    case "grapes":
      return `포도알 ${unlock.n}개 모으기`;
    case "bunches":
      return `포도송이 ${unlock.n}개 완성`;
    case "videos":
      return `연습 영상 ${unlock.n}개 올리기`;
    case "streak":
      return `🔥 ${unlock.n}일 연속 연습`;
  }
}
