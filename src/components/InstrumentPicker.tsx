"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setStudentInstrument } from "@/lib/actions/students";
import { INSTRUMENT_PRESETS, instrumentEmoji, parseInstruments } from "@/lib/instruments";

interface Props {
  studentId: string;
  current: string | null;
}

/** 멤버 악기(세션) 다중 지정 — 곡 편성 그룹핑과 악기 파트 팀의 기준. 첫 번째가 주 세션. */
export function InstrumentPicker({ studentId, current }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = parseInstruments(current);
  const customs = list.filter(
    (name) => !(INSTRUMENT_PRESETS as readonly string[]).includes(name)
  );

  const apply = async (next: string[]) => {
    setError(null);
    setBusy(true);
    const result = await setStudentInstrument(studentId, next.join(", ") || null);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  const toggle = (name: string) => {
    void apply(list.includes(name) ? list.filter((n) => n !== name) : [...list, name]);
  };

  const addCustom = () => {
    const value = window.prompt("악기 이름을 입력해 주세요 (예: 색소폰)");
    if (!value) return;
    const name = value.trim();
    if (!name || list.includes(name)) return;
    void apply([...list, name]);
  };

  return (
    <div className="rounded-2xl bg-white border border-violet-100 p-4">
      <p className="font-bold text-gray-700 text-sm">
        🎼 맡은 악기 (세션){" "}
        <span className="font-medium text-gray-400">— 여러 개 선택, 첫 번째가 주 세션</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {INSTRUMENT_PRESETS.map((name) => (
          <button
            key={name}
            type="button"
            disabled={busy}
            onClick={() => toggle(name)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 disabled:opacity-50 ${
              list.includes(name)
                ? "bg-violet-600 border-violet-600 text-white"
                : "bg-white border-violet-200 text-gray-700"
            }`}
          >
            {instrumentEmoji(name)} {name}
          </button>
        ))}
        {customs.map((name) => (
          <button
            key={name}
            type="button"
            disabled={busy}
            onClick={() => toggle(name)}
            title="누르면 빼요"
            className="px-3 py-1.5 rounded-full text-sm font-bold border-2 bg-violet-600 border-violet-600 text-white disabled:opacity-50"
          >
            {instrumentEmoji(name)} {name} ✕
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={addCustom}
          className="px-3 py-1.5 rounded-full text-sm font-bold border-2 border-dashed border-violet-300 text-violet-600 disabled:opacity-50"
        >
          ✏️ 직접 입력
        </button>
      </div>
      {list.length > 1 && (
        <p className="mt-2 text-xs text-gray-400">
          주 세션: {instrumentEmoji(list[0])} {list[0]}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
