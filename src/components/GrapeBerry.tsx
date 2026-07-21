"use client";

import type { GrapeState } from "@/lib/grapes";
import { getSkin, type GrapeSkin } from "@/lib/skins";

interface Props {
  grape: GrapeState;
  cx: number;
  cy: number;
  r: number;
  selected?: boolean;
  onClick?: () => void;
  /** 합격 포도알에 입힐 스킨 (기본 머루) */
  skin?: GrapeSkin;
}

/** 포도알 1개. 상태: 빈 알(점선) / 검토 대기(연두) / 합격(스킨색) / 재연습(주황 점선 + ↺) */
export function GrapeBerry({ grape, cx, cy, r, selected, onClick, skin: skinProp }: Props) {
  const { status } = grape;
  const skin = skinProp ?? getSkin(undefined);

  const circle =
    status === "approved" ? (
      <circle cx={cx} cy={cy} r={r} fill={`url(#skin-${skin.id})`} stroke={skin.stroke} strokeWidth={1.5} />
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
      {/* 이펙트: 불꽃/글로우 후광 (알 뒤에서 번져 나온다) */}
      {status === "approved" && (skin.effect === "flame" || skin.effect === "glow") && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={skin.colors[0]}
          className={skin.effect === "flame" ? "gn-fx-flame" : "gn-fx-glow"}
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            animationDelay: `${(grape.index % 5) * 0.13}s`,
          }}
        />
      )}
      {circle}
      {status === "approved" && (
        // 광택
        <ellipse cx={cx - r * 0.35} cy={cy - r * 0.4} rx={r * 0.28} ry={r * 0.18} fill={skin.gloss} opacity={0.8} />
      )}
      {/* 이펙트: 반짝임 (별빛 점들) */}
      {status === "approved" && skin.effect === "sparkle" && (
        <>
          <circle
            cx={cx + r * 0.42}
            cy={cy - r * 0.45}
            r={r * 0.14}
            fill="#ffffff"
            className="gn-fx-sparkle"
            style={{ animationDelay: `${(grape.index % 3) * 0.4}s` }}
          />
          <circle
            cx={cx - r * 0.45}
            cy={cy + r * 0.38}
            r={r * 0.1}
            fill="#ffffff"
            className="gn-fx-sparkle"
            style={{ animationDelay: `${(grape.index % 3) * 0.4 + 0.7}s` }}
          />
        </>
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
