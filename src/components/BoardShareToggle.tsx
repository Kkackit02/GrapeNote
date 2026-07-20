"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setBoardVisibility } from "@/lib/actions/academy";

/** 멤버 간 현황 공개 토글 — 켜면 멤버도 읽기 전용 현황판(/me/board)을 본다 */
export function BoardShareToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setError(null);
    setBusy(true);
    const result = await setBoardVisibility(!enabled);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="rounded-2xl bg-white border border-violet-100 p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-bold text-gray-700 text-sm">👀 멤버끼리 현황 공개</p>
        <p className="mt-0.5 text-xs text-gray-400">
          켜면 멤버도 곡×멤버 현황판을 볼 수 있어요 — 서로 자극받는 구조!
        </p>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={toggle}
        aria-label={enabled ? "현황 공개 끄기" : "현황 공개 켜기"}
        className={`shrink-0 w-13 h-7 rounded-full p-0.5 transition-colors disabled:opacity-50 ${
          enabled ? "bg-violet-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-6" : ""
          }`}
        />
      </button>
    </div>
  );
}
