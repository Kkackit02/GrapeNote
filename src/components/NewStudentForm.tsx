"use client";

import { useState } from "react";
import Link from "next/link";
import { createInvite } from "@/lib/actions/invites";
import { CopyButton } from "@/components/CopyButton";
import type { Terms } from "@/lib/terms";

/** 멤버(학생) 개인 초대코드 발급 폼 — 용어는 그룹 유형 프리셋을 따른다 */
export function NewStudentForm({ terms }: { terms: Terms }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await createInvite(name);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCode(result.data.code);
  };

  if (code) {
    const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/student/join` : "";
    return (
      <div className="max-w-sm mx-auto text-center">
        <div className="text-5xl mt-8">💌</div>
        <h1 className="mt-3 text-2xl font-extrabold text-violet-900">{name} 초대코드</h1>
        <div className="mt-5 rounded-2xl bg-white border-2 border-violet-200 p-6">
          <code className="text-3xl font-extrabold tracking-widest text-violet-700">{code}</code>
          <div className="mt-4 flex justify-center gap-2">
            <CopyButton text={code} label="코드 복사" />
            <CopyButton
              text={`🍇 GrapeNote 연습 진도카드 초대!\n가입 주소: ${joinUrl}\n초대코드: ${code}`}
              label="안내문 복사"
            />
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          코드는 7일간 유효해요.{" "}
          {terms.type === "academy"
            ? "학생(또는 학부모님)께 전달해 주세요."
            : `${terms.member}에게 전달해 주세요.`}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => { setCode(null); setName(""); }}
            className="h-12 rounded-xl bg-violet-100 text-violet-800 font-bold active:bg-violet-300"
          >
            + 다른 {terms.member}도 등록하기
          </button>
          <Link href="/teacher" className="text-sm text-gray-500 underline underline-offset-4">
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto">
      <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
      <h1 className="mt-4 text-2xl font-extrabold text-violet-900">{terms.member} 등록</h1>
      <p className="mt-1 text-sm text-gray-500">
        {terms.member} 이름을 입력하면 그 사람 전용 초대코드가 만들어져요.
        <br />
        {terms.member}은 코드로 아이디와 비밀번호를 만들어 가입해요.
      </p>
      <p className="mt-2 text-xs text-gray-400">
        💡 여러 명을 한 번에 초대하려면 대시보드의 <b>공용 초대코드</b>를 공유하세요.
      </p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${terms.member} 이름 (예: 김포도)`}
          className="h-13 py-3 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="h-13 py-3 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
        >
          {submitting ? "만드는 중..." : "초대코드 만들기 💌"}
        </button>
      </form>
    </div>
  );
}
