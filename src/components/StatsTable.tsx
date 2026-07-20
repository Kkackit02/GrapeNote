"use client";

import { useState } from "react";
import Link from "next/link";
import { formatAgo } from "@/lib/time";

export interface StatsRow {
  studentId: string;
  name: string;
  submitted: number;
  approved: number;
  lastSubmittedAt: string | null;
  /** 이번 주 제출 1위 */
  champion: boolean;
}

type SortKey = "name" | "submitted" | "approved" | "lastSubmittedAt";

interface Props {
  rows: StatsRow[];
  memberLabel: string;
  quietDays: number;
}

/** 주간 통계 표 — 멤버/숙제/영상 표와 같은 스타일(검색·정렬) */
export function StatsTable({ rows, memberLabel, quietDays }: Props) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("submitted");
  const [sortDesc, setSortDesc] = useState(true);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(key !== "name");
    }
  };

  const now = new Date();
  const isQuiet = (last: string | null) =>
    !last || now.getTime() - new Date(last).getTime() > quietDays * 24 * 60 * 60 * 1000;

  const filtered = rows
    .filter((row) => row.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => {
      let cmp: number;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, "ko");
      else if (sortKey === "lastSubmittedAt") {
        cmp = (a.lastSubmittedAt ?? "").localeCompare(b.lastSubmittedAt ?? "");
      } else cmp = a[sortKey] - b[sortKey];
      return sortDesc ? -cmp : cmp;
    });

  const arrow = (key: SortKey) => (sortKey === key ? (sortDesc ? " ▼" : " ▲") : "");
  const quietCount = filtered.filter((row) => isQuiet(row.lastSubmittedAt)).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`${memberLabel} 검색`}
          className="flex-1 min-w-40 h-10 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <span className="text-xs text-gray-400 font-medium">
          {filtered.length}명
          {quietCount > 0 && <span className="ml-1 text-orange-500">· 💤 {quietCount}명</span>}
        </span>
      </div>

      <div className="rounded-xl bg-white border border-violet-100 overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-violet-50 text-violet-900 select-none">
              <th
                className="px-2.5 py-2 text-left font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("name")}
              >
                {memberLabel}{arrow("name")}
              </th>
              <th
                className="px-2 py-2 font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("submitted")}
              >
                이번 주 영상{arrow("submitted")}
              </th>
              <th
                className="px-2 py-2 font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("approved")}
              >
                이번 주 합격{arrow("approved")}
              </th>
              <th
                className="px-2.5 py-2 text-right font-extrabold border-b border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("lastSubmittedAt")}
              >
                마지막 제출{arrow("lastSubmittedAt")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => {
              const quiet = isQuiet(row.lastSubmittedAt);
              return (
                <tr
                  key={row.studentId}
                  className={quiet ? "bg-orange-50/50" : index % 2 ? "bg-gray-50/60" : ""}
                >
                  <td className="px-2.5 py-1.5 border-b border-r border-gray-100 whitespace-nowrap">
                    <Link
                      href={`/teacher/students/${row.studentId}`}
                      className="font-bold text-gray-800 hover:text-violet-700"
                    >
                      {row.champion && "👑 "}
                      {row.name}
                    </Link>
                  </td>
                  <td
                    className={`px-2 py-1.5 border-b border-r border-gray-100 text-center font-bold ${
                      row.submitted > 0 ? "text-violet-700" : "text-gray-300"
                    }`}
                  >
                    {row.submitted}
                  </td>
                  <td className="px-2 py-1.5 border-b border-r border-gray-100 text-center text-gray-600">
                    {row.approved || <span className="text-gray-300">—</span>}
                  </td>
                  <td
                    className={`px-2.5 py-1.5 border-b border-gray-100 text-right whitespace-nowrap ${
                      quiet ? "font-bold text-orange-600" : "text-gray-400"
                    }`}
                  >
                    {row.lastSubmittedAt ? formatAgo(row.lastSubmittedAt, now) : "제출 없음"}
                    {quiet && " 💤"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                  조건에 맞는 {memberLabel}이 없어요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
