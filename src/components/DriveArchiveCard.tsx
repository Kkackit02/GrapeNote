"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { disconnectDrive } from "@/lib/actions/drive";

interface Props {
  connected: boolean;
  /** GOOGLE_CLIENT_ID/SECRET 환경변수가 세팅됐는지 */
  configured: boolean;
}

/** 구글 드라이브 아카이브 카드 — 정리 삭제 직전에 영상을 그룹장 드라이브로 백업 */
export function DriveArchiveCard({ connected, configured }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = async () => {
    if (!window.confirm("드라이브 백업을 끌까요? 이미 백업된 파일은 드라이브에 그대로 남아요.")) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await disconnectDrive();
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
        <p className="font-bold text-gray-700 text-sm">
          🗂 구글 드라이브 백업
          {connected && (
            <span className="ml-1.5 text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full align-middle">
              켜짐
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          {connected
            ? "정리 삭제 직전에 영상이 내 드라이브의 'GrapeNote 아카이브' 폴더로 백업돼요."
            : "연결하면 보존 기간이 지나 정리되는 영상을 내 드라이브에 자동 백업해요."}
        </p>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
      {connected ? (
        <button
          type="button"
          disabled={busy}
          onClick={disconnect}
          className="shrink-0 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold disabled:opacity-50 active:bg-gray-200"
        >
          해제
        </button>
      ) : configured ? (
        <a
          href="/api/google/connect"
          className="shrink-0 px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold active:bg-violet-800"
        >
          연결하기
        </a>
      ) : (
        <span className="shrink-0 text-xs text-gray-400">설정 준비 중</span>
      )}
    </div>
  );
}
