"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/lib/actions/reactions";
import type { FeedReaction } from "@/lib/activity";

const EMOJIS = ["🔥", "👏", "🎉"] as const;

interface Props {
  targetKind: "card" | "submission";
  targetId: string;
  reactions: FeedReaction[];
  myId: string;
}

/** 응원 이모지(🔥👏🎉) 토글 바 — 자랑 벽 항목마다 하나씩 */
export function ReactionBar({ targetKind, targetId, reactions, myId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const react = async (emoji: string) => {
    setBusy(emoji);
    const result = await toggleReaction({ targetKind, targetId, emoji });
    setBusy(null);
    if (result.ok) router.refresh();
  };

  return (
    <div className="flex gap-1.5">
      {EMOJIS.map((emoji) => {
        const list = reactions.filter((r) => r.target_id === targetId && r.emoji === emoji);
        const mine = list.some((r) => r.reactor_id === myId);
        return (
          <button
            key={emoji}
            type="button"
            disabled={busy === emoji}
            onClick={() => react(emoji)}
            title={list.map((r) => r.reactor_name).join(", ") || "응원하기"}
            className={`px-2 py-0.5 rounded-full text-xs border disabled:opacity-50 ${
              mine
                ? "bg-violet-100 border-violet-300 font-bold text-violet-700"
                : "bg-gray-50 border-gray-200 text-gray-500"
            }`}
          >
            {emoji}
            {list.length > 0 && ` ${list.length}`}
          </button>
        );
      })}
    </div>
  );
}
