"use client";

import { bunchRows, type GrapeState } from "@/lib/grapes";
import { GrapeBerry } from "./GrapeBerry";

const R = 18; // 포도알 반지름
const DX = R * 2 + 6; // 가로 간격
const DY = R * 2 - 4; // 세로 간격 (살짝 겹쳐 송이 느낌)
const PAD = 8;
const STEM_H = 34;

interface Props {
  grapes: GrapeState[];
  onGrapeClick?: (grape: GrapeState) => void;
  /** 강조할 포도알 index (선택된 알) */
  selectedIndex?: number;
  className?: string;
}

/** 포도송이 SVG — 위가 넓고 아래로 좁아지는 클러스터 + 줄기/잎 */
export function GrapeBunch({ grapes, onGrapeClick, selectedIndex, className }: Props) {
  const rows = bunchRows(grapes.length);
  const maxRow = Math.max(...rows, 1);
  const width = maxRow * DX + PAD * 2;
  const height = rows.length * DY + R + STEM_H + PAD * 2;
  const cxCenter = width / 2;

  // 각 포도알의 (cx, cy) 계산
  const positions: { cx: number; cy: number }[] = [];
  let grapeIdx = 0;
  rows.forEach((count, rowIdx) => {
    const rowWidth = count * DX;
    const startX = cxCenter - rowWidth / 2 + DX / 2;
    for (let i = 0; i < count && grapeIdx < grapes.length; i++, grapeIdx++) {
      positions.push({
        cx: startX + i * DX,
        cy: PAD + STEM_H + R + rowIdx * DY,
      });
    }
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`포도송이: ${grapes.filter((g) => g.status === "approved").length}/${grapes.length}알 완성`}
    >
      <defs>
        <radialGradient id="grape-fill" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6b21a8" />
        </radialGradient>
      </defs>

      {/* 줄기 */}
      <path
        d={`M ${cxCenter} ${PAD} q 4 ${STEM_H / 2} 0 ${STEM_H}`}
        stroke="#854d0e"
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
      {/* 잎 */}
      <path
        d={`M ${cxCenter} ${PAD + 10} q 26 -16 40 2 q -20 16 -40 -2 z`}
        fill="#4ade80"
        stroke="#16a34a"
        strokeWidth={1.5}
      />

      {grapes.map((grape, i) => (
        <GrapeBerry
          key={grape.index}
          grape={grape}
          cx={positions[i].cx}
          cy={positions[i].cy}
          r={R}
          selected={selectedIndex === grape.index}
          onClick={onGrapeClick ? () => onGrapeClick(grape) : undefined}
        />
      ))}
    </svg>
  );
}
