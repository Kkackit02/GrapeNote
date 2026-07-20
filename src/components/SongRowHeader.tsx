"use client";

import { useState } from "react";
import { LineupModal, type LineupStudent } from "@/components/LineupModal";

export type { LineupStudent };

interface Props {
  title: string;
  teamLabel: string | null;
  students: LineupStudent[];
  assignedIds: string[];
}

/** 현황판 곡명 — 누르면 그 곡의 편성을 체크박스로 바로 수정 */
export function SongRowHeader({ title, teamLabel, students, assignedIds }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left font-bold text-gray-800 hover:text-violet-700"
        title="편성 수정"
      >
        🎵 {title}
        {teamLabel && teamLabel !== title && (
          <span className="ml-1.5 text-[10px] font-bold text-violet-400">{teamLabel}</span>
        )}
        <span className="ml-1 text-[10px] text-gray-300">✎</span>
      </button>

      {open && (
        <LineupModal
          title={title}
          students={students}
          assignedIds={assignedIds}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
