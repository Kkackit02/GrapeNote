"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setTitle } from "@/lib/actions/titles";
import { TITLES, isTitleUnlocked, type TitleStats } from "@/lib/titles";

interface Props {
  currentTitleId: string | null;
  stats: TitleStats;
}

/** 도전과제 목록 + 칭호 고르기 — 깬 것만 이름 옆에 달 수 있다 */
export function TitlePicker({ currentTitleId, stats }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const earnedCount = TITLES.filter((t) => isTitleUnlocked(t.id, stats)).length;

  const pick = async (id: string | null) => {
    if (saving) return;
    setError(null);
    setSaving(true);
    const result = await setTitle(id);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <section>
      <h2 className="text-lg font-extrabold text-violet-900">
        🏅 도전과제 · 칭호{" "}
        <span className="text-sm text-gray-400 font-bold">{earnedCount}/{TITLES.length}</span>
      </h2>
      <p className="mt-0.5 text-xs text-gray-400">
        깬 도전과제를 눌러 이름 옆 칭호로 달아 보세요.
      </p>
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}

      <div className="mt-2 flex items-center justify-between rounded-2xl border-2 border-violet-100 bg-white p-3">
        <span className="text-sm font-bold text-gray-600">칭호 안 달기</span>
        <button
          type="button"
          onClick={() => pick(null)}
          disabled={saving || currentTitleId === null}
          className={`text-xs font-bold px-3 py-1.5 rounded-full ${
            currentTitleId === null ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500"
          } disabled:opacity-60`}
        >
          {currentTitleId === null ? "사용 중" : "선택"}
        </button>
      </div>

      <ul className="mt-2 grid grid-cols-2 gap-2">
        {TITLES.map((title) => {
          const unlocked = isTitleUnlocked(title.id, stats);
          const selected = title.id === currentTitleId;
          return (
            <li key={title.id}>
              <button
                type="button"
                onClick={() => unlocked && pick(title.id)}
                disabled={!unlocked || selected || saving}
                className={`w-full text-left rounded-2xl border-2 p-3 flex items-center gap-3 ${
                  selected
                    ? "bg-violet-50 border-violet-400"
                    : unlocked
                      ? "bg-white border-violet-100 active:bg-violet-50"
                      : "bg-gray-50 border-gray-100"
                }`}
              >
                <span className={`text-2xl ${unlocked ? "" : "grayscale opacity-50"}`}>{title.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-gray-800 flex items-center gap-1">
                    {title.name}
                    {selected && <span className="text-violet-600">✓</span>}
                  </p>
                  {selected ? (
                    <p className="text-xs font-bold text-violet-600">달고 있어요</p>
                  ) : unlocked ? (
                    <p className="text-xs text-gray-400">{saving ? "..." : "눌러서 달기"}</p>
                  ) : (
                    <p className="text-xs text-gray-400 truncate">🔒 {title.desc}</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
