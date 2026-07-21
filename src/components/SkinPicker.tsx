"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setGrapeSkin } from "@/lib/actions/skins";
import { GrapeBunch } from "./GrapeBunch";
import { BerryTexture } from "./GrapeBerry";
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
import type { GrapeState } from "@/lib/grapes";

interface Props {
  currentSkinId: string;
  stats: SkinStats;
}

/** 미리보기용 포도송이 (전부 합격 상태라 스킨이 그대로 보인다) */
const PREVIEW_GRAPES: GrapeState[] = Array.from({ length: 10 }, (_, i) => ({
  index: i + 1,
  status: "approved" as const,
  history: [],
}));

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
      {skin.texture && (
        <>
          <clipPath id={`${gid}-clip`}>
            <circle cx={0} cy={0} r={1} />
          </clipPath>
          <g transform="translate(20 21) scale(16)" clipPath={`url(#${gid}-clip)`}>
            <BerryTexture skin={skin} />
          </g>
        </>
      )}
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

/**
 * 포도알 스킨 고르기 — 눌러(또는 마우스를 올려) 미리 보고, 적용 버튼으로 확정한다.
 * 잠긴 스킨도 미리보기는 되므로 "뭘 향해 달리는지" 보인다.
 */
export function SkinPicker({ currentSkinId, stats }: Props) {
  const router = useRouter();
  const [previewId, setPreviewId] = useState(currentSkinId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const owned = unlockedSkinIds(stats);
  const canRandom = owned.length >= 2;

  const previewIsRandom = previewId === RANDOM_SKIN_ID;
  const previewSkin = getSkin(previewId);
  const previewUnlocked = previewIsRandom ? canRandom : isSkinUnlocked(previewSkin, stats);
  const applied = previewId === currentSkinId;

  const apply = async () => {
    if (saving || applied || !previewUnlocked) return;
    setError(null);
    setSaving(true);
    const result = await setGrapeSkin(previewId);
    setSaving(false);
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
        눌러서(PC는 마우스만 올려도) 미리 보고, 마음에 들면 적용하세요.
      </p>

      {/* 미리보기 + 적용 — 목록을 내려도 위에 붙어 있게 sticky */}
      <div className="sticky top-14 z-30 pt-2 pb-2 bg-violet-50/95 backdrop-blur">
        <div className="rounded-2xl bg-white border-2 border-violet-200 shadow-sm p-3 flex items-center gap-3">
          <GrapeBunch
            grapes={PREVIEW_GRAPES}
            skinId={previewId}
            randomPool={owned}
            className="h-32 w-auto shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-gray-800 truncate">
              {previewIsRandom ? "🎲 랜덤 포도" : `${previewSkin.emoji} ${previewSkin.name}`}
              {applied && <span className="ml-1 text-violet-600">· 사용 중</span>}
            </p>
            {!previewUnlocked && (
              <p className="text-xs text-gray-400 truncate">
                🔒 {previewIsRandom ? "스킨 2개 이상 모으기" : unlockLabel(previewSkin.unlock)}
              </p>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="button"
              onClick={apply}
              disabled={saving || applied || !previewUnlocked}
              className="mt-1.5 w-full h-10 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:bg-gray-200 disabled:text-gray-400 active:bg-violet-800"
            >
              {saving
                ? "입히는 중..."
                : applied
                  ? "지금 쓰고 있어요"
                  : !previewUnlocked
                    ? "아직 잠겨 있어요"
                    : "이 스킨 적용하기"}
            </button>
          </div>
        </div>
      </div>

      {/* 랜덤 포도 */}
      <button
        type="button"
        onMouseEnter={() => setPreviewId(RANDOM_SKIN_ID)}
        onFocus={() => setPreviewId(RANDOM_SKIN_ID)}
        onClick={() => setPreviewId(RANDOM_SKIN_ID)}
        className={`mt-2 w-full text-left rounded-2xl border-2 p-3 flex items-center gap-3 transition-colors ${
          previewId === RANDOM_SKIN_ID
            ? "bg-violet-50 border-violet-400"
            : "bg-white border-violet-100 hover:border-violet-300"
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
            {currentSkinId === RANDOM_SKIN_ID && <span className="text-violet-600">✓</span>}
          </p>
          <p className="text-xs text-gray-400">
            {canRandom
              ? `가진 스킨 ${owned.length}개가 알마다 랜덤으로!`
              : "🔒 스킨 2개 이상 모으기"}
          </p>
        </div>
      </button>

      {/* 스킨 목록 */}
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {SKINS.map((skin) => {
          const unlocked = isSkinUnlocked(skin, stats);
          const isPreview = skin.id === previewId;
          const inUse = skin.id === currentSkinId;
          const have = unlockCurrent(skin.unlock, stats);
          const need = skin.unlock.kind === "free" ? 0 : skin.unlock.n;

          return (
            <li key={skin.id}>
              <button
                type="button"
                onMouseEnter={() => setPreviewId(skin.id)}
                onFocus={() => setPreviewId(skin.id)}
                onClick={() => setPreviewId(skin.id)}
                className={`w-full text-left rounded-2xl border-2 p-3 flex items-center gap-3 transition-colors ${
                  isPreview
                    ? "bg-violet-50 border-violet-400"
                    : unlocked
                      ? "bg-white border-violet-100 hover:border-violet-300"
                      : "bg-gray-50 border-gray-100 hover:border-gray-300"
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
                    {inUse && <span className="text-violet-600">✓</span>}
                  </p>
                  {inUse ? (
                    <p className="text-xs font-bold text-violet-600">사용 중</p>
                  ) : unlocked ? (
                    <p className="text-xs text-gray-400">눌러서 미리보기</p>
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
