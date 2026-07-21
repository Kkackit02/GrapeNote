import { instrumentEmoji } from "@/lib/instruments";

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
  | { kind: "streak"; n: number } // 연속 연습일 🔥
  /** 악기 전용 — 그 악기를 맡은 멤버만 (+ 포도알 n개) */
  | { kind: "instrument"; instrument: string; n: number };

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
  /** 맡은 악기 목록 (악기 전용 스킨 판정) */
  instruments?: string[];
}

export const DEFAULT_SKIN_ID = "violet";
/** 랜덤 포도 — 내가 가진 스킨들이 포도알마다 섞여 박힌다 */
export const RANDOM_SKIN_ID = "random";

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
    id: "blossom",
    name: "벚꽃",
    emoji: "🌸",
    colors: ["#fce7f3", "#f472b6", "#db2777"],
    stroke: "#9d174d",
    gloss: "#fff1f2",
    unlock: { kind: "videos", n: 10 },
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
    id: "ocean",
    name: "바다",
    emoji: "🌊",
    colors: ["#67e8f9", "#0891b2", "#155e75"],
    stroke: "#164e63",
    gloss: "#cffafe",
    effect: "glow",
    unlock: { kind: "streak", n: 14 },
  },
  {
    id: "sunset",
    name: "노을",
    emoji: "🌇",
    colors: ["#fed7aa", "#fb7185", "#7c3aed"],
    stroke: "#9f1239",
    gloss: "#ffe4e6",
    unlock: { kind: "grapes", n: 70 },
  },
  {
    id: "midnight",
    name: "한밤",
    emoji: "🌙",
    colors: ["#818cf8", "#312e81", "#0f172a"],
    stroke: "#020617",
    gloss: "#e0e7ff",
    effect: "sparkle",
    unlock: { kind: "streak", n: 30 },
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
  // ── 악기 전용: 그 악기를 맡은 멤버만 (포도알 5개 이상) ──
  {
    id: "inst-guitar",
    name: "기타리스트",
    emoji: "🎸",
    colors: ["#fde68a", "#d97706", "#451a03"],
    stroke: "#1c0a02",
    gloss: "#fef3c7",
    effect: "glow",
    unlock: { kind: "instrument", instrument: "기타", n: 5 },
  },
  {
    id: "inst-bass",
    name: "베이시스트",
    emoji: "🎸",
    colors: ["#f0abfc", "#a21caf", "#4a044e"],
    stroke: "#3b0764",
    gloss: "#fae8ff",
    effect: "glow",
    unlock: { kind: "instrument", instrument: "베이스", n: 5 },
  },
  {
    id: "inst-drums",
    name: "드러머",
    emoji: "🥁",
    colors: ["#f1f5f9", "#94a3b8", "#334155"],
    stroke: "#1e293b",
    gloss: "#ffffff",
    effect: "sparkle",
    unlock: { kind: "instrument", instrument: "드럼", n: 5 },
  },
  {
    id: "inst-keys",
    name: "건반주자",
    emoji: "🎹",
    colors: ["#fffbeb", "#a8a29e", "#1c1917"],
    stroke: "#0c0a09",
    gloss: "#ffffff",
    unlock: { kind: "instrument", instrument: "키보드", n: 5 },
  },
  {
    id: "inst-vocal",
    name: "보컬리스트",
    emoji: "🎤",
    colors: ["#fda4af", "#e11d48", "#4c0519"],
    stroke: "#3f0417",
    gloss: "#fff1f2",
    effect: "sparkle",
    unlock: { kind: "instrument", instrument: "보컬", n: 5 },
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

/**
 * 랜덤 포도에서 이 포도알에 박힐 스킨.
 * 인덱스로 결정되므로 새로고침해도 같은 자리엔 같은 스킨이 온다(깜빡임 방지).
 */
export function skinForIndex(poolIds: string[], index: number): GrapeSkin {
  if (poolIds.length === 0) return getSkin(undefined);
  const mixed = (index * 2654435761) >>> 0; // 골든비 해시로 섞어 배열이 단조롭지 않게
  return getSkin(poolIds[mixed % poolIds.length]);
}

/** 지금 통계로 열린 스킨 id 목록 (랜덤 포도의 재료) */
export function unlockedSkinIds(stats: SkinStats): string[] {
  return SKINS.filter((s) => isSkinUnlocked(s, stats)).map((s) => s.id);
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
    case "instrument":
      return null; // 악기 보유 여부가 핵심이라 숫자 진행도는 보여주지 않는다
  }
}

/** 스킨이 지금 열려 있는지. */
export function isSkinUnlocked(skin: GrapeSkin, stats: SkinStats): boolean {
  const unlock = skin.unlock;
  if (unlock.kind === "free") return true;
  if (unlock.kind === "instrument") {
    return (stats.instruments ?? []).includes(unlock.instrument) && stats.grapes >= unlock.n;
  }
  const have = unlockCurrent(unlock, stats) ?? 0;
  return have >= unlock.n;
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
    case "instrument":
      return `${instrumentEmoji(unlock.instrument)} ${unlock.instrument} 담당 + 포도알 ${unlock.n}개`;
  }
}
