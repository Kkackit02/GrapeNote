"use client";

import { bunchRows, type GrapeState } from "@/lib/grapes";
import { getSkin, skinForIndex, RANDOM_SKIN_ID, type GrapeSkin } from "@/lib/skins";
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
  /** 합격 포도알에 입힐 스킨 id (기본 머루). 멤버가 고른 값. "random"이면 랜덤 포도 */
  skinId?: string;
  /** 랜덤 포도용 — 이 멤버가 가진 스킨 id 목록 */
  randomPool?: string[];
  /** 주어지면 송이 끝에 점선 "+" 알을 띄운다 — 누르면 포도알을 하나 더 단다 */
  onAddGrape?: () => void;
  /** "+" 알 처리 중 (연타 방지 표시) */
  addBusy?: boolean;
}

/** 포도송이 SVG — 위가 넓고 아래로 좁아지는 클러스터 + 줄기/잎 */
export function GrapeBunch({
  grapes,
  onGrapeClick,
  selectedIndex,
  className,
  skinId,
  randomPool,
  onAddGrape,
  addBusy,
}: Props) {
  // 랜덤 포도: 가진 스킨이 2개 이상일 때만 의미가 있다
  const pool = skinId === RANDOM_SKIN_ID ? (randomPool ?? []) : [];
  const isRandom = pool.length > 1;
  const skin = getSkin(isRandom ? undefined : skinId);
  /** 이 포도알에 박힐 스킨 (랜덤이면 인덱스로 고정 선택) */
  const skinOf = (grapeIndex: number): GrapeSkin =>
    isRandom ? skinForIndex(pool, grapeIndex) : skin;
  // defs에 필요한 그라데이션 (랜덤이면 가진 스킨 전부)
  const skinsUsed: GrapeSkin[] = isRandom ? pool.map((id) => getSkin(id)) : [skin];
  // "+" 알이 있으면 그 자리까지 포함해 송이 모양을 잡는다
  const slotCount = grapes.length + (onAddGrape ? 1 : 0);
  const rows = bunchRows(slotCount);
  const maxRow = Math.max(...rows, 1);
  const width = maxRow * DX + PAD * 2;
  const height = rows.length * DY + R + STEM_H + PAD * 2;
  const cxCenter = width / 2;

  // 각 슬롯의 (cx, cy) 계산 (실제 알 + "+" 알)
  const positions: { cx: number; cy: number }[] = [];
  let grapeIdx = 0;
  rows.forEach((count, rowIdx) => {
    const rowWidth = count * DX;
    const startX = cxCenter - rowWidth / 2 + DX / 2;
    for (let i = 0; i < count && grapeIdx < slotCount; i++, grapeIdx++) {
      positions.push({
        cx: startX + i * DX,
        cy: PAD + STEM_H + R + rowIdx * DY,
      });
    }
  });
  const addPos = onAddGrape ? positions[grapes.length] : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`포도송이: ${grapes.filter((g) => g.status === "approved").length}/${grapes.length}알 완성`}
    >
      <defs>
        {skinsUsed.map((s) => (
          <radialGradient key={s.id} id={`skin-${s.id}`} cx="0.35" cy="0.3" r="0.9">
            {s.colors.map((color, i) => (
              <stop key={i} offset={`${(i / (s.colors.length - 1)) * 100}%`} stopColor={color} />
            ))}
          </radialGradient>
        ))}
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
          skin={skinOf(grape.index)}
        />
      ))}

      {/* 포도알 더 달기 — 송이 끝의 점선 "+" 알 */}
      {addPos && (
        <g
          onClick={addBusy ? undefined : onAddGrape}
          className={addBusy ? "opacity-50" : "cursor-pointer"}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          role="button"
          aria-label="포도알 더 달기"
        >
          <circle
            cx={addPos.cx}
            cy={addPos.cy}
            r={R}
            fill="#f0fdf4"
            stroke="#4ade80"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <text
            x={addPos.cx}
            y={addPos.cy + R * 0.35}
            textAnchor="middle"
            fontSize={R * 1.1}
            fill="#16a34a"
            fontWeight="bold"
          >
            +
          </text>
        </g>
      )}
    </svg>
  );
}
