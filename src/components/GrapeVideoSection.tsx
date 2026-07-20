"use client";

import { useState } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { getPlaybackUrl } from "@/lib/actions/uploads";
import type { Submission } from "@/lib/types";

interface Props {
  /** 이 포도알의 제출 이력 (최신순) */
  history: Submission[];
  grapeIndex: number;
  /** 판정 후 영상 파일 보존 일수 — 지나면 자동 정리된다 */
  retentionDays?: number;
}

/** 내 영상 보기 + 이전 도전 영상 선택 + 다운로드 */
export function GrapeVideoSection({ history, grapeIndex, retentionDays }: Props) {
  const [selectedId, setSelectedId] = useState(history[0]?.id);
  const [downloading, setDownloading] = useState(false);

  if (history.length === 0) return null;
  const selected = history.find((s) => s.id === selectedId) ?? history[0];
  // 시도 번호: 오래된 것이 1번
  const attempt = history.length - history.indexOf(selected);
  const ext = selected.video_path.split(".").pop() ?? "mp4";

  const download = async () => {
    setDownloading(true);
    const result = await getPlaybackUrl(selected.id, `grape${grapeIndex}-take${attempt}.${ext}`);
    setDownloading(false);
    if (!result.ok) return;
    const a = document.createElement("a");
    a.href = result.data.url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="flex flex-col gap-2">
      {(selected.student_title || selected.student_comment) && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
          {selected.student_title && (
            <p className="text-sm font-bold text-gray-700">🎬 {selected.student_title}</p>
          )}
          {selected.student_comment && (
            <p className="text-sm text-gray-500 mt-0.5">💬 {selected.student_comment}</p>
          )}
        </div>
      )}
      <VideoPlayer key={selected.id} submissionId={selected.id} />
      <div className="flex items-center justify-between gap-2">
        {history.length > 1 ? (
          <div className="flex gap-1.5 flex-wrap">
            {[...history].reverse().map((sub, i) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSelectedId(sub.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  sub.id === selected.id
                    ? "bg-violet-600 text-white"
                    : "bg-violet-50 text-violet-600"
                }`}
              >
                {i + 1}번째{sub.status === "approved" ? " 🍇" : ""}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs text-gray-400">내가 올린 영상이에요</span>
        )}
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="shrink-0 px-3 py-2 rounded-lg bg-sky-600 text-white text-xs font-bold active:bg-sky-700 disabled:opacity-50"
        >
          {downloading ? "준비 중..." : "⬇ 내 폰에 저장"}
        </button>
      </div>
      {retentionDays !== undefined && selected.status !== "pending" && (
        <p className="text-xs text-amber-600 font-medium">
          ⏳ 판정된 영상은 {retentionDays}일 뒤 저장 공간을 위해 지워져요. 남기고 싶으면 저장해 두세요!
        </p>
      )}
    </div>
  );
}
