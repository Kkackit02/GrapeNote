"use client";

import { useRef, useState } from "react";
import { VideoRecorder, type RecorderTrack } from "./VideoRecorder";
import { useUploadManager } from "./UploadManager";

import { groupLimits, formatBytes } from "@/lib/limits";
import { instrumentEmoji } from "@/lib/instruments";

interface Props {
  cardId: string;
  grapeIndex: number;
  onDone: () => void;
  /** 그룹 프리미엄 — 업로드 상한 확대 + 720p 녹화 */
  premium?: boolean;
  /** 검토자 호칭 (선생님/운영진/리더) */
  leaderLabel?: string;
  /** 이 곡의 MR — 녹화 중 반주로 틀 수 있다 */
  tracks?: RecorderTrack[];
  /** 고를 수 있는 악기 목록 (기본은 내 세션이 맨 앞) */
  instrumentOptions?: string[];
  /** 기본 선택 악기 (내 주 세션) */
  defaultInstrument?: string;
}

/**
 * 인앱 촬영 → 백그라운드 업로드 시작 (진행률은 하단 칩에서 표시).
 * 저장 공간 관리를 위해 앨범(갤러리) 업로드는 막고 촬영만 허용한다 —
 * 촬영 단계에서 해상도/비트레이트가 제한되어 파일이 작게 만들어진다.
 */
export function VideoUploader({
  cardId,
  grapeIndex,
  onDone,
  premium = false,
  leaderLabel = "선생님",
  tracks = [],
  instrumentOptions = [],
  defaultInstrument = "",
}: Props) {
  const limits = groupLimits(premium);
  const cameraRef = useRef<HTMLInputElement>(null);
  const { startUpload } = useUploadManager();
  const [showRecorder, setShowRecorder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [instrument, setInstrument] = useState(defaultInstrument);

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

    const result = startUpload({ cardId, grapeIndex, file, title, comment, instrument });
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
          tracks={tracks}
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
      {instrumentOptions.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-gray-700">🎸 어떤 악기로 연습했나요?</span>
          <select
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            {instrumentOptions.map((name) => (
              <option key={name} value={name}>
                {instrumentEmoji(name)} {name}
              </option>
            ))}
            {/* 세션이 없거나 애매할 때 — 엉뚱한 악기로 집계되지 않게 */}
            <option value="">🎵 악기 미지정</option>
          </select>
          <span className="text-xs text-gray-400">
            다른 악기로 연습해도 괜찮아요 — 그 악기 포도알이 쌓이면 전용 스킨이 열려요!
          </span>
        </label>
      )}
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
        placeholder={`${leaderLabel}에게 한마디 (선택) — 예: 셋째 마디가 어려워요 🥲`}
        className="px-4 py-3 rounded-xl border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      <button
        type="button"
        onClick={() => setShowRecorder(true)}
        className="h-14 rounded-2xl bg-violet-600 text-white text-lg font-bold active:bg-violet-800"
      >
        📹 지금 촬영하기
      </button>
      <p className="text-center text-sm text-gray-500">
        최대 5분까지 찍을 수 있어요
        {tracks.length > 0 && (
          <>
            <br />
            <span className="text-xs font-bold text-violet-600">
              🎧 이 곡의 반주(MR)를 틀면서 녹음할 수 있어요
            </span>
          </>
        )}
        <br />
        <span className="text-xs text-gray-400">
          저장 공간을 위해 앨범 업로드 대신 바로 촬영만 지원해요
        </span>
      </p>
      {error && <p className="text-center text-sm text-red-500 font-medium">{error}</p>}
    </div>
  );
}
