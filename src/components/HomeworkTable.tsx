"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateCard, deleteCard } from "@/lib/actions/cards";
import { dueBadge } from "@/lib/due";

export interface HomeworkRow {
  id: string;
  title: string;
  studentId: string;
  studentName: string;
  description: string | null;
  done: number;
  totalGrapes: number;
  pending: number;
  retry: number;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  /** 멤버가 스스로 추가한 숙제인지 */
  selfAdded: boolean;
}

type SortKey = "title" | "studentName" | "progress" | "dueDate" | "createdAt";
type StatusFilter = "all" | "ongoing" | "pending" | "retry" | "completed" | "due";

interface Props {
  rows: HomeworkRow[];
  memberLabel: string;
}

/** 숙제 관리 표: 곡×멤버 배정 현황을 보고 그 자리에서 수정·삭제한다 */
export function HomeworkTable({ rows, memberLabel }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDesc, setSortDesc] = useState(true);
  const [editing, setEditing] = useState<HomeworkRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(key === "createdAt" || key === "progress");
    }
  };

  const matchesFilter = (row: HomeworkRow) => {
    switch (filter) {
      case "ongoing":
        return !row.completedAt;
      case "pending":
        return row.pending > 0;
      case "retry":
        return row.retry > 0;
      case "completed":
        return !!row.completedAt;
      case "due": {
        if (!row.dueDate || row.completedAt) return false;
        const badge = dueBadge(row.dueDate);
        return !!badge && !badge.className.includes("violet");
      }
      default:
        return true;
    }
  };

  const filtered = rows
    .filter(matchesFilter)
    .filter((row) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return (
        row.title.toLowerCase().includes(needle) ||
        row.studentName.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => {
      let cmp: number;
      if (sortKey === "progress") {
        cmp = a.done / a.totalGrapes - b.done / b.totalGrapes;
      } else if (sortKey === "dueDate") {
        cmp = (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
      } else if (sortKey === "createdAt") {
        cmp = a.createdAt.localeCompare(b.createdAt);
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]), "ko");
      }
      return sortDesc ? -cmp : cmp;
    });

  const remove = async (row: HomeworkRow) => {
    // 제출 기록이 있으면 영상까지 사라지므로 곡명 입력을 요구한다 (오클릭 방지)
    const videos = row.done + row.pending + row.retry;
    if (videos > 0) {
      const typed = window.prompt(
        `${row.studentName} 님의 「${row.title}」 숙제를 삭제하면\n제출된 영상 ${videos}개와 판정 기록이 전부 사라져요. 되돌릴 수 없어요!\n\n정말 삭제하려면 곡 이름을 그대로 입력해 주세요:`
      );
      if (typed === null) return;
      if (typed.trim() !== row.title) {
        setError("곡 이름이 일치하지 않아 삭제하지 않았어요.");
        return;
      }
    } else if (
      !window.confirm(`${row.studentName} 님의 「${row.title}」 숙제를 삭제할까요?`)
    ) {
      return;
    }
    setError(null);
    setBusyId(row.id);
    const result = await deleteCard(row.id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  const arrow = (key: SortKey) => (sortKey === key ? (sortDesc ? " ▼" : " ▲") : "");

  const statusOf = (row: HomeworkRow) => {
    if (row.completedAt) return { text: "🏆 완성", className: "bg-violet-100 text-violet-800" };
    if (row.pending > 0) return { text: "👀 대기", className: "bg-lime-100 text-lime-800" };
    if (row.retry > 0) return { text: "↺ 재연습", className: "bg-orange-100 text-orange-700" };
    if (row.done > 0) return { text: "진행 중", className: "bg-gray-100 text-gray-600" };
    return { text: "시작 전", className: "bg-gray-50 text-gray-400" };
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`곡명·${memberLabel} 검색`}
          className="flex-1 min-w-40 h-10 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as StatusFilter)}
          className="h-10 px-3 rounded-xl border border-gray-300 text-sm font-bold text-gray-700"
        >
          <option value="all">전체</option>
          <option value="ongoing">진행 중</option>
          <option value="pending">👀 검토 대기</option>
          <option value="retry">↺ 재연습 중</option>
          <option value="due">📅 마감 임박·지남</option>
          <option value="completed">🏆 완성</option>
        </select>
        <span className="text-xs text-gray-400 font-medium">{filtered.length}개</span>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="rounded-xl bg-white border border-violet-100 overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-violet-50 text-violet-900 select-none">
              <th
                className="px-2.5 py-2 text-left font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("title")}
              >
                곡명{arrow("title")}
              </th>
              <th
                className="px-2.5 py-2 text-left font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("studentName")}
              >
                {memberLabel}{arrow("studentName")}
              </th>
              <th
                className="px-2 py-2 font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("progress")}
              >
                진행{arrow("progress")}
              </th>
              <th className="px-2 py-2 font-extrabold border-b border-r border-violet-100 whitespace-nowrap">
                상태
              </th>
              <th
                className="px-2.5 py-2 font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("dueDate")}
              >
                기한{arrow("dueDate")}
              </th>
              <th
                className="px-2.5 py-2 text-right font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("createdAt")}
              >
                배정일{arrow("createdAt")}
              </th>
              <th className="px-2 py-2 font-extrabold border-b border-violet-100 whitespace-nowrap">
                동작
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => {
              const status = statusOf(row);
              const due = dueBadge(row.dueDate);
              const percent = Math.round((row.done / row.totalGrapes) * 100);
              return (
                <tr key={row.id} className={index % 2 ? "bg-gray-50/60" : ""}>
                  <td className="px-2.5 py-1.5 border-b border-r border-gray-100 whitespace-nowrap">
                    <Link
                      href={`/teacher/cards/${row.id}`}
                      className="font-bold text-gray-800 hover:text-violet-700"
                    >
                      {row.title}
                    </Link>
                    {row.selfAdded && (
                      <span className="ml-1.5 text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-full">
                        🙋 직접 추가
                      </span>
                    )}
                    {row.description && (
                      <span className="ml-1.5 text-[10px] text-gray-400" title={row.description}>
                        🎯
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 border-b border-r border-gray-100 whitespace-nowrap text-gray-700">
                    <Link
                      href={`/teacher/students/${row.studentId}`}
                      className="hover:text-violet-700"
                    >
                      {row.studentName}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 border-b border-r border-gray-100 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 rounded-full bg-violet-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-gray-500 tabular-nums">
                        {row.done}/{row.totalGrapes}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 border-b border-r border-gray-100 text-center whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded-full font-bold ${status.className}`}>
                      {status.text}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5 border-b border-r border-gray-100 text-center whitespace-nowrap">
                    {due ? (
                      <span className={`px-1.5 py-0.5 rounded-full font-bold ${due.className}`}>
                        {due.text}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 border-b border-r border-gray-100 text-right whitespace-nowrap text-gray-400">
                    {row.createdAt.slice(0, 10)}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(row);
                        setError(null);
                      }}
                      className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700 font-bold"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => remove(row)}
                      className="ml-2 px-2 py-1 rounded-lg bg-red-50 text-red-500 font-bold disabled:opacity-50"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  조건에 맞는 숙제가 없어요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  row,
  onClose,
  onSaved,
}: {
  row: HomeworkRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(row.title);
  const [description, setDescription] = useState(row.description ?? "");
  const [totalGrapes, setTotalGrapes] = useState(row.totalGrapes);
  const [dueDate, setDueDate] = useState(row.dueDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setBusy(true);
    const result = await updateCard({
      cardId: row.id,
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
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-extrabold text-violet-900">
          ✏️ 숙제 수정 — {row.studentName}
        </h3>
        <p className="-mt-2 text-xs text-gray-400">이 카드만 바뀌어요 (다른 멤버는 그대로).</p>
        <label className="flex flex-col gap-1 text-sm font-bold text-gray-700">
          곡 이름
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 px-3 rounded-xl border border-gray-300 font-normal focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-gray-700">
          🎯 미션 (지시사항)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="rounded-xl border border-gray-300 p-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm font-bold text-gray-700">
            🍇 포도알
            <input
              type="number"
              min={1}
              max={60}
              value={totalGrapes}
              onChange={(e) => setTotalGrapes(Number(e.target.value))}
              className="h-11 px-3 rounded-xl border border-gray-300 font-normal focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold text-gray-700">
            📅 기한
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-11 px-3 rounded-xl border border-gray-300 font-normal focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-xl bg-gray-100 text-gray-600 font-bold active:bg-gray-200"
          >
            닫기
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="h-12 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
          >
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
