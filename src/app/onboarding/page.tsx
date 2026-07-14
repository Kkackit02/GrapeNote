"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { createAcademy } from "@/lib/actions/teacher-auth";

export default function OnboardingPage() {
  const router = useRouter();
  const [academyName, setAcademyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await createAcademy({ academyName, displayName });
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    // app_metadata가 갱신됐으므로 새 JWT를 받아야 RLS/가드가 동작한다
    await createSupabaseBrowser().auth.refreshSession();
    router.push("/teacher");
    router.refresh();
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-4xl">🏫</div>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">학원 등록</h1>
        <p className="mt-1 text-sm text-gray-500">
          거의 다 됐어요! 학원 정보를 알려 주세요.
          <br />
          개인 레슨이라면 원하는 이름을 자유롭게 지어 주세요.
        </p>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <input
            required
            value={academyName}
            onChange={(e) => setAcademyName(e.target.value)}
            placeholder="학원 이름 (예: 포도피아노교습소)"
            className="h-13 py-3 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="선생님 이름 (예: 김포도 선생님)"
            className="h-13 py-3 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="h-13 py-3 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
          >
            {submitting ? "만드는 중..." : "시작하기 🍇"}
          </button>
        </form>
      </div>
    </main>
  );
}
