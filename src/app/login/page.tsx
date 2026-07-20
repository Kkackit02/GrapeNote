"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function TeacherLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createSupabaseBrowser();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(
          error.message.includes("already registered")
            ? "이미 가입된 이메일입니다. 로그인해 주세요."
            : "가입에 실패했습니다. 비밀번호는 6자 이상이어야 합니다."
        );
        setSubmitting(false);
        return;
      }
      // 이메일 인증이 켜진 프로젝트는 세션 없이 성공한다 — 그대로 진행하면 무한 튕김
      if (!data.session) {
        setError("메일함으로 인증 링크를 보냈어요. 링크를 누른 뒤 로그인해 주세요.");
        setSubmitting(false);
        setMode("login");
        return;
      }
      router.push("/onboarding");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        setSubmitting(false);
        return;
      }
      router.push("/teacher"); // 학원 미등록이면 proxy가 /onboarding으로 보냄
    }
    router.refresh();
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-gray-400">← 처음으로</Link>
        <h1 className="mt-4 text-2xl font-extrabold text-violet-900">
          🧑‍🏫 리더 {mode === "login" ? "로그인" : "가입"}
        </h1>

        <div className="mt-4 grid grid-cols-2 rounded-xl bg-violet-100 p-1 text-sm font-bold">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className={`py-2 rounded-lg ${mode === m ? "bg-white text-violet-800 shadow" : "text-violet-500"}`}
            >
              {m === "login" ? "로그인" : "새로 가입"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            className="h-13 py-3 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (6자 이상)"
            className="h-13 py-3 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="h-13 py-3 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
          >
            {submitting ? "잠시만요..." : mode === "login" ? "로그인" : "가입하기"}
          </button>
        </form>
      </div>
    </main>
  );
}
