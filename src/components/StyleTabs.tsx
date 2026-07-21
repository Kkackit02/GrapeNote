"use client";

import { useState } from "react";
import { SkinPicker } from "./SkinPicker";
import { TitlePicker } from "./TitlePicker";
import type { SkinStats } from "@/lib/skins";
import type { TitleStats } from "@/lib/titles";

interface Props {
  currentSkinId: string;
  skinStats: SkinStats;
  currentTitleId: string | null;
  titleStats: TitleStats;
}

/**
 * 꾸미기 화면의 스킨/칭호 탭.
 * 한 화면에 둘 다 두면 각자의 sticky 미리보기가 스크롤 중에 교차하며 튀어서,
 * 한 번에 하나만 보이게 나눈다.
 */
export function StyleTabs({ currentSkinId, skinStats, currentTitleId, titleStats }: Props) {
  const [tab, setTab] = useState<"skin" | "title">("skin");

  const tabClass = (on: boolean) =>
    `flex-1 h-11 rounded-xl text-sm font-extrabold transition-colors ${
      on ? "bg-violet-600 text-white" : "bg-white border-2 border-violet-100 text-violet-700"
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="꾸미기 종류" className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "skin"}
          onClick={() => setTab("skin")}
          className={tabClass(tab === "skin")}
        >
          🎨 포도알 스킨
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "title"}
          onClick={() => setTab("title")}
          className={tabClass(tab === "title")}
        >
          🏅 칭호
        </button>
      </div>

      {tab === "skin" ? (
        <SkinPicker currentSkinId={currentSkinId} stats={skinStats} />
      ) : (
        <TitlePicker currentTitleId={currentTitleId} stats={titleStats} />
      )}
    </div>
  );
}
