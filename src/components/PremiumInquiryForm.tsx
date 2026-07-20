"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestPremium } from "@/lib/actions/billing";
import { PREMIUM_MONTHLY_PRICE } from "@/lib/limits";

const MONTH_OPTIONS = [1, 3, 6, 12];

/** 프리미엄 업그레이드 문의 — 결제 연동 전에는 운영자가 확인 후 수동으로 켜 준다 */
export function PremiumInquiryForm({ pending }: { pending: boolean }) {
  const router = useRouter();
  const [months, setMonths] = useState(1);
  const [contact, setContact] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (pending || done) {
    return (
      <div className="rounded-2xl bg-violet-50 border border-violet-200 p-5 text-center">
        <div className="text-3xl">📮</div>
        <p className="mt-2 font-extrabold text-violet-900">문의가 접수됐어요!</p>
        <p className="mt-1 text-sm text-violet-700">
          확인 후 남겨주신 연락처로 안내드릴게요. 보통 하루 안에 답변드려요.
        </p>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await requestPremium({ months, contact, memo });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white border border-violet-100 p-5 flex flex-col gap-3">
      <h2 className="font-extrabold text-violet-900">✨ 프리미엄 문의하기</h2>
      <p className="-mt-1 text-xs text-gray-500">
        아직 자동 결제를 준비 중이에요. 문의를 남겨주시면 확인 후 안내드릴게요.
      </p>

      <div>
        <p className="text-sm font-bold text-gray-700">이용 기간</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {MONTH_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              className={`px-3 py-2 rounded-xl text-sm font-bold border-2 ${
                months === m
                  ? "bg-violet-600 border-violet-600 text-white"
                  : "bg-white border-violet-200 text-gray-700"
              }`}
            >
              {m}개월
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-sm font-bold text-violet-700">
          예상 금액 {(months * PREMIUM_MONTHLY_PRICE).toLocaleString()}원
          <span className="ml-1 text-xs font-medium text-gray-400">
            (월 {PREMIUM_MONTHLY_PRICE.toLocaleString()}원 · 그룹 전체)
          </span>
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-bold text-gray-700">
        연락받을 곳
        <input
          required
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="이메일 또는 카카오톡 아이디"
          className="h-12 px-4 rounded-xl border border-gray-300 font-normal focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-bold text-gray-700">
        하고 싶은 말 (선택)
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          placeholder="예: 다음 달 공연 전까지 쓰고 싶어요"
          className="rounded-xl border border-gray-300 p-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="h-13 py-3 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
      >
        {busy ? "보내는 중..." : "문의 남기기"}
      </button>
    </form>
  );
}
