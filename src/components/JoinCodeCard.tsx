"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { regenerateJoinCode } from "@/lib/actions/invites";
import { CopyButton } from "./CopyButton";

interface Props {
  code: string | null;
}

/** 학원 공용(그룹) 초대코드 카드 — 복사 / 재발급 */
export function JoinCodeCard({ code }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/student/join` : "";

  const regenerate = async () => {
    if (
      code &&
      !window.confirm("코드를 재발급하면 기존 코드는 바로 사용할 수 없어요. 재발급할까요?")
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await regenerateJoinCode();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="rounded-2xl bg-white border border-violet-100 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-500">우리 학원 공용 초대코드</p>
          {code ? (
            <code className="text-2xl font-extrabold tracking-widest text-violet-700">{code}</code>
          ) : (
            <p className="text-sm text-gray-400">아직 코드가 없어요. 발급해 주세요.</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {code && (
            <CopyButton
              text={`🍇 GrapeNote 피아노 진도카드 초대!\n가입 주소: ${joinUrl}\n초대코드: ${code}\n(가입할 때 이름을 입력해 주세요)`}
              label="안내문 복사"
            />
          )}
          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            className="text-xs text-gray-400 underline underline-offset-2 disabled:opacity-50"
          >
            {busy ? "발급 중..." : code ? "재발급" : "코드 발급"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        이 코드 하나로 여러 학생이 가입할 수 있어요. 가입할 때 학생이 직접 이름을 입력해요.
      </p>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
