"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  updateCard,
  deleteCard,
  bulkUpdateCards,
  bulkDeleteCards,
  closeCards,
  reopenCards,
} from "@/lib/actions/cards";
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
  /** 리더가 마감한 시각 — 멤버 화면에서 숨겨진다 */
  closedAt: string | null;
  createdAt: string;
  /** 멤버가 스스로 추가한 숙제인지 */
  selfAdded: boolean;
}

type SortKey = "title" | "studentName" | "progress" | "dueDate" | "createdAt";
type StatusFilter = "all" | "ongoing" | "pending" | "retry" | "completed" | "due" | "closed";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(key === "createdAt" || key === "progress");
    }
  };

  const matchesFilter = (row: HomeworkRow) => {
    // 마감된 숙제는 "마감" 필터에서만 보인다 (평소엔 시야에서 빠지게)
    if (filter !== "closed" && filter !== "all" && row.closedAt) return false;
    switch (filter) {
      case "closed":
        return !!row.closedAt;
      case "ongoing":
        return !row.completedAt && !row.closedAt;
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

  const selectedRows = filtered.filter((row) => selected.has(row.id));
  const allChecked = filtered.length > 0 && filtered.every((row) => selected.has(row.id));
  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(filtered.map((row) => row.id)));

  const bulkRemove = async () => {
    const videos = selectedRows.reduce(
      (sum, row) => sum + row.done + row.pending + row.retry,
      0
    );
    const typed = window.prompt(
      `숙제 ${selectedRows.length}개를 삭제해요.\n제출된 영상 ${videos}개와 판정 기록이 전부 사라지고 되돌릴 수 없어요!\n\n계속하려면 삭제 를 입력해 주세요:`
    );
    if (typed === null) return;
    if (typed.trim() !== "삭제") {
      setError("입력이 일치하지 않아 삭제하지 않았어요.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusyId("bulk");
    const result = await bulkDeleteCards(selectedRows.map((row) => row.id));
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`🗑 숙제 ${result.data.deleted}개를 삭제했어요.`);
    setSelected(new Set());
    router.refresh();
  };

  const bulkClose = async () => {
    const open = selectedRows.filter((row) => !row.closedAt);
    if (open.length === 0) {
      setError("마감할 숙제가 없어요 (이미 마감됐어요).");
      return;
    }
    if (
      !window.confirm(
        `숙제 ${open.length}개를 마감할까요?\n· 멤버 화면에서 사라지고 더 이상 제출할 수 없어요\n· 지난 제출 영상은 드라이브로 자동 백업돼요\n· 기록은 남고, 언제든 마감을 해제할 수 있어요`
      )
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    setBusyId("bulk");
    const result = await closeCards(open.map((row) => row.id));
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(
      `🔒 숙제 ${result.data.closed}개를 마감했어요.` +
        (result.data.archiveSkipped
          ? " (드라이브 미연결이라 백업은 건너뛰었어요)"
          : ` 영상 ${result.data.archived}개를 드라이브에 백업했어요.`)
    );
    setSelected(new Set());
    router.refresh();
  };

  const bulkReopen = async () => {
    const closed = selectedRows.filter((row) => row.closedAt);
    if (closed.length === 0) {
      setError("마감 해제할 숙제가 없어요.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusyId("bulk");
    const result = await reopenCards(closed.map((row) => row.id));
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`🔓 숙제 ${result.data.reopened}개의 마감을 해제했어요.`);
    setSelected(new Set());
    router.refresh();
  };

  const arrow = (key: SortKey) => (sortKey === key ? (sortDesc ? " ▼" : " ▲") : "");

  const statusOf = (row: HomeworkRow) => {
    if (row.closedAt) return { text: "🔒 마감", className: "bg-gray-200 text-gray-600" };
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
          <option value="closed">🔒 마감된 숙제</option>
        </select>
        <span className="text-xs text-gray-400 font-medium">{filtered.length}개</span>
      </div>

      {selectedRows.length > 0 && (
        <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-violet-800">✓ {selectedRows.length}개 선택</span>
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() => setBulkOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold disabled:opacity-50"
          >
            ✏️ 일괄 수정
          </button>
          <button
            type="button"
            disabled={busyId !== null}
            onClick={bulkClose}
            className="px-3 py-1.5 rounded-lg bg-gray-700 text-white text-xs font-bold disabled:opacity-50"
          >
            🔒 마감
          </button>
          {selectedRows.some((row) => row.closedAt) && (
            <button
              type="button"
              disabled={busyId !== null}
              onClick={bulkReopen}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-600 text-xs font-bold disabled:opacity-50"
            >
              🔓 마감 해제
            </button>
          )}
          <button
            type="button"
            disabled={busyId !== null}
            onClick={bulkRemove}
            className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-600 text-xs font-bold disabled:opacity-50"
          >
            🗑 삭제
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-gray-400 underline underline-offset-2"
          >
            선택 해제
          </button>
        </div>
      )}

      {notice && <p className="text-sm font-bold text-violet-700">{notice}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="rounded-xl bg-white border border-violet-100 overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-violet-50 text-violet-900 select-none">
              <th className="px-2 py-2 border-b border-r border-violet-100">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="w-4 h-4 accent-violet-600"
                  aria-label="전체 선택"
                />
              </th>
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
                <tr
                  key={row.id}
                  className={
                    selected.has(row.id)
                      ? "bg-violet-50/70"
                      : row.closedAt
                        ? "bg-gray-100/70 text-gray-400"
                        : index % 2
                          ? "bg-gray-50/60"
                          : ""
                  }
                >
                  <td className="px-2 py-1.5 border-b border-r border-gray-100 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      className="w-4 h-4 accent-violet-600"
                      aria-label={`${row.title} ${row.studentName} 선택`}
                    />
                  </td>
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
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
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

      {bulkOpen && (
        <BulkEditModal
          count={selectedRows.length}
          onClose={() => setBulkOpen(false)}
          onSaved={(message) => {
            setBulkOpen(false);
            setNotice(message);
            setSelected(new Set());
            router.refresh();
          }}
          cardIds={selectedRows.map((row) => row.id)}
        />
      )}
    </div>
  );
}

/** 선택한 숙제들의 미션·기한·포도알을 한꺼번에 바꾼다 (비운 항목은 그대로) */
function BulkEditModal({
  count,
  cardIds,
  onClose,
  onSaved,
}: {
  count: number;
  cardIds: string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [mission, setMission] = useState("");
  const [changeMission, setChangeMission] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [changeDue, setChangeDue] = useState(false);
  const [clearDue, setClearDue] = useState(false);
  const [totalGrapes, setTotalGrapes] = useState(5);
  const [changeGrapes, setChangeGrapes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setBusy(true);
    const result = await bulkUpdateCards({
      cardIds,
      mission: changeMission ? mission : null,
      dueDate: changeDue ? (clearDue ? "clear" : dueDate) : null,
      totalGrapes: changeGrapes ? totalGrapes : null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(
      `✏️ 숙제 ${result.data.updated}개를 수정했어요.` +
        (result.data.grapesSkipped
          ? ` (제출 기록 때문에 ${result.data.grapesSkipped}개는 포도알 수를 줄이지 못했어요)`
          : "")
    );
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
        <h3 className="text-lg font-extrabold text-violet-900">✏️ 숙제 {count}개 일괄 수정</h3>
        <p className="-mt-2 text-xs text-gray-400">체크한 항목만 바뀌어요.</p>

        <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <input
            type="checkbox"
            checked={changeMission}
            onChange={(e) => setChangeMission(e.target.checked)}
            className="w-4 h-4 accent-violet-600"
          />
          🎯 미션 바꾸기
        </label>
        {changeMission && (
          <textarea
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            rows={3}
            placeholder="비워 두면 미션이 지워져요"
            className="rounded-xl border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        )}

        <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <input
            type="checkbox"
            checked={changeDue}
            onChange={(e) => setChangeDue(e.target.checked)}
            className="w-4 h-4 accent-violet-600"
          />
          📅 기한 바꾸기
        </label>
        {changeDue && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dueDate}
              disabled={clearDue}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 h-11 px-3 rounded-xl border border-gray-300 text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
              <input
                type="checkbox"
                checked={clearDue}
                onChange={(e) => setClearDue(e.target.checked)}
                className="w-4 h-4 accent-violet-600"
              />
              기한 없애기
            </label>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <input
            type="checkbox"
            checked={changeGrapes}
            onChange={(e) => setChangeGrapes(e.target.checked)}
            className="w-4 h-4 accent-violet-600"
          />
          🍇 포도알 수 바꾸기
        </label>
        {changeGrapes && (
          <input
            type="number"
            min={1}
            max={60}
            value={totalGrapes}
            onChange={(e) => setTotalGrapes(Number(e.target.value))}
            className="h-11 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        )}

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
            disabled={busy || (!changeMission && !changeDue && !changeGrapes)}
            onClick={save}
            className="h-12 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
          >
            {busy ? "저장 중..." : `${count}개 저장`}
          </button>
        </div>
      </div>
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
