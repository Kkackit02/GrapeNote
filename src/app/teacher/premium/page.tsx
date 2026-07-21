import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getTerms } from "@/lib/terms-server";
import {
  FREE_LIMITS,
  PREMIUM_LIMITS,
  PREMIUM_MONTHLY_PRICE,
  formatBytes,
  isPremiumActive,
} from "@/lib/limits";
import { PremiumInquiryForm } from "@/components/PremiumInquiryForm";
import type { Academy } from "@/lib/types";

/** 요금제 안내 + 업그레이드 문의 (자동 결제는 준비 중) */
export default async function PremiumPage() {
  const supabase = await createSupabaseServer();
  const terms = await getTerms();

  const [{ data: academyRow }, { data: orders }] = await Promise.all([
    supabase.from("academies").select("*").maybeSingle(),
    supabase
      .from("premium_orders")
      .select("id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const academy = academyRow as Academy | null;
  const active = isPremiumActive(academy);
  const pending = (orders ?? []).some((o) => o.status === "inquiry" || o.status === "pending");

  const rows = [
    {
      label: "영상 저장 공간",
      free: formatBytes(FREE_LIMITS.storageBytes),
      premium: formatBytes(PREMIUM_LIMITS.storageBytes),
    },
    {
      label: "판정 후 영상 보관",
      free: `${FREE_LIMITS.retentionDays}일`,
      premium: `${PREMIUM_LIMITS.retentionDays}일`,
    },
    {
      label: "영상 1개 최대 크기",
      free: formatBytes(FREE_LIMITS.maxUploadBytes),
      premium: formatBytes(PREMIUM_LIMITS.maxUploadBytes),
    },
    { label: "촬영 화질", free: "480p", premium: "720p HD" },
    { label: "🎧 반주(MR) 녹화", free: "✓", premium: "✓" },
    { label: "🗂 구글 드라이브 백업", free: "✓", premium: "✓" },
  ];

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto w-full">
      <div>
        <Link href="/teacher/settings" className="text-sm text-gray-400">← 그룹 설정</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">✨ 프리미엄</h1>
        <p className="mt-1 text-sm text-gray-500">
          {terms.group} 단위로 적용돼요 — 한 번 켜면 모든 {terms.member}에게 함께 적용됩니다.
        </p>
      </div>

      {active ? (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4">
          <p className="font-extrabold text-amber-900">✨ 프리미엄 이용 중이에요!</p>
          <p className="mt-1 text-sm text-amber-800">
            {academy?.premium_until
              ? `${new Date(academy.premium_until).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}까지 이용할 수 있어요.`
              : "기간 제한 없이 이용 중이에요."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-violet-100 p-4 text-center">
          <p className="text-sm text-gray-500">현재 무료로 이용 중이에요</p>
          <p className="mt-1 text-2xl font-extrabold text-violet-900">
            월 {PREMIUM_MONTHLY_PRICE.toLocaleString()}원
          </p>
          <p className="text-xs text-gray-400">그룹 전체 · 인원 제한 없음</p>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-violet-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-violet-50 text-violet-900">
              <th className="px-3 py-2.5 text-left font-extrabold">기능</th>
              <th className="px-2 py-2.5 font-bold text-gray-500">무료</th>
              <th className="px-2 py-2.5 font-extrabold">✨ 프리미엄</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className={index % 2 ? "bg-gray-50/60" : ""}>
                <td className="px-3 py-2 font-bold text-gray-700">{row.label}</td>
                <td className="px-2 py-2 text-center text-gray-500">{row.free}</td>
                <td className="px-2 py-2 text-center font-bold text-violet-700">{row.premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        프리미엄 수익은 영상 저장 비용(Supabase)에 쓰여요. 무료로도 핵심 기능은 모두 쓸 수 있고,
        저장 공간과 보관 기간만 달라져요.
      </p>

      {!active && <PremiumInquiryForm pending={pending} />}
    </div>
  );
}
