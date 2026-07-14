"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCard } from "@/lib/actions/cards";
import { SongTitleField } from "./SongTitleField";

interface Props {
  studentId: string;
}

/** 진도카드 배정 폼 (곡명 + 포도알 개수 + 지시사항) */
export function NewCardForm({ studentId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalGrapes, setTotalGrapes] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await createCard({ studentIds: [studentId], title, description, totalGrapes });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setTitle("");
    setDescription("");
    router.refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-13 py-3 rounded-2xl border-2 border-dashed border-violet-300 text-violet-600 font-bold active:bg-violet-50"
      >
        + 새 진도카드 배정
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white border border-violet-200 p-4 flex flex-col gap-3">
      <h3 className="font-bold text-violet-900">새 진도카드</h3>
      <SongTitleField value={title} onChange={setTitle} />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="지시사항 (예: 손목 힘 빼고 천천히)"
        className="h-12 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      <label className="flex items-center justify-between text-sm font-medium text-gray-700">
        포도알 개수 (연습 횟수)
        <select
          value={totalGrapes}
          onChange={(e) => setTotalGrapes(Number(e.target.value))}
          className="h-10 px-3 rounded-lg border border-gray-300 font-bold text-violet-700"
        >
          {[5, 10, 15, 20, 30].map((n) => (
            <option key={n} value={n}>{n}알</option>
          ))}
        </select>
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-12 rounded-xl bg-gray-100 text-gray-600 font-bold active:bg-gray-200"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="h-12 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
        >
          {submitting ? "배정 중..." : "배정하기 🍇"}
        </button>
      </div>
    </form>
  );
}
