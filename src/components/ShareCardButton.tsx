"use client";

import { useRef, useState } from "react";
import { drawShareCard } from "@/lib/share-card";
import { getSkin } from "@/lib/skins";

interface Props {
  totalGrapes: number;
  skinId?: string;
  /** 랜덤 포도용 — 가진 스킨 id 목록 */
  randomPool?: string[];
  title: string;
  memberName: string;
  groupName: string;
  /** ISO 완성 시각 */
  completedAt?: string | null;
}

/**
 * 완성 포도송이를 이미지 카드로 만들어 밖(단톡방·인스타)에 자랑한다.
 * 캔버스로 그려 Web Share(모바일)로 공유하거나 이미지를 저장한다. 고른 스킨 색이 반영된다.
 */
export function ShareCardButton({
  totalGrapes,
  skinId,
  randomPool,
  title,
  memberName,
  groupName,
  completedAt,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dateText = completedAt
    ? `${new Date(completedAt).toLocaleDateString("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "long",
        day: "numeric",
      })} 완성`
    : "완성!";

  const render = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      drawShareCard(canvas, {
        totalGrapes,
        skin: getSkin(skinId),
        randomPoolIds: randomPool,
        title,
        memberName,
        groupName,
        dateText,
      });
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });

  const makeAndShare = async () => {
    setBusy(true);
    try {
      const blob = await render();
      if (!blob) return;

      // 미리보기 갱신 (길게 눌러 저장도 가능)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });

      const fileName = `GrapeNote-${title}.png`.replace(/[\\/:*?"<>|]/g, "_");
      const file = new File([blob], fileName, { type: "image/png" });

      // 모바일: 공유 시트 (단톡방·인스타 스토리로 바로)
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${title} 완성! 🍇` });
          return;
        } catch {
          // 취소하면 미리보기만 남긴다
          return;
        }
      }

      // 데스크톱 등: 파일 저장
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={makeAndShare}
        className="h-13 py-3 rounded-2xl bg-violet-100 text-violet-800 font-extrabold disabled:opacity-50 active:bg-violet-200"
      >
        {busy ? "만드는 중..." : "🖼️ 자랑 카드로 밖에 공유하기"}
      </button>
      {previewUrl && (
        <div className="rounded-2xl border border-violet-100 overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="자랑 카드 미리보기" className="w-full" />
          <p className="px-3 py-2 text-center text-xs text-gray-400">
            이미지를 길게 눌러 저장하거나, 위 버튼으로 바로 공유해요.
          </p>
        </div>
      )}
    </div>
  );
}
