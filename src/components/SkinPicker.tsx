"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setGrapeSkin } from "@/lib/actions/skins";
import {
  SKINS,
  isSkinUnlocked,
  unlockCurrent,
  unlockLabel,
  type GrapeSkin,
  type SkinStats,
} from "@/lib/skins";

interface Props {
  currentSkinId: string;
  stats: SkinStats;
}

/** 포도알 한 알 미리보기 (스킨 색) */
function Swatch({ skin, dim }: { skin: GrapeSkin; dim?: boolean }) {
  const gid = `swatch-${skin.id}`;
  return (
    <svg viewBox="0 0 40 40" className="w-11 h-11 shrink-0" aria-hidden style={dim ? { opacity: 0.4 } : undefined}>
      <defs>
        <radialGradient id={gid} cx="0.35" cy="0.3" r="0.9">
          {skin.colors.map((c, i) => (
            <stop key={i} offset={`${(i / (skin.colors.length - 1)) * 100}%`} stopColor={c} />
          ))}
        </radialGradient>
      </defs>
      <circle cx={20} cy={21} r={16} fill={`url(#${gid})`} stroke={skin.stroke} strokeWidth={1.5} />
      <ellipse cx={13} cy={14} rx={5} ry={3.2} fill={skin.gloss} opacity={0.8} />
    </svg>
  );
}

/** 내 포도밭의 포도알 스킨 고르기 — 잠금 해제한 것만 선택 가능 */
export function SkinPicker({ currentSkinId, stats }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (skin: GrapeSkin) => {
    if (saving || skin.id === currentSkinId || !isSkinUnlocked(skin, stats)) return;
    setError(null);
    setSaving(skin.id);
    const result = await setGrapeSkin(skin.id);
    setSaving(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <section>
      <h2 className="text-lg font-extrabold text-violet-900">🎨 포도알 스킨</h2>
      <p className="mt-0.5 text-xs text-gray-400">
        열심히 연습하면 새 색이 열려요. 마음에 드는 걸 골라 포도알에 입혀 보세요!
      </p>
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}

      <ul className="mt-2 grid grid-cols-2 gap-2">
        {SKINS.map((skin) => {
          const unlocked = isSkinUnlocked(skin, stats);
          const selected = skin.id === currentSkinId;
          const have = unlockCurrent(skin.unlock, stats);
          const need = skin.unlock.kind === "free" ? 0 : skin.unlock.n;

          return (
            <li key={skin.id}>
              <button
                type="button"
                onClick={() => pick(skin)}
                disabled={!unlocked || selected || saving !== null}
                className={`w-full text-left rounded-2xl border-2 p-3 flex items-center gap-3 transition-colors ${
                  selected
                    ? "bg-violet-50 border-violet-400"
                    : unlocked
                      ? "bg-white border-violet-100 active:bg-violet-50"
                      : "bg-gray-50 border-gray-100"
                }`}
              >
                <Swatch skin={skin} dim={!unlocked} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-gray-800 flex items-center gap-1">
                    {skin.emoji} {skin.name}
                    {selected && <span className="text-violet-600">✓</span>}
                  </p>
                  {selected ? (
                    <p className="text-xs font-bold text-violet-600">사용 중</p>
                  ) : unlocked ? (
                    <p className="text-xs text-gray-400">
                      {saving === skin.id ? "입히는 중..." : "누르면 적용"}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 truncate">
                      🔒 {unlockLabel(skin.unlock)}
                      {have != null && (
                        <span className="text-gray-300"> ({have}/{need})</span>
                      )}
                    </p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
