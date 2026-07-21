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

/**
 * 네 갈래 별빛 반짝임. 위치·크기는 바깥 <g>가 잡고, 애니메이션은 안쪽 path에 걸어
 * CSS transform이 위치 지정과 충돌하지 않게 한다.
 */
function Sparkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <path
        d="M 0 -1 Q 0.18 -0.18 1 0 Q 0.18 0.18 0 1 Q -0.18 0.18 -1 0 Q -0.18 -0.18 0 -1 Z"
        fill="#ffffff"
        className="gn-fx-sparkle"
        style={{ animationDelay: `${delay}s` }}
      />
    </g>
  );
}

/**
 * 알 표면 무늬. 단위원(-1~1) 좌표로 그린 뒤 알 크기만큼 확대하고 원으로 잘라낸다.
 * (색·그라데이션만으론 밋밋해서 질감을 얹는다)
 */
export function BerryTexture({ skin }: { skin: GrapeSkin }) {
  const c = skin.textureColor ?? skin.gloss;
  switch (skin.texture) {
    case "stripe":
      return (
        <g opacity={0.3}>
          {[-0.75, -0.25, 0.25, 0.75].map((x) => (
            <rect key={x} x={x - 0.1} y={-1.4} width={0.2} height={2.8} fill={c} transform="rotate(20)" />
          ))}
        </g>
      );
    case "speckle":
      return (
        <g opacity={0.5}>
          {[
            [-0.4, -0.15, 0.13],
            [0.3, 0.35, 0.1],
            [-0.05, 0.55, 0.08],
            [0.5, -0.4, 0.09],
            [-0.55, 0.4, 0.07],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={c} />
          ))}
        </g>
      );
    case "facet":
      // 보석 컷 — 중심에서 뻗은 면들
      return (
        <g opacity={0.32}>
          <polygon points="0,-0.9 0.55,-0.1 0,0.5 -0.55,-0.1" fill={c} />
          <polygon points="0,-0.9 -0.55,-0.1 -0.9,-0.45" fill={c} opacity={0.6} />
          <polygon points="0,0.5 0.55,-0.1 0.85,0.35" fill={c} opacity={0.5} />
        </g>
      );
    case "metal":
      // 금속 광택 — 비스듬한 밝은 띠
      return (
        <g opacity={0.4}>
          <rect x={-1.3} y={-0.42} width={2.6} height={0.3} fill={c} transform="rotate(-28)" />
          <rect x={-1.3} y={0.16} width={2.6} height={0.14} fill={c} opacity={0.7} transform="rotate(-28)" />
        </g>
      );
    case "swirl":
      return (
        <g opacity={0.42} fill="none" stroke={c} strokeLinecap="round">
          <path d="M -0.75 0.2 C -0.3 -0.6, 0.35 -0.55, 0.6 0.05" strokeWidth={0.16} />
          <path d="M -0.5 0.62 C -0.1 0.1, 0.45 0.3, 0.72 0.55" strokeWidth={0.12} opacity={0.8} />
        </g>
      );
    case "holo":
      // 간섭무늬 — 여러 색 띠라 textureColor 대신 고정 팔레트를 쓴다.
      // 초록·민트·청록을 주도색으로 두고 라임/연노랑을 살짝 섞어 어른거리게.
      return (
        <g opacity={0.55} transform="rotate(-25)">
          {["#bbf7d0", "#5eead4", "#22d3ee", "#a3e635", "#4ade80"].map((band, i) => (
            <rect key={band} x={-1.4 + i * 0.56} y={-1.4} width={0.56} height={2.8} fill={band} />
          ))}
        </g>
      );
    case "droplet":
      // 맺힌 물방울 — 테두리 + 작은 하이라이트
      return (
        <g opacity={0.6}>
          {[
            [-0.36, -0.3, 0.26],
            [0.4, 0.16, 0.2],
            [-0.14, 0.52, 0.16],
          ].map(([x, y, rr], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={rr} fill={c} opacity={0.3} />
              <circle cx={x} cy={y} r={rr} fill="none" stroke={c} strokeWidth={0.05} />
              <ellipse cx={x - rr * 0.3} cy={y - rr * 0.35} rx={rr * 0.3} ry={rr * 0.2} fill="#ffffff" opacity={0.85} />
            </g>
          ))}
        </g>
      );
    case "starfield":
      // 성운 한 줄기 + 크기가 제각각인 별들
      return (
        <g>
          <path
            d="M -1 0.35 C -0.4 -0.2, 0.35 0.15, 1 -0.45"
            stroke={c}
            strokeWidth={0.3}
            fill="none"
            opacity={0.22}
            strokeLinecap="round"
          />
          <g fill={c} opacity={0.9}>
            {[
              [-0.5, -0.45, 0.07],
              [0.22, -0.6, 0.05],
              [0.55, -0.18, 0.06],
              [-0.22, 0.18, 0.045],
              [0.34, 0.5, 0.06],
              [-0.6, 0.36, 0.05],
              [0.06, -0.16, 0.035],
            ].map(([x, y, rr], i) => (
              <circle key={i} cx={x} cy={y} r={rr} />
            ))}
          </g>
        </g>
      );
    default:
      return null;
  }
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
        <>
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
          {/* 불꽃은 박자가 어긋난 두 겹으로 더 일렁이게 */}
          {skin.effect === "flame" && (
            <circle
              cx={cx}
              cy={cy - r * 0.15}
              r={r * 0.9}
              fill={skin.gloss}
              className="gn-fx-flame"
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animationDelay: `${(grape.index % 5) * 0.13 + 0.35}s`,
              }}
            />
          )}
        </>
      )}
      {circle}
      {/* 표면 무늬 — 알 안쪽으로 잘라 낸다 */}
      {status === "approved" && skin.texture && (
        <g transform={`translate(${cx} ${cy}) scale(${r})`} clipPath="url(#gn-berry-clip)">
          <BerryTexture skin={skin} />
        </g>
      )}
      {status === "approved" && (
        // 광택
        <ellipse cx={cx - r * 0.35} cy={cy - r * 0.4} rx={r * 0.28} ry={r * 0.18} fill={skin.gloss} opacity={0.8} />
      )}
      {/* 이펙트: 반짝임 (네 갈래 별빛) */}
      {status === "approved" && skin.effect === "sparkle" && (
        <>
          <Sparkle
            x={cx + r * 0.45}
            y={cy - r * 0.48}
            size={r * 0.34}
            delay={(grape.index % 3) * 0.4}
          />
          <Sparkle
            x={cx - r * 0.48}
            y={cy + r * 0.4}
            size={r * 0.24}
            delay={(grape.index % 3) * 0.4 + 0.7}
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
