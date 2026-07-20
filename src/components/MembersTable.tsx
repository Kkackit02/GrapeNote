"use client";

import { useState } from "react";
import Link from "next/link";
import { instrumentBadge, parseInstruments } from "@/lib/instruments";
import { formatAgo } from "@/lib/time";

export interface MemberRow {
  id: string;
  name: string;
  username: string | null;
  instrument: string | null;
  teams: string[];
  /** 진행 중인 곡 수 */
  ongoing: number;
  /** 완성한 포도송이 수 */
  completed: number;
  /** 이번 주 제출 영상 수 */
  weekSubmitted: number;
  /** 검토 대기 중인 내 영상 수 */
  pending: number;
  lastSubmittedAt: string | null;
}

type SortKey = "name" | "ongoing" | "weekSubmitted" | "lastSubmittedAt";

const QUIET_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  rows: MemberRow[];
  /** 멤버 호칭 (학생/멤버) */
  memberLabel: string;
}

/** 멤버 목록 표: 악기·팀·진행·이번 주 활동을 한눈에 보고 정렬한다 */
export function MembersTable({ rows, memberLabel }: Props) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(key !== "name");
    }
  };

  const now = new Date();
  const filtered = rows
    .filter((row) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        (row.instrument ?? "").toLowerCase().includes(needle) ||
        row.teams.some((team) => team.toLowerCase().includes(needle))
      );
    })
    .sort((a, b) => {
      let cmp: number;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, "ko");
      else if (sortKey === "lastSubmittedAt") {
        cmp = (a.lastSubmittedAt ?? "").localeCompare(b.lastSubmittedAt ?? "");
      } else cmp = a[sortKey] - b[sortKey];
      return sortDesc ? -cmp : cmp;
    });

  const arrow = (key: SortKey) => (sortKey === key ? (sortDesc ? " ▼" : " ▲") : "");
  const isQuiet = (last: string | null) =>
    !last || now.getTime() - new Date(last).getTime() > QUIET_MS;

  return (
    <div className="flex flex-col gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="이름·악기·팀 검색"
        className="h-10 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
      />

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
              <th className="px-2.5 py-2 text-left font-extrabold border-b border-r border-violet-100 whitespace-nowrap">
                악기
              </th>
              <th className="px-2.5 py-2 text-left font-extrabold border-b border-r border-violet-100 whitespace-nowrap">
                팀
              </th>
              <th
                className="px-2 py-2 font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("ongoing")}
              >
                곡{arrow("ongoing")}
              </th>
              <th className="px-2 py-2 font-extrabold border-b border-r border-violet-100 whitespace-nowrap">
                완성
              </th>
              <th
                className="px-2 py-2 font-extrabold border-b border-r border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("weekSubmitted")}
              >
                이번 주{arrow("weekSubmitted")}
              </th>
              <th
                className="px-2.5 py-2 text-right font-extrabold border-b border-violet-100 whitespace-nowrap cursor-pointer"
                onClick={() => toggleSort("lastSubmittedAt")}
              >
                마지막 활동{arrow("lastSubmittedAt")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => {
              const quiet = isQuiet(row.lastSubmittedAt);
              return (
                <tr
                  key={row.id}
                  className={quiet ? "bg-orange-50/50" : index % 2 ? "bg-gray-50/60" : ""}
                >
                  <td className="px-2.5 py-1.5 border-b border-r border-gray-100 whitespace-nowrap">
                    <Link
                      href={`/teacher/students/${row.id}`}
                      className="font-bold text-gray-800 hover:text-violet-700"
                    >
                      {row.name}
                    </Link>
                    {row.pending > 0 && (
                      <span className="ml-1.5 text-[10px] font-bold text-lime-700 bg-lime-100 px-1.5 py-0.5 rounded-full">
                        👀{row.pending}
                      </span>
                    )}
                    {row.username && (
                      <span className="ml-1 text-[10px] text-gray-300">@{row.username}</span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 border-b border-r border-gray-100 whitespace-nowrap text-gray-600">
                    {row.instrument ? (
                      <>
                        {instrumentBadge(row.instrument)}{" "}
                        {parseInstruments(row.instrument).join("·")}
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 border-b border-r border-gray-100 text-gray-500 max-w-56 truncate">
                    {row.teams.length > 0 ? row.teams.join(", ") : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-2 py-1.5 border-b border-r border-gray-100 text-center font-bold text-gray-700">
                    {row.ongoing}
                  </td>
                  <td className="px-2 py-1.5 border-b border-r border-gray-100 text-center text-violet-700 font-bold">
                    {row.completed > 0 ? `🏆 ${row.completed}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td
                    className={`px-2 py-1.5 border-b border-r border-gray-100 text-center font-bold ${
                      row.weekSubmitted > 0 ? "text-violet-700" : "text-gray-300"
                    }`}
                  >
                    {row.weekSubmitted}
                  </td>
                  <td
                    className={`px-2.5 py-1.5 border-b border-gray-100 text-right whitespace-nowrap ${
                      quiet ? "font-bold text-orange-600" : "text-gray-400"
                    }`}
                  >
                    {row.lastSubmittedAt ? formatAgo(row.lastSubmittedAt, now) : "기록 없음"}
                    {quiet && " 💤"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
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
