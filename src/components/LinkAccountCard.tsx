"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkAccount, unlinkAccount } from "@/lib/actions/account-switch";

interface Props {
  /** 이미 연결돼 있으면 그 계정 이름 */
  linkedName: string | null;
}

/**
 * 멤버 계정 연결 관리 (리더 설정).
 * 처음 한 번 멤버 아이디/PIN으로 연결하면, 이후 헤더의 🔄 버튼으로 원탭 전환한다.
 */
export function LinkAccountCard({ linkedName }: Props) {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await linkAccount({ loginId, password: pin });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLoginId("");
    setPin("");
    router.refresh();
  };

  const unlink = async () => {
    if (!window.confirm("연결을 해제할까요? 다시 연결하려면 아이디/PIN이 필요해요.")) return;
    setBusy(true);
    await unlinkAccount();
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="rounded-2xl bg-white border border-violet-100 p-4">
      <p className="font-bold text-gray-700">🔄 내 멤버 계정 연결</p>
      <p className="mt-1 text-xs text-gray-400">
        나도 연주자라면, 내 멤버 계정을 연결해 두세요. 이후 화면 위 <b>🔄 전환</b> 버튼으로
        재로그인 없이 리더↔멤버를 오갈 수 있어요.
      </p>

      {linkedName ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-violet-700">
            ✅ 「{linkedName}」 멤버 계정과 연결됨
          </span>
          <button
            type="button"
            onClick={unlink}
            disabled={busy}
            className="text-xs font-bold text-gray-400 underline underline-offset-2 disabled:opacity-50"
          >
            연결 해제
          </button>
        </div>
      ) : (
        <form onSubmit={link} className="mt-3 flex flex-col gap-2">
          <input
            value={loginId}
            onChange={(e) => setLoginId(e.target.value.toLowerCase())}
            placeholder="멤버 계정 아이디"
            autoComplete="off"
            className="h-11 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="멤버 계정 PIN 6자리"
            inputMode="numeric"
            className="h-11 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={busy || !loginId || pin.length !== 6}
            className="h-11 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50 active:bg-violet-800"
          >
            {busy ? "연결 중..." : "멤버 계정 연결하기"}
          </button>
        </form>
      )}
    </div>
  );
}
