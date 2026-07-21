"use client";

import { useState } from "react";
import type { GroupType } from "@/lib/terms";
import { useRouter } from "next/navigation";
import { createMyCard } from "@/lib/actions/cards";
import { SongTitleField } from "./SongTitleField";

/** 멤버가 스스로 연습할 곡(숙제)을 추가하는 폼. 추가만 가능하고 수정/삭제는 리더만. */
export function AddMyCardForm({
  leaderLabel = "선생님",
  groupType,
}: {
  leaderLabel?: string;
  /** 교재 프리셋은 학원에서만 노출 */
  groupType?: GroupType;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalGrapes, setTotalGrapes] = useState(10);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await createMyCard({
      title,
      description,
      totalGrapes,
      dueDate: dueDate || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setTitle("");
    setDescription("");
    setDueDate("");
    router.refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-13 py-3 rounded-2xl border-2 border-dashed border-violet-300 text-violet-600 font-bold active:bg-violet-50"
      >
        + 연습하고 싶은 곡 직접 추가하기
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white border border-violet-200 p-4 flex flex-col gap-3">
      <h3 className="font-bold text-violet-900">🙋 내가 연습할 곡 추가</h3>
      <p className="text-xs text-gray-500 -mt-1">
        한번 추가하면 스스로 고칠 수 없어요. 바꾸고 싶으면 {leaderLabel}에게 이야기해 주세요!
      </p>
      <SongTitleField value={title} onChange={setTitle} groupType={groupType} />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="연습 목표 (예: 틀리지 않고 끝까지)"
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
      <label className="flex items-center justify-between text-sm font-medium text-gray-700">
        목표 기한 (선택)
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-10 px-3 rounded-lg border border-gray-300 font-bold text-violet-700"
        />
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
          {submitting ? "추가 중..." : "추가하기 🍇"}
        </button>
      </div>
    </form>
  );
}
