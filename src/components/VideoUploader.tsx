"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { requestUpload, confirmUpload } from "@/lib/actions/uploads";

const MAX_SIZE_BYTES = 50 * 1024 * 1024;

/** 파일 SHA-256 (hex) — 같은 영상 재탕 감지용 */
async function hashFile(file: File): Promise<string | undefined> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined; // 해시 실패해도 업로드는 진행 (중복 검사만 생략)
  }
}

interface Props {
  cardId: string;
  grapeIndex: number;
  onDone: () => void;
}

/** 촬영/파일 선택 → signed URL로 Storage 직접 업로드 → submission 등록 */
export function VideoUploader({ cardId, grapeIndex, onDone }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("video/")) {
      setError("영상 파일만 올릴 수 있어요.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("영상이 너무 커요 (최대 50MB). 1분 이내로 촬영해 주세요.");
      return;
    }

    setUploading(true);
    try {
      const fileHash = await hashFile(file);
      const req = await requestUpload({
        cardId,
        grapeIndex,
        fileName: file.name || "video.mp4",
        fileSize: file.size,
        fileHash,
      });
      if (!req.ok) {
        setError(req.error);
        return;
      }

      const supabase = createSupabaseBrowser();
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .uploadToSignedUrl(req.data.path, req.data.token, file);
      if (uploadError) {
        setError("업로드에 실패했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
        return;
      }

      const confirm = await confirmUpload({
        cardId,
        grapeIndex,
        path: req.data.path,
        fileSize: file.size,
        fileHash,
      });
      if (!confirm.ok) {
        setError(confirm.error);
        return;
      }
      onDone();
    } finally {
      setUploading(false);
    }
  };

  if (uploading) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="w-10 h-10 border-4 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
        <p className="text-violet-700 font-medium">영상을 올리는 중이에요...</p>
        <p className="text-sm text-gray-500">화면을 닫지 말고 잠시만 기다려 주세요</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
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
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
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
      <p className="text-center text-sm text-gray-500">1분 이내 영상으로 올려 주세요 (최대 50MB)</p>
      {error && <p className="text-center text-sm text-red-500 font-medium">{error}</p>}
    </div>
  );
}
