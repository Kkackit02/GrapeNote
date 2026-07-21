"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setTitle } from "@/lib/actions/titles";
import { TITLES, isTitleUnlocked, getTitle, type TitleStats } from "@/lib/titles";

interface Props {
  currentTitleId: string | null;
  stats: TitleStats;
}

/** 칭호 없음을 나타내는 미리보기 값 */
const NONE = "__none__";

/**
 * 도전과제 목록 + 칭호 고르기 — 눌러(또는 마우스를 올려) 미리 보고 적용한다.
 * 잠긴 것도 미리보기가 되어 목표가 눈에 보인다.
 */
export function TitlePicker({ currentTitleId, stats }: Props) {
  const router = useRouter();
  const [previewId, setPreviewId] = useState<string>(currentTitleId ?? NONE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const earnedCount = TITLES.filter((t) => isTitleUnlocked(t.id, stats)).length;

  const previewIsNone = previewId === NONE;
  const previewTitle = previewIsNone ? null : getTitle(previewId);
  const previewUnlocked = previewIsNone || isTitleUnlocked(previewId, stats);
  const applied = (currentTitleId ?? NONE) === previewId;

  const apply = async () => {
    if (saving || applied || !previewUnlocked) return;
    setError(null);
    setSaving(true);
    const result = await setTitle(previewIsNone ? null : previewId);
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
        눌러서(PC는 마우스만 올려도) 미리 보고, 마음에 들면 적용하세요.
      </p>

      {/* 미리보기 + 적용 — 목록을 내려도 위에 붙어 있게 sticky */}
      <div className="sticky top-14 z-30 pt-2 pb-2 bg-violet-50/95 backdrop-blur">
        <div className="rounded-2xl bg-white border-2 border-violet-200 shadow-sm p-3 flex items-center gap-3">
          <span className="text-3xl shrink-0">{previewTitle ? previewTitle.emoji : "🙂"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-gray-800 truncate">
              {previewTitle ? previewTitle.name : "칭호 없이 이름만"}
              {applied && <span className="ml-1 text-violet-600">· 달고 있어요</span>}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {previewTitle ? previewTitle.desc : "이름 옆에 아무것도 붙지 않아요"}
            </p>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="button"
              onClick={apply}
              disabled={saving || applied || !previewUnlocked}
              className="mt-1.5 w-full h-10 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:bg-gray-200 disabled:text-gray-400 active:bg-violet-800"
            >
              {saving
                ? "다는 중..."
                : applied
                  ? "지금 달고 있어요"
                  : !previewUnlocked
                    ? "아직 잠겨 있어요"
                    : "이 칭호 달기"}
            </button>
          </div>
        </div>
      </div>

      {/* 칭호 없이 */}
      <button
        type="button"
        onMouseEnter={() => setPreviewId(NONE)}
        onFocus={() => setPreviewId(NONE)}
        onClick={() => setPreviewId(NONE)}
        className={`mt-2 w-full flex items-center justify-between rounded-2xl border-2 p-3 transition-colors ${
          previewId === NONE
            ? "bg-violet-50 border-violet-400"
            : "bg-white border-violet-100 hover:border-violet-300"
        }`}
      >
        <span className="text-sm font-bold text-gray-600">칭호 안 달기</span>
        {currentTitleId === null && <span className="text-xs font-bold text-violet-600">사용 중</span>}
      </button>

      <ul className="mt-2 grid grid-cols-2 gap-2">
        {TITLES.map((title) => {
          const unlocked = isTitleUnlocked(title.id, stats);
          const isPreview = title.id === previewId;
          const inUse = title.id === currentTitleId;
          return (
            <li key={title.id}>
              <button
                type="button"
                onMouseEnter={() => setPreviewId(title.id)}
                onFocus={() => setPreviewId(title.id)}
                onClick={() => setPreviewId(title.id)}
                className={`w-full text-left rounded-2xl border-2 p-3 flex items-center gap-3 transition-colors ${
                  isPreview
                    ? "bg-violet-50 border-violet-400"
                    : unlocked
                      ? "bg-white border-violet-100 hover:border-violet-300"
                      : "bg-gray-50 border-gray-100 hover:border-gray-300"
                }`}
              >
                <span className={`text-2xl ${unlocked ? "" : "grayscale opacity-50"}`}>{title.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-gray-800 flex items-center gap-1">
                    {title.name}
                    {inUse && <span className="text-violet-600">✓</span>}
                  </p>
                  {inUse ? (
                    <p className="text-xs font-bold text-violet-600">달고 있어요</p>
                  ) : unlocked ? (
                    <p className="text-xs text-gray-400">눌러서 미리보기</p>
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
