"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { shareCompletion } from "@/lib/actions/cards";

interface Props {
  cardId: string;
  shared: boolean;
}

/** 완성한 포도송이를 그룹에 자랑하기 — 누르기 전까지 완성 사실은 공개되지 않는다 */
export function ShareCompletionButton({ cardId, shared }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (shared) {
    return (
      <p className="text-center text-sm font-bold text-violet-600">
        📣 친구들에게 자랑했어요!
      </p>
    );
  }

  const share = async () => {
    setError(null);
    setBusy(true);
    const result = await shareCompletion(cardId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={share}
        className="h-13 py-3 rounded-2xl bg-amber-400 text-amber-950 font-extrabold disabled:opacity-50 active:bg-amber-500"
      >
        {busy ? "알리는 중..." : "📣 친구들에게 자랑하기"}
      </button>
      <p className="text-center text-xs text-gray-400">
        누르기 전까지는 완성 사실이 그룹에 공개되지 않아요.
      </p>
      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}
