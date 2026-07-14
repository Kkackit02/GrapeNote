"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PinPad } from "@/components/PinPad";
import { checkInvite, registerStudent } from "@/lib/actions/student-auth";

export default function StudentJoinPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const [inviteType, setInviteType] = useState<"personal" | "group">("personal");
  const [studentName, setStudentName] = useState("");
  const [academyName, setAcademyName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await checkInvite(code);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInviteType(result.data.type);
    setStudentName(result.data.studentName ?? "");
    setAcademyName(result.data.academyName);
    setStep(2);
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pin.length !== 6) {
      setError("비밀번호 숫자 6자리를 모두 눌러 주세요.");
      return;
    }
    setSubmitting(true);
    const result = await registerStudent({ code, username, pin, studentName });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/me");
    router.refresh();
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-gray-400">← 처음으로</Link>

        {step === 1 ? (
          <>
            <div className="mt-4 text-4xl">💌</div>
            <h1 className="mt-2 text-2xl font-extrabold text-violet-900">초대코드 입력</h1>
            <p className="mt-1 text-sm text-gray-500">선생님께 받은 코드를 입력해 주세요.</p>
            <form onSubmit={verifyCode} className="mt-5 flex flex-col gap-3">
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="GRAPE-XXXX"
                autoCapitalize="characters"
                autoComplete="off"
                className="h-14 px-4 rounded-xl border-2 border-violet-200 text-center text-xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="h-14 rounded-xl bg-violet-600 text-white text-lg font-bold disabled:opacity-50 active:bg-violet-800"
              >
                {submitting ? "확인 중..." : "다음"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mt-4 text-4xl">🎉</div>
            <h1 className="mt-2 text-2xl font-extrabold text-violet-900">
              {inviteType === "personal" ? `${studentName} 님, 환영해요!` : "환영해요!"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {academyName}의 진도카드를 시작해요.
              <br />
              {inviteType === "group"
                ? "이름과 로그인에 쓸 아이디, 비밀번호를 만들어 주세요."
                : "로그인에 쓸 아이디와 비밀번호를 만들어 주세요."}
            </p>
            <form onSubmit={register} className="mt-5 flex flex-col gap-3">
              {inviteType === "group" && (
                <input
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="이름 (예: 김포도)"
                  autoComplete="off"
                  className="h-14 px-4 rounded-xl border-2 border-violet-200 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              )}
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="아이디 (영어 소문자, 숫자 3~12자)"
                autoComplete="off"
                pattern="[a-z0-9]{3,12}"
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
                {submitting ? "만드는 중..." : "가입 완료! 🍇"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
