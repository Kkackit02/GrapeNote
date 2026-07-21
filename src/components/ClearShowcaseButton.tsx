"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearShowcase } from "@/lib/actions/showcase";

/** 내가 건 자랑 영상을 내린다 */
export function ClearShowcaseButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = async () => {
    setError(null);
    setBusy(true);
    const result = await clearShowcase();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-1 items-start">
    <button
      type="button"
      disabled={busy}
      onClick={clear}
      className="self-start text-xs font-bold text-gray-400 underline underline-offset-2 disabled:opacity-50"
    >
      {busy ? "내리는 중..." : "내가 건 자랑 영상 내리기"}
    </button>
    {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
