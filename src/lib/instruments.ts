/** 악기(세션) 프리셋 — 자유 입력도 가능하지만 밴드 기본 편성을 원탭으로 */
export const INSTRUMENT_PRESETS = ["보컬", "기타", "베이스", "드럼", "키보드"] as const;

const EMOJI: Record<string, string> = {
  보컬: "🎤",
  기타: "🎸",
  베이스: "🎸",
  드럼: "🥁",
  키보드: "🎹",
  건반: "🎹",
  피아노: "🎹",
  신디: "🎹",
  바이올린: "🎻",
  첼로: "🎻",
  색소폰: "🎷",
  트럼펫: "🎺",
  플루트: "🪈",
};

export function instrumentEmoji(instrument: string | null | undefined): string {
  if (!instrument) return "🎵";
  return EMOJI[instrument] ?? "🎵";
}
