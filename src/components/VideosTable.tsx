"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPlaybackUrl } from "@/lib/actions/uploads";
import { archiveSubmissions, purgeSubmissions } from "@/lib/actions/videos";
import { formatBytes } from "@/lib/limits";

export interface VideoRow {
  id: string;
  createdAt: string;
  reviewedAt: string | null;
  songTitle: string;
  studentName: string;
  grapeIndex: number;
  status: "pending" | "approved" | "needs_retry";
  sizeBytes: number;
  /** 파일 상태: live(보관 중) / drive(정리됨+드라이브 백업) / gone(정리됨) */
  fileState: "live" | "drive" | "gone";
  /** 보관 중이면서 드라이브 백업도 이미 된 영상 */
  driveBacked: boolean;
}

const STATUS_LABEL = {
  pending: { text: "👀 대기", className: "bg-lime-100 text-lime-800" },
  approved: { text: "🍇 합격", className: "bg-violet-100 text-violet-800" },
  needs_retry: { text: "↺ 재연습", className: "bg-orange-100 text-orange-700" },
} as const;

type SortKey = "createdAt" | "songTitle" | "studentName" | "sizeBytes";

interface Props {
  rows: VideoRow[];
  driveConnected: boolean;
  /** 멤버 호칭 (학생/멤버) */
  memberLabel?: string;
}

/** 영상 관리 표 (엑셀 스타일): 검색·필터·정렬 + 체크 선택 일괄 다운로드/백업/정리 */
export function VideosTable({ rows, driveConnected, memberLabel = "멤버" }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | VideoRow["status"]>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDesc, setSortDesc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(key === "createdAt" || key === "sizeBytes");
    }
  };

  const filtered = rows
    .filter((row) => status === "all" || row.status === status)
    .filter((row) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return (
        row.songTitle.toLowerCase().includes(needle) ||
        row.studentName.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "ko");
      return sortDesc ? -cmp : cmp;
    });

  const totalBytes = filtered.reduce((sum, row) => sum + row.sizeBytes, 0);
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
  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(filtered.map((row) => row.id)));
  };

  const fileNameOf = (row: VideoRow) =>
    `${row.createdAt.slice(0, 10)}_${row.songTitle}_${row.studentName}_포도알${row.grapeIndex}.mp4`;

  const downloadOne = async (row: VideoRow) => {
    const result = await getPlaybackUrl(row.id, fileNameOf(row));
    if (!result.ok) return false;
    const anchor = document.createElement("a");
    anchor.href = result.data.url;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  };

  const bulkDownload = async () => {
    const targets = selectedRows.filter((row) => row.fileState === "live");
    if (targets.length === 0) {
      setError("다운로드할 수 있는(보관 중) 영상이 없어요.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy("down");
    let done = 0;
    for (const row of targets) {
      if (await downloadOne(row)) done++;
      // 브라우저의 연속 다운로드 차단을 피하기 위한 간격
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    setBusy(null);
    setNotice(`⬇ ${done}개 다운로드를 시작했어요. (브라우저가 여러 파일 허용을 물으면 허용해 주세요)`);
  };

  const bulkArchive = async () => {
    const targets = selectedRows.filter((row) => row.fileState === "live" && !row.driveBacked);
    if (targets.length === 0) {
      setError("백업할 대상이 없어요 (이미 백업됐거나 정리된 영상이에요).");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy("backup");
    const result = await archiveSubmissions(targets.map((row) => row.id));
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const { archived, failed, deferred } = result.data;
    setNotice(
      `🗂 ${archived}개를 드라이브로 백업했어요.` +
        (failed ? ` 실패 ${failed}개.` : "") +
        (deferred ? ` 시간이 부족해 ${deferred}개는 남았어요 — 한 번 더 눌러 주세요.` : "")
    );
    router.refresh();
  };

  const bulkPurge = async () => {
    const targets = selectedRows.filter((row) => row.fileState === "live");
    if (targets.length === 0) {
      setError("정리할 수 있는(보관 중) 영상이 없어요.");
      return;
    }
    const unbacked = targets.filter((row) => !row.driveBacked && row.status !== "pending").length;
    const message =
      `${targets.length}개 영상 파일을 정리할까요?\n판정 기록·코멘트는 남고, 검토 대기 영상은 자동으로 건너뛰어요.` +
      (unbacked > 0 ? `\n⚠️ 드라이브 백업이 없는 ${unbacked}개는 복구할 수 없어요!` : "");
    if (!window.confirm(message)) return;
    setError(null);
    setNotice(null);
    setBusy("purge");
    const result = await purgeSubmissions(targets.map((row) => row.id));
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(
      `🗑 ${result.data.purged}개 파일을 정리했어요.` +
        (result.data.skippedPending ? ` (검토 대기 ${result.data.skippedPending}개 제외)` : "")
    );
    setSelected(new Set());
    router.refresh();
  };

  const arrow = (key: SortKey) => (sortKey === key ? (sortDesc ? " ▼" : " ▲") : "");

  const fileLabel = (row: VideoRow) => {
    if (row.fileState === "live") {
      return row.driveBacked
        ? { text: "보관 🗂", className: "text-sky-600" }
        : { text: "보관 중", className: "text-gray-600" };
    }
    if (row.fileState === "drive") return { text: "🗂 드라이브", className: "text-sky-600" };
    return { text: "정리됨", className: "text-gray-300" };
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`곡명·${memberLabel} 검색`}
          className="flex-1 min-w-40 h-10 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-10 px-3 rounded-xl border border-gray-300 text-sm font-bold text-gray-700"
        >
          <option value="all">전체 상태</option>
          <option value="pending">👀 검토 대기</option>
          <option value="approved">🍇 합격</option>
          <option value="needs_retry">↺ 재연습</option>
        </select>
        <span className="text-xs text-gray-400 font-medium">
          {filtered.length}개 · {formatBytes(totalBytes)}
        </span>
      </div>

      {selectedRows.length > 0 && (
        <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-violet-800">✓ {selectedRows.length}개 선택</span>
          <button
            type="button"
            disabled={busy !== null}
            onClick={bulkDownload}
            className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold disabled:opacity-50"
          >
            {busy === "down" ? "받는 중..." : "⬇ 다운로드"}
          </button>
          <button
            type="button"
            disabled={busy !== null || !driveConnected}
            onClick={bulkArchive}
            title={driveConnected ? undefined : "대시보드에서 드라이브를 먼저 연결해 주세요"}
            className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold disabled:opacity-50"
          >
            {busy === "backup" ? "백업 중..." : "🗂 드라이브 백업"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={bulkPurge}
            className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-600 text-xs font-bold disabled:opacity-50"
          >
            {busy === "purge" ? "정리 중..." : "🗑 파일 정리"}
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
                onClick={() => toggleSort("createdAt")}
              >
                제출일{arrow("createdAt")}
              </th>
              <th
                className="px-2.5 py-2 text-left font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("songTitle")}
              >
                곡명{arrow("songTitle")}
              </th>
              <th
                className="px-2.5 py-2 text-left font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("studentName")}
              >
                {memberLabel}{arrow("studentName")}
              </th>
              <th className="px-2 py-2 font-extrabold border-b border-r border-violet-100">알</th>
              <th className="px-2 py-2 font-extrabold border-b border-r border-violet-100">상태</th>
              <th
                className="px-2.5 py-2 text-right font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("sizeBytes")}
              >
                용량{arrow("sizeBytes")}
              </th>
              <th className="px-2 py-2 font-extrabold border-b border-r border-violet-100 whitespace-nowrap">파일</th>
              <th className="px-2 py-2 font-extrabold border-b border-violet-100 whitespace-nowrap">동작</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => {
              const statusLabel = STATUS_LABEL[row.status];
              const file = fileLabel(row);
              return (
                <tr
                  key={row.id}
                  className={
                    selected.has(row.id) ? "bg-violet-50/70" : index % 2 ? "bg-gray-50/60" : ""
                  }
                >
                  <td className="px-2 py-1.5 border-b border-r border-gray-100 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      className="w-4 h-4 accent-violet-600"
                      aria-label={`${row.songTitle} ${row.studentName} 선택`}
                    />
                  </td>
                  <td className="px-2.5 py-1.5 border-b border-r border-gray-100 whitespace-nowrap text-gray-500">
                    {row.createdAt.slice(0, 10)}
                  </td>
                  <td className="px-2.5 py-1.5 border-b border-r border-gray-100 whitespace-nowrap font-bold text-gray-800">
                    {row.songTitle}
                  </td>
                  <td className="px-2.5 py-1.5 border-b border-r border-gray-100 whitespace-nowrap text-gray-700">
                    {row.studentName}
                  </td>
                  <td className="px-2 py-1.5 border-b border-r border-gray-100 text-center text-gray-500">
                    {row.grapeIndex}
                  </td>
                  <td className="px-2 py-1.5 border-b border-r border-gray-100 text-center whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded-full font-bold ${statusLabel.className}`}>
                      {statusLabel.text}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5 border-b border-r border-gray-100 text-right whitespace-nowrap text-gray-500">
                    {row.sizeBytes > 0 ? formatBytes(row.sizeBytes) : "—"}
                  </td>
                  <td className={`px-2 py-1.5 border-b border-r border-gray-100 text-center whitespace-nowrap font-bold ${file.className}`}>
                    {file.text}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-center whitespace-nowrap">
                    <Link
                      href={`/teacher/review/${row.id}`}
                      className="inline-block px-2 py-1 rounded-lg bg-violet-50 text-violet-700 font-bold"
                    >
                      ▶
                    </Link>
                    {row.fileState === "live" && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => downloadOne(row)}
                        className="ml-1 px-2 py-1 rounded-lg bg-sky-50 text-sky-700 font-bold disabled:opacity-50"
                        aria-label="다운로드"
                      >
                        ⬇
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  조건에 맞는 영상이 없어요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
