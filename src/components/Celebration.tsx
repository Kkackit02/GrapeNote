"use client";

import { useMemo } from "react";

const EMOJI = ["🍇", "🎉", "⭐", "🎵", "💜"];

/** index 기반 의사난수 (0~1) — 렌더 간 안정적 */
function jitter(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 카드 완성 축하 — CSS 애니메이션 이모지 낙하 */
export function Celebration() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        emoji: EMOJI[i % EMOJI.length],
        left: jitter(i, 1) * 100,
        delay: jitter(i, 2) * 2,
        duration: 2.5 + jitter(i, 3) * 2,
        size: 20 + jitter(i, 4) * 20,
      })),
    []
  );

  return (
    <div aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            fontSize: `${p.size}px`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
