"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { createAcademy } from "@/lib/actions/teacher-auth";
import { LogoutButton } from "@/components/LogoutButton";
import { TERMS, type GroupType } from "@/lib/terms";

const TYPE_OPTIONS: { type: GroupType; label: string; example: string; namePlaceholder: string }[] = [
  { type: "academy", label: "🏫 학원·레슨", example: "선생님과 수강생", namePlaceholder: "학원 이름 (예: 포도피아노교습소)" },
  { type: "club", label: "🎸 동아리·밴드", example: "운영진과 멤버", namePlaceholder: "동아리 이름 (예: 너드더락)" },
  { type: "other", label: "🎵 그 외", example: "리더와 멤버", namePlaceholder: "그룹 이름" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [groupType, setGroupType] = useState<GroupType>("academy");
  const [academyName, setAcademyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const option = TYPE_OPTIONS.find((o) => o.type === groupType)!;
  const terms = TERMS[groupType];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await createAcademy({ academyName, displayName, groupType });
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    // app_metadata가 갱신됐으므로 새 JWT를 받아야 RLS/가드가 동작한다.
    // 실패하면 /teacher가 다시 온보딩으로 튕기므로 한 번 더 시도한다.
    const supabase = createSupabaseBrowser();
    let refresh = await supabase.auth.refreshSession();
    if (refresh.error) refresh = await supabase.auth.refreshSession();
    if (refresh.error) {
      setError("설정을 마무리하지 못했어요. 다시 시도하거나 로그아웃 후 로그인해 주세요.");
      setSubmitting(false);
      return;
    }
    router.push("/teacher");
    router.refresh();
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* 잘못 들어온 사람이 빠져나갈 수 있어야 한다 (로그아웃 = 랜딩으로) */}
        <div className="flex justify-end">
          <LogoutButton />
        </div>
        <div className="text-4xl">🍇</div>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">그룹 만들기</h1>
        <p className="mt-1 text-sm text-gray-500">
          거의 다 됐어요! 어떤 그룹인지 알려 주세요.
          <br />
          유형에 따라 화면 용어가 달라져요 ({option.example}).
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((o) => (
            <button
              key={o.type}
              type="button"
              onClick={() => setGroupType(o.type)}
              className={`py-3 rounded-xl text-sm font-bold border-2 ${
                groupType === o.type
                  ? "bg-violet-600 border-violet-600 text-white"
                  : "bg-white border-violet-200 text-gray-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <input
            required
            value={academyName}
            onChange={(e) => setAcademyName(e.target.value)}
            placeholder={option.namePlaceholder}
            className="h-13 py-3 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={`내 이름 (${terms.leader}으로 표시돼요)`}
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
