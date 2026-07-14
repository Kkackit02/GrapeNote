"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { PinPad } from "@/components/PinPad";

export default function StudentLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pin.length !== 6) {
      setError("비밀번호 숫자 6자리를 모두 눌러 주세요.");
      return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email: `${username.trim().toLowerCase()}@student.grapenote.app`,
      password: pin,
    });
    if (error) {
      setError("아이디 또는 비밀번호가 맞지 않아요. 다시 확인해 주세요.");
      setPin("");
      setSubmitting(false);
      return;
    }
    router.push("/me");
    router.refresh();
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-gray-400">← 처음으로</Link>
        <div className="mt-4 text-4xl">🎹</div>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">학생 로그인</h1>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="아이디"
            autoComplete="username"
            className="h-14 px-4 rounded-xl border-2 border-violet-200 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <p className="text-center text-sm font-medium text-gray-600">비밀번호 숫자 6자리</p>
          <PinPad value={pin} onChange={setPin} />
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="h-14 rounded-xl bg-violet-600 text-white text-lg font-bold disabled:opacity-50 active:bg-violet-800"
          >
            {submitting ? "들어가는 중..." : "들어가기 🍇"}
          </button>
          <Link href="/student/join" className="text-center text-sm text-violet-600 underline underline-offset-4">
            아직 계정이 없나요? 초대코드로 가입하기
          </Link>
        </form>
      </div>
    </main>
  );
}
