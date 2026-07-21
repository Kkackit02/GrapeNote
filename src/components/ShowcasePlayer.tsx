"use client";

import { useState } from "react";
import { getShowcasePlaybackUrl } from "@/lib/actions/showcase";
import { getSkin, skinForIndex, RANDOM_SKIN_ID } from "@/lib/skins";

interface Props {
  submissionId: string;
  memberName: string;
  songTitle: string;
  grapeIndex: number;
  skinId: string;
  /** 랜덤 포도용 — 이 멤버가 가진 스킨 id 목록 */
  randomPool?: string[];
  /** 내가 건 자랑 영상인지 (배지 표시용) */
  mine?: boolean;
}

/** 자랑 영상 한 개 — 누르면 그 자리에서 signed URL을 받아 재생한다. */
export function ShowcasePlayer({
  submissionId,
  memberName,
  songTitle,
  grapeIndex,
  skinId,
  randomPool,
  mine,
}: Props) {
  // 랜덤 포도면 가진 스킨 중 하나로 대표 색을 잡는다 (기본 머루로 떨어지지 않게)
  const pool = skinId === RANDOM_SKIN_ID ? (randomPool ?? []) : [];
  const skin = pool.length > 1 ? skinForIndex(pool, 1) : getSkin(skinId);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    const result = await getShowcasePlaybackUrl(submissionId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUrl(result.data.url);
  };

  return (
    <div className="rounded-2xl bg-white border-2 border-violet-100 overflow-hidden">
      {url ? (
        <video src={url} controls autoPlay playsInline className="w-full bg-black aspect-video" />
      ) : (
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="w-full aspect-video flex flex-col items-center justify-center gap-1 disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${skin.colors[0]}, ${skin.colors[skin.colors.length - 1]})` }}
        >
          <span className="text-4xl">{loading ? "⏳" : "▶️"}</span>
          <span className="text-sm font-bold text-white/90 drop-shadow">
            {loading ? "불러오는 중..." : "눌러서 재생"}
          </span>
        </button>
      )}
      <div className="px-3 py-2">
        <p className="text-sm font-extrabold text-gray-800 truncate">
          {mine && <span className="text-violet-600">⭐ </span>}
          {memberName} · 「{songTitle}」
        </p>
        <p className="text-xs text-gray-400">포도알 #{grapeIndex} 자랑</p>
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </div>
    </div>
  );
}
