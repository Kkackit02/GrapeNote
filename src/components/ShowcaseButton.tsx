"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showcaseSubmission, clearShowcase } from "@/lib/actions/showcase";

interface Props {
  submissionId: string;
  /** 지금 이 영상이 내 자랑 영상인지 */
  isCurrent: boolean;
}

/**
 * 합격 영상을 그룹 자랑 벽에 걸거나 내린다 (멤버당 1개).
 * 새로 걸면 이전 자랑 영상은 자동으로 내려간다.
 */
export function ShowcaseButton({ submissionId, isCurrent }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setBusy(true);
    const result = isCurrent ? await clearShowcase() : await showcaseSubmission(submissionId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className={`h-12 rounded-xl text-sm font-bold disabled:opacity-50 ${
          isCurrent
            ? "bg-violet-100 text-violet-700 active:bg-violet-200"
            : "bg-amber-400 text-amber-950 active:bg-amber-500"
        }`}
      >
        {busy
          ? "처리 중..."
          : isCurrent
            ? "⭐ 자랑 벽에 걸려 있어요 (내리기)"
            : "⭐ 이 영상 자랑 벽에 걸기"}
      </button>
      {!isCurrent && (
        <p className="text-center text-[11px] text-gray-400">
          그룹이 볼 수 있게 걸어요. 자랑 영상은 한 번에 하나만 걸려요.
        </p>
      )}
      {error && <p className="text-center text-xs text-red-500">{error}</p>}
    </div>
  );
}
