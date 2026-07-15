"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignSongToStudent } from "@/lib/actions/cards";

interface Props {
  title: string;
  studentId: string;
  studentName: string;
}

/** 현황판 빈칸 — 누르면 그 곡을 그 멤버에게 바로 배정 */
export function AssignCell({ title, studentId, studentName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const assign = async () => {
    if (!window.confirm(`${studentName} 님에게 「${title}」을(를) 배정할까요?`)) return;
    setBusy(true);
    const result = await assignSongToStudent({ title, studentId });
    setBusy(false);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={assign}
      aria-label={`${studentName}에게 ${title} 배정`}
      className="block w-full px-2 py-2 text-gray-300 hover:bg-violet-50 hover:text-violet-500 disabled:opacity-50"
    >
      {busy ? "…" : "＋"}
    </button>
  );
}
