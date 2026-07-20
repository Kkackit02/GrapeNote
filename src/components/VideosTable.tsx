"use client";

import { useState } from "react";
import Link from "next/link";
import { getPlaybackUrl } from "@/lib/actions/uploads";
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
}

const STATUS_LABEL = {
  pending: { text: "👀 대기", className: "bg-lime-100 text-lime-800" },
  approved: { text: "🍇 합격", className: "bg-violet-100 text-violet-800" },
  needs_retry: { text: "↺ 재연습", className: "bg-orange-100 text-orange-700" },
} as const;

const FILE_LABEL = {
  live: { text: "보관 중", className: "text-gray-600" },
  drive: { text: "🗂 드라이브", className: "text-sky-600" },
  gone: { text: "정리됨", className: "text-gray-300" },
} as const;

type SortKey = "createdAt" | "songTitle" | "studentName" | "sizeBytes";

interface Props {
  rows: VideoRow[];
}

/** 영상 관리 표 (엑셀 스타일): 검색·필터·정렬 + 행에서 바로 재생/다운로드 */
export function VideosTable({ rows }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | VideoRow["status"]>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDesc, setSortDesc] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  const download = async (row: VideoRow) => {
    setError(null);
    setBusyId(row.id);
    const name = `${row.createdAt.slice(0, 10)}_${row.songTitle}_${row.studentName}_포도알${row.grapeIndex}.mp4`;
    const result = await getPlaybackUrl(row.id, name);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.location.assign(result.data.url); // Content-Disposition: attachment → 바로 저장
  };

  const arrow = (key: SortKey) => (sortKey === key ? (sortDesc ? " ▼" : " ▲") : "");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="곡명·멤버 검색"
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

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="rounded-xl bg-white border border-violet-100 overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-violet-50 text-violet-900 select-none">
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
                멤버{arrow("studentName")}
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
              const fileLabel = FILE_LABEL[row.fileState];
              return (
                <tr key={row.id} className={index % 2 ? "bg-gray-50/60" : ""}>
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
                  <td className={`px-2 py-1.5 border-b border-r border-gray-100 text-center whitespace-nowrap font-bold ${fileLabel.className}`}>
                    {fileLabel.text}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-center whitespace-nowrap">
                    <Link
                      href={`/teacher/review/${row.id}`}
                      className="inline-block px-2 py-1 rounded-lg bg-violet-50 text-violet-700 font-bold"
                    >
                      ▶ 보기
                    </Link>
                    {row.fileState === "live" && (
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => download(row)}
                        className="ml-1 px-2 py-1 rounded-lg bg-sky-50 text-sky-700 font-bold disabled:opacity-50"
                      >
                        {busyId === row.id ? "..." : "⬇ 저장"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
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
