"use client";

import { useRef, useState } from "react";
import { VideoRecorder } from "./VideoRecorder";
import { useUploadManager } from "./UploadManager";

import { groupLimits, formatBytes } from "@/lib/limits";

interface Props {
  cardId: string;
  grapeIndex: number;
  onDone: () => void;
  /** 그룹 프리미엄 — 업로드 상한 확대 + 720p 녹화 */
  premium?: boolean;
}

/** 촬영/파일 선택 → 백그라운드 업로드 시작 (진행률은 하단 칩에서 표시) */
export function VideoUploader({ cardId, grapeIndex, onDone, premium = false }: Props) {
  const limits = groupLimits(premium);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { startUpload } = useUploadManager();
  const [showRecorder, setShowRecorder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("video/")) {
      setError("영상 파일만 올릴 수 있어요.");
      return;
    }
    if (file.size > limits.maxUploadBytes) {
      setError(
        `영상이 너무 커요 (최대 ${formatBytes(limits.maxUploadBytes)}). 앱의 촬영 버튼으로 찍으면 5분까지 올릴 수 있어요.`
      );
      return;
    }

    const result = startUpload({ cardId, grapeIndex, file, title, comment });
    if (!result.ok) {
      setError(result.error ?? "업로드를 시작하지 못했어요.");
      return;
    }
    onDone(); // 업로드는 백그라운드로 계속 — 시트를 닫고 다른 것을 해도 된다
  };

  return (
    <div className="flex flex-col gap-3">
      {showRecorder && (
        <VideoRecorder
          hd={limits.hd}
          onRecorded={(file) => {
            setShowRecorder(false);
            handleFile(file);
          }}
          onClose={() => setShowRecorder(false)}
          onFallback={() => {
            setShowRecorder(false);
            cameraRef.current?.click();
          }}
        />
      )}
      {/* 인앱 녹화가 안 되는 기기용 폴백: 기본 카메라 앱 */}
      <input
        ref={cameraRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        placeholder="영상 제목 (선택) — 예: 오른손만 연습!"
        className="h-12 px-4 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="선생님께 한마디 (선택) — 예: 셋째 마디가 어려워요 🥲"
        className="px-4 py-3 rounded-xl border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      <button
        type="button"
        onClick={() => setShowRecorder(true)}
        className="h-14 rounded-2xl bg-violet-600 text-white text-lg font-bold active:bg-violet-800"
      >
        📹 지금 촬영하기
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="h-14 rounded-2xl bg-violet-100 text-violet-800 text-lg font-bold active:bg-violet-300"
      >
        🎞️ 앨범에서 고르기
      </button>
      <p className="text-center text-sm text-gray-500">최대 5분까지 찍을 수 있어요 (50MB)</p>
      {error && <p className="text-center text-sm text-red-500 font-medium">{error}</p>}
    </div>
  );
}
