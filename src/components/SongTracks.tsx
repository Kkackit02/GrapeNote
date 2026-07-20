"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestTrackUpload,
  confirmTrackUpload,
  deleteTrack,
  getTrackUrl,
} from "@/lib/actions/tracks";
import type { SongTrack } from "@/lib/types";

interface Props {
  songTitle: string;
  tracks: SongTrack[];
  myId: string;
  isTeacher: boolean;
}

/** 곡별 MR/연습 트랙: 재생·추가·삭제. 선생님(리더) 업로드는 "기본 MR"로 표시된다. */
export function SongTracks({ songTitle, tracks, myId, isTeacher }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const req = await requestTrackUpload({
        songTitle,
        fileName: file.name,
        fileSize: file.size,
      });
      if (!req.ok) {
        setError(req.error);
        return;
      }
      const res = await fetch(req.data.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "audio/mpeg" },
        body: file,
      });
      if (!res.ok) {
        setError("업로드에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      const confirmed = await confirmTrackUpload({ songTitle, path: req.data.path, label });
      if (!confirmed.ok) {
        setError(confirmed.error);
        return;
      }
      setLabel("");
      router.refresh();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const play = async (track: SongTrack) => {
    if (playingId === track.id) {
      setPlayingId(null);
      setPlayingUrl(null);
      return;
    }
    setError(null);
    const result = await getTrackUrl(track.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPlayingId(track.id);
    setPlayingUrl(result.data.url);
  };

  const remove = async (track: SongTrack) => {
    if (!window.confirm(`'${track.label ?? "MR"}' 음원을 지울까요?`)) return;
    setBusy(true);
    const result = await deleteTrack(track.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (playingId === track.id) {
      setPlayingId(null);
      setPlayingUrl(null);
    }
    router.refresh();
  };

  return (
    <section className="rounded-2xl bg-white border border-violet-100 p-4 flex flex-col gap-3">
      <h2 className="font-extrabold text-violet-900">🎧 연습 음원 (MR)</h2>

      {tracks.length === 0 ? (
        <p className="text-sm text-gray-400">
          아직 등록된 음원이 없어요. 반주나 원곡을 올려서 함께 써 보세요!
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tracks.map((track) => (
            <li key={track.id} className="rounded-xl border border-violet-50 bg-violet-50/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {track.uploader_role === "teacher" && (
                      <span className="mr-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full align-middle">
                        ⭐ 기본
                      </span>
                    )}
                    {track.label ?? "MR"}
                  </p>
                  <p className="text-xs text-gray-400">{track.uploader_name}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => play(track)}
                    className={`w-9 h-9 rounded-full font-bold ${
                      playingId === track.id
                        ? "bg-violet-600 text-white"
                        : "bg-white border border-violet-200 text-violet-600"
                    }`}
                    aria-label={playingId === track.id ? "정지" : "재생"}
                  >
                    {playingId === track.id ? "■" : "▶"}
                  </button>
                  {(isTeacher || track.uploaded_by === myId) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(track)}
                      className="w-9 h-9 rounded-full bg-red-50 text-red-400 font-bold disabled:opacity-50"
                      aria-label="음원 삭제"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
              {playingId === track.id && playingUrl && (
                <audio src={playingUrl} controls autoPlay className="mt-2 w-full h-9" />
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={isTeacher ? "이름 (예: 원곡, 템포 90%)" : "이름 (예: 드럼 없는 버전)"}
          className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="shrink-0 px-4 h-11 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50 active:bg-violet-800"
        >
          {busy ? "올리는 중..." : "+ 음원 올리기"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
    </section>
  );
}
