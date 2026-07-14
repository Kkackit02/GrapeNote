"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateCard, deleteCard } from "@/lib/actions/cards";
import { dueBadge, formatDue } from "@/lib/due";
import type { ProgressCard } from "@/lib/types";

interface Props {
  card: ProgressCard;
  studentName: string;
  /** 합격한 포도알 수 */
  done: number;
  /** 학생이 스스로 추가한 숙제인지 */
  selfAdded: boolean;
}

/** 숙제 관리 패널의 카드 한 줄: 요약 + 인라인 수정 폼 + 삭제 */
export function HomeworkAdminItem({ card, studentName, done, selfAdded }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [totalGrapes, setTotalGrapes] = useState(card.total_grapes);
  const [dueDate, setDueDate] = useState(card.due_date ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const badge = dueBadge(card.due_date);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await updateCard({
      cardId: card.id,
      title,
      description,
      totalGrapes,
      dueDate: dueDate || null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  const remove = async () => {
    if (!window.confirm(`'${card.title}' 숙제를 삭제할까요?\n제출된 영상 이력도 함께 사라지고 되돌릴 수 없어요.`)) {
      return;
    }
    setError(null);
    setBusy(true);
    const result = await deleteCard(card.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  if (editing) {
    return (
      <form onSubmit={save} className="rounded-2xl bg-white border-2 border-violet-300 p-4 flex flex-col gap-3">
        <h3 className="font-bold text-violet-900">✏️ 숙제 수정 — {studentName}</h3>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="곡 이름"
          className="h-12 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="지시사항 (예: 손목 힘 빼고 천천히)"
          className="h-12 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <label className="flex items-center justify-between text-sm font-medium text-gray-700">
          포도알 개수 (연습 횟수)
          <input
            type="number"
            min={1}
            max={60}
            value={totalGrapes}
            onChange={(e) => setTotalGrapes(Number(e.target.value))}
            className="w-24 h-10 px-3 rounded-lg border border-gray-300 text-center font-bold text-violet-700"
          />
        </label>
        <label className="flex items-center justify-between text-sm font-medium text-gray-700">
          기한 (비우면 기한 없음)
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
            onClick={() => setEditing(false)}
            className="h-11 rounded-xl bg-gray-100 text-gray-600 font-bold active:bg-gray-200"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
          >
            {busy ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-violet-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/teacher/cards/${card.id}`} className="font-bold text-gray-800 active:text-violet-700">
            {card.completed_at ? "🏆 " : "🎵 "}
            {card.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            {selfAdded && (
              <span className="px-2 py-0.5 rounded-full font-bold bg-sky-100 text-sky-700">
                🙋 학생이 직접 추가
              </span>
            )}
            {badge && (
              <span className={`px-2 py-0.5 rounded-full font-bold ${badge.className}`}>
                {badge.text}
              </span>
            )}
          </div>
          {card.description && (
            <p className="mt-1 text-sm text-gray-500 truncate">{card.description}</p>
          )}
          <p className="mt-1 text-sm text-gray-400">
            🍇 {done} / {card.total_grapes}알
            {card.due_date && ` · ${formatDue(card.due_date)}까지`}
            {` · ${new Date(card.created_at).toLocaleDateString("ko-KR")} 배정`}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => { setEditing(true); setError(null); }}
            className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-sm font-bold active:bg-violet-100"
          >
            수정
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-sm font-bold disabled:opacity-50 active:bg-red-100"
          >
            삭제
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
