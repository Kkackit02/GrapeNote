"use client";

import type { GrapeState } from "@/lib/grapes";

interface Props {
  grape: GrapeState;
  cx: number;
  cy: number;
  r: number;
  selected?: boolean;
  onClick?: () => void;
}

/** 포도알 1개. 상태: 빈 알(점선) / 검토 대기(연두) / 합격(보라) / 재연습(주황 점선 + ↺) */
export function GrapeBerry({ grape, cx, cy, r, selected, onClick }: Props) {
  const { status } = grape;

  const circle =
    status === "approved" ? (
      <circle cx={cx} cy={cy} r={r} fill="url(#grape-fill)" stroke="#581c87" strokeWidth={1.5} />
    ) : status === "pending" ? (
      <circle cx={cx} cy={cy} r={r} fill="#bef264" fillOpacity={0.75} stroke="#65a30d" strokeWidth={2} />
    ) : status === "retry" ? (
      <circle cx={cx} cy={cy} r={r} fill="#fff7ed" stroke="#f97316" strokeWidth={2} strokeDasharray="4 3" />
    ) : (
      <circle cx={cx} cy={cy} r={r} fill="#faf5ff" stroke="#c4b5fd" strokeWidth={2} strokeDasharray="4 3" />
    );

  return (
    <g
      onClick={onClick}
      className={onClick ? "cursor-pointer transition-transform origin-center hover:scale-110 active:scale-95" : undefined}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    >
      {selected && (
        <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#a855f7" strokeWidth={3} />
      )}
      {circle}
      {status === "approved" && (
        // 광택
        <ellipse cx={cx - r * 0.35} cy={cy - r * 0.4} rx={r * 0.28} ry={r * 0.18} fill="#e9d5ff" opacity={0.8} />
      )}
      {status === "pending" && (
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={r * 0.8}>
          👀
        </text>
      )}
      {status === "retry" && (
        <text x={cx} y={cy + 5.5} textAnchor="middle" fontSize={r} fill="#ea580c" fontWeight="bold">
          ↺
        </text>
      )}
      {status === "empty" && (
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={r * 0.6} fill="#a78bfa">
          {grape.index}
        </text>
      )}
    </g>
  );
}
