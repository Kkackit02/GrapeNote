"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setGrapeSkin } from "@/lib/actions/skins";
import {
  SKINS,
  isSkinUnlocked,
  unlockCurrent,
  unlockLabel,
  unlockedSkinIds,
  getSkin,
  RANDOM_SKIN_ID,
  type GrapeSkin,
  type SkinStats,
} from "@/lib/skins";

interface Props {
  currentSkinId: string;
  stats: SkinStats;
}

/** 포도알 한 알 미리보기 (스킨 색) */
function Swatch({ skin, dim, mini }: { skin: GrapeSkin; dim?: boolean; mini?: boolean }) {
  const gid = `swatch-${skin.id}`;
  return (
    <svg
      viewBox="0 0 40 40"
      className={`${mini ? "w-8 h-8" : "w-11 h-11"} shrink-0`}
      aria-hidden
      style={dim ? { opacity: 0.4 } : undefined}
    >
      <defs>
        <radialGradient id={gid} cx="0.35" cy="0.3" r="0.9">
          {skin.colors.map((c, i) => (
            <stop key={i} offset={`${(i / (skin.colors.length - 1)) * 100}%`} stopColor={c} />
          ))}
        </radialGradient>
      </defs>
      {!dim && (skin.effect === "flame" || skin.effect === "glow") && (
        <circle
          cx={20}
          cy={21}
          r={16}
          fill={skin.colors[0]}
          className={skin.effect === "flame" ? "gn-fx-flame" : "gn-fx-glow"}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      )}
      <circle cx={20} cy={21} r={16} fill={`url(#${gid})`} stroke={skin.stroke} strokeWidth={1.5} />
      <ellipse cx={13} cy={14} rx={5} ry={3.2} fill={skin.gloss} opacity={0.8} />
      {!dim && skin.effect === "sparkle" && (
        <>
          <circle cx={28} cy={13} r={2.6} fill="#ffffff" className="gn-fx-sparkle" />
          <circle cx={12} cy={29} r={1.8} fill="#ffffff" className="gn-fx-sparkle" style={{ animationDelay: "0.7s" }} />
        </>
      )}
    </svg>
  );
}

/** 내 포도밭의 포도알 스킨 고르기 — 잠금 해제한 것만 선택 가능 */
export function SkinPicker({ currentSkinId, stats }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** 스킨 id(또는 "random")를 적용한다. 잠금 검증은 버튼 disabled + 서버가 함께 막는다. */
  const pick = async (id: string) => {
    if (saving || id === currentSkinId) return;
    setError(null);
    setSaving(id);
    const result = await setGrapeSkin(id);
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

      {/* 랜덤 포도 — 가진 스킨들이 포도알마다 섞여 박힌다 */}
      {(() => {
        const owned = unlockedSkinIds(stats);
        const canRandom = owned.length >= 2;
        const selected = currentSkinId === RANDOM_SKIN_ID;
        return (
          <button
            type="button"
            onClick={() => canRandom && pick(RANDOM_SKIN_ID)}
            disabled={!canRandom || selected || saving !== null}
            className={`mt-2 w-full text-left rounded-2xl border-2 p-3 flex items-center gap-3 ${
              selected
                ? "bg-violet-50 border-violet-400"
                : canRandom
                  ? "bg-white border-violet-100 active:bg-violet-50"
                  : "bg-gray-50 border-gray-100"
            }`}
          >
            <span className="flex -space-x-2 shrink-0">
              {(canRandom ? owned : ["violet", "green", "gold"]).slice(0, 3).map((id, i) => (
                <Swatch key={i} skin={getSkin(id)} dim={!canRandom} mini />
              ))}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-gray-800 flex items-center gap-1">
                🎲 랜덤 포도
                {selected && <span className="text-violet-600">✓</span>}
              </p>
              {selected ? (
                <p className="text-xs font-bold text-violet-600">사용 중 · 가진 스킨 {owned.length}개가 섞여요</p>
              ) : canRandom ? (
                <p className="text-xs text-gray-400">
                  {saving === RANDOM_SKIN_ID ? "입히는 중..." : `가진 스킨 ${owned.length}개가 알마다 랜덤으로!`}
                </p>
              ) : (
                <p className="text-xs text-gray-400">🔒 스킨 2개 이상 모으기</p>
              )}
            </div>
          </button>
        );
      })()}

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
                onClick={() => pick(skin.id)}
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
                    {skin.effect && (
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 py-0.5 rounded-full">
                        ✨이펙트
                      </span>
                    )}
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
