"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSongLineup } from "@/lib/actions/songs";
import { instrumentBadge, parseInstruments } from "@/lib/instruments";

export interface LineupStudent {
  id: string;
  name: string;
  instrument: string | null;
  /** 이 곡 카드에 제출 기록이 있어 빼도 카드는 남는 멤버 */
  hasRecords: boolean;
}

interface Props {
  title: string;
  teamLabel: string | null;
  students: LineupStudent[];
  assignedIds: string[];
}

/** 현황판 곡명 — 누르면 그 곡의 편성을 체크박스로 바로 수정 */
export function SongRowHeader({ title, teamLabel, students, assignedIds }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set(assignedIds));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const original = new Set(assignedIds);
  const addIds = [...checked].filter((id) => !original.has(id));
  const removeIds = [...original].filter((id) => !checked.has(id));
  const dirty = addIds.length > 0 || removeIds.length > 0;

  const openModal = () => {
    setChecked(new Set(assignedIds));
    setError(null);
    setOpen(true);
  };

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    const result = await updateSongLineup({ title, addIds, removeIds });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-left font-bold text-gray-800 hover:text-violet-700"
        title="편성 수정"
      >
        🎵 {title}
        {teamLabel && teamLabel !== title && (
          <span className="ml-1.5 text-[10px] font-bold text-violet-400">{teamLabel}</span>
        )}
        <span className="ml-1 text-[10px] text-gray-300">✎</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-5 flex flex-col gap-3 whitespace-normal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-violet-900">🎵 {title} 편성</h3>
            <ul className="flex flex-col gap-1.5">
              {students.map((s) => {
                const on = checked.has(s.id);
                const willRemove = original.has(s.id) && !on;
                return (
                  <li key={s.id}>
                    <label className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 border-2 border-transparent hover:bg-violet-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(s.id)}
                        className="w-5 h-5 accent-violet-600"
                      />
                      <span className="flex-1 text-sm font-bold text-gray-800">
                        {instrumentBadge(s.instrument) || "🎵"} {s.name}
                        {s.instrument && (
                          <span className="ml-1 text-xs font-medium text-gray-400">
                            {parseInstruments(s.instrument).join("·")}
                          </span>
                        )}
                      </span>
                      {willRemove && s.hasRecords && (
                        <span className="text-[10px] font-bold text-orange-500">기록은 남아요</span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>

            {removeIds.length > 0 && (
              <p className="text-xs text-gray-400">
                빼는 멤버의 카드는 제출 기록이 없을 때만 삭제돼요. 기록이 있으면 카드는 남아요.
              </p>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-12 rounded-xl bg-gray-100 text-gray-600 font-bold active:bg-gray-200"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={busy || !dirty}
                onClick={save}
                className="h-12 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
              >
                {busy ? "저장 중..." : `저장 (+${addIds.length} / −${removeIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
