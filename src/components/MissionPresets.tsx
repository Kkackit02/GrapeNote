"use client";

import { GENERAL_MISSIONS, INSTRUMENT_MISSIONS } from "@/lib/mission-presets";
import { instrumentEmoji } from "@/lib/instruments";

interface Props {
  /** 고른 문구를 미션 칸에 이어 붙인다 */
  onPick: (text: string) => void;
}

/** 미션 템플릿 칩 — 빈 칸부터 쓰지 않게 자주 쓰는 문장을 원터치로 */
export function MissionPresets({ onPick }: Props) {
  const chip = (text: string) => (
    <button
      key={text}
      type="button"
      onClick={() => onPick(text)}
      className="px-2.5 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-xs font-bold text-sky-800 active:bg-sky-100"
    >
      {text}
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-bold text-gray-500">✨ 자주 쓰는 미션 (눌러서 넣기)</p>
      <div className="flex flex-wrap gap-1.5">{GENERAL_MISSIONS.map(chip)}</div>

      <details className="mt-0.5">
        <summary className="text-xs font-bold text-sky-700 cursor-pointer select-none">
          🎸 악기별 미션 보기
        </summary>
        <div className="mt-1.5 flex flex-col gap-2">
          {Object.entries(INSTRUMENT_MISSIONS).map(([inst, list]) => (
            <div key={inst}>
              <p className="text-[11px] font-bold text-gray-400 mb-1">
                {instrumentEmoji(inst)} {inst}
              </p>
              <div className="flex flex-wrap gap-1.5">{list.map(chip)}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
