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

/**
 * 같은 악기를 부르는 다른 이름들을 프리셋 이름으로 모아 준다.
 * (예: "피아노"로 기록된 연습도 🎹 키보드 전용 스킨에 쌓이도록)
 */
const ALIASES: Record<string, string> = {
  피아노: "키보드",
  건반: "키보드",
  신디: "키보드",
  신디사이저: "키보드",
  일렉기타: "기타",
  일렉: "기타",
  통기타: "기타",
  어쿠스틱: "기타",
  어쿠스틱기타: "기타",
  노래: "보컬",
  보컬리스트: "보컬",
  드럼스: "드럼",
};

export function normalizeInstrument(instrument: string | null | undefined): string {
  const name = (instrument ?? "").trim();
  return ALIASES[name] ?? name;
}

/**
 * 악기 다중 지정: profiles.instrument에 "기타, 드럼"처럼 쉼표로 저장한다 (첫 번째가 주 세션).
 * 별도 마이그레이션 없이 겸업 세션을 표현하기 위한 관례.
 */
export function parseInstruments(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** "🎸🥁" 처럼 겸업 악기 이모지를 이어붙인 뱃지. 미지정이면 빈 문자열. */
export function instrumentBadge(value: string | null | undefined): string {
  return parseInstruments(value).map(instrumentEmoji).join("");
}
