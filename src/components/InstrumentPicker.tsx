"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setStudentInstrument } from "@/lib/actions/students";
import { INSTRUMENT_PRESETS, instrumentEmoji } from "@/lib/instruments";

interface Props {
  studentId: string;
  current: string | null;
}

/** 멤버 악기(세션) 지정 — 곡 편성 그룹핑과 악기 파트 팀의 기준이 된다 */
export function InstrumentPicker({ studentId, current }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async (instrument: string | null) => {
    setError(null);
    setBusy(true);
    const result = await setStudentInstrument(studentId, instrument);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  const custom = () => {
    const value = window.prompt("악기 이름을 입력해 주세요 (예: 색소폰)", current ?? "");
    if (value === null) return;
    void apply(value.trim() || null);
  };

  const isPreset = current && (INSTRUMENT_PRESETS as readonly string[]).includes(current);

  return (
    <div className="rounded-2xl bg-white border border-violet-100 p-4">
      <p className="font-bold text-gray-700 text-sm">🎼 맡은 악기 (세션)</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {INSTRUMENT_PRESETS.map((name) => (
          <button
            key={name}
            type="button"
            disabled={busy}
            onClick={() => apply(current === name ? null : name)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 disabled:opacity-50 ${
              current === name
                ? "bg-violet-600 border-violet-600 text-white"
                : "bg-white border-violet-200 text-gray-700"
            }`}
          >
            {instrumentEmoji(name)} {name}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={custom}
          className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 disabled:opacity-50 ${
            current && !isPreset
              ? "bg-violet-600 border-violet-600 text-white"
              : "bg-white border-dashed border-violet-300 text-violet-600"
          }`}
        >
          {current && !isPreset ? `${instrumentEmoji(current)} ${current}` : "✏️ 직접 입력"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
