"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setLeaderAssign } from "@/lib/actions/academy";

/** 파트장 숙제 배정 허용 토글 — 켜면 파트장이 자기 팀원에게 숙제를 낼 수 있다 */
export function LeaderAssignToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setError(null);
    setBusy(true);
    const result = await setLeaderAssign(!enabled);
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
        <p className="font-bold text-gray-700 text-sm">🎯 파트장도 숙제 내기</p>
        <p className="mt-0.5 text-xs text-gray-400">
          켜면 파트장(세션장)이 자기 팀원에게 직접 숙제를 낼 수 있어요.
        </p>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={toggle}
        aria-label={enabled ? "파트장 배정 끄기" : "파트장 배정 켜기"}
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
