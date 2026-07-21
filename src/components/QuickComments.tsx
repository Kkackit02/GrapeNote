"use client";

/** 검토 코멘트에 원터치로 넣는 상투 문구 — 리더가 매번 타이핑하지 않게 */
const PRESETS = [
  "박자 좋아요 👍",
  "소리 깨끗해요 ✨",
  "표현이 살아있어요 🎶",
  "많이 늘었어요!",
  "박자를 조금 더 정확히",
  "음정 확인해 봐요",
  "조금 더 천천히",
  "한 번 더 도전! 💪",
];

interface Props {
  /** 고른 문구를 코멘트에 이어 붙인다 */
  onPick: (text: string) => void;
}

export function QuickComments({ onPick }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onPick(text)}
          className="px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 text-xs font-bold text-violet-700 active:bg-violet-100"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
