"use client";

import { useState } from "react";
import { switchAccount } from "@/lib/actions/account-switch";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { EmailOtpType } from "@supabase/supabase-js";

interface Props {
  /** 버튼 문구 (예: "🔄 멤버로", "🔄 리더로") */
  label: string;
}

/**
 * 연결된 다른 역할 계정으로 원탭 전환.
 * 서버가 발급한 매직링크 토큰으로 브라우저 세션을 교체한 뒤 해당 홈으로 이동한다.
 */
export function AccountSwitchButton({ label }: Props) {
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    const res = await switchAccount();
    if (!res.ok) {
      setBusy(false);
      window.alert(res.error);
      return;
    }

    // 세션 교체 — supabase 버전에 따라 검증 타입이 달라 둘 다 시도한다
    const supabase = createSupabaseBrowser();
    let switched = false;
    for (const type of ["email", "magiclink"] as EmailOtpType[]) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: res.data.tokenHash, type });
      if (!error) {
        switched = true;
        break;
      }
    }
    if (!switched) {
      setBusy(false);
      window.alert("전환에 실패했어요. 다시 시도해 주세요.");
      return;
    }
    // 전체 새로고침으로 새 세션이 서버(프록시)에 반영되게 한다
    window.location.href = res.data.redirectTo;
  };

  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      className="text-sm font-bold text-violet-600 hover:text-violet-800 disabled:opacity-50"
    >
      {busy ? "전환 중..." : label}
    </button>
  );
}
