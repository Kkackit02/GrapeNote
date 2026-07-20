"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getTrackUrl } from "@/lib/actions/tracks";

const MAX_SECONDS = 300; // 최대 5분
const AUDIO_BPS = 128_000;

// 화질 프리셋 — hd(720p)는 프리미엄 그룹 전용 (버킷 상한 200MB 안에서 동작)
const QUALITY = {
  sd: { width: 854, height: 480, videoBps: 1_000_000, maxBytes: 48 * 1024 * 1024 },
  hd: { width: 1280, height: 720, videoBps: 2_000_000, maxBytes: 180 * 1024 * 1024 },
} as const;

function pickMimeType(): string {
  const candidates = [
    "video/mp4",
    "video/webm;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function formatTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

type Phase = "initializing" | "ready" | "recording" | "preview" | "error";

export interface RecorderTrack {
  id: string;
  label: string | null;
  uploaderName: string;
}

interface Props {
  /** 녹화 확정 — 부모가 업로드를 이어받는다 */
  onRecorded: (file: File) => void;
  onClose: () => void;
  /** 카메라 사용 불가 시 기본 카메라 앱으로 폴백 */
  onFallback: () => void;
  /** 720p 녹화 (프리미엄 그룹) */
  hd?: boolean;
  /** 이 곡의 MR — 고르면 반주를 틀면서 녹음한다 (합주 연습용) */
  tracks?: RecorderTrack[];
}

/**
 * 인앱 녹화기 (전체화면 오버레이). 기본 480p, 프리미엄은 720p.
 * 촬영 단계에서 해상도/비트레이트를 제한해 압축 없이 작은 파일을 만든다.
 * 피아노 음질을 위해 노이즈 억제/자동 음량을 끈다.
 * MR을 고르면 Web Audio로 마이크+반주를 믹싱해 한 영상에 담는다.
 */
export function VideoRecorder({
  onRecorded,
  onClose,
  onFallback,
  hd = false,
  tracks = [],
}: Props) {
  const quality = hd ? QUALITY.hd : QUALITY.sd;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bytesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // MR 믹싱용 (MediaElementSource는 엘리먼트당 한 번만 만들 수 있어 ref로 보관)
  const mrElRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mrSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [phase, setPhase] = useState<Phase>("initializing");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [mrTrackId, setMrTrackId] = useState("");
  const [mrUrl, setMrUrl] = useState<string | null>(null);
  const [mrVolume, setMrVolume] = useState(0.7);
  const [mrError, setMrError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async (facingMode: "environment" | "user") => {
    stopStream();
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPhase("error");
      return;
    }
    setPhase("initializing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: quality.width },
          height: { ideal: quality.height },
          frameRate: { ideal: 30 },
        },
        // 피아노 소리가 뭉개지지 않도록 통화용 보정 기능을 끈다
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [stopStream, quality]);

  useEffect(() => {
    // 마이크로태스크로 미뤄 effect 본문에서의 동기 setState를 피한다 (react-hooks/set-state-in-effect)
    queueMicrotask(() => startStream(facing));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stop();
      stopStream();
      void audioCtxRef.current?.close();
    };
    // facing 변경은 flipCamera에서 직접 처리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (mrElRef.current) mrElRef.current.volume = mrVolume;
  }, [mrVolume, mrUrl]);

  const pickTrack = async (trackId: string) => {
    setMrError(null);
    setMrTrackId(trackId);
    if (!trackId) {
      setMrUrl(null);
      return;
    }
    const result = await getTrackUrl(trackId);
    if (!result.ok) {
      setMrError(result.error);
      setMrTrackId("");
      return;
    }
    setMrUrl(result.data.url);
  };

  const flipCamera = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    await startStream(next);
  };

  /** 마이크 + MR을 믹싱한 스트림 (MR 미선택이면 원본 그대로) */
  const buildRecordStream = async (stream: MediaStream): Promise<MediaStream> => {
    const el = mrElRef.current;
    if (!mrUrl || !el) return stream;
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      await ctx.resume();

      const dest = ctx.createMediaStreamDestination();
      const micSource = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      micSource.connect(dest);

      if (!mrSourceRef.current) {
        mrSourceRef.current = ctx.createMediaElementSource(el);
      }
      mrSourceRef.current.disconnect();
      mrSourceRef.current.connect(dest); // 녹음에 반주 포함
      mrSourceRef.current.connect(ctx.destination); // 내 귀에도 들리게

      return new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    } catch {
      setMrError("반주 믹싱에 실패했어요. 반주 없이 녹음해요.");
      return stream;
    }
  };

  const startRecording = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    const recordStream = await buildRecordStream(stream);
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(recordStream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: quality.videoBps,
      audioBitsPerSecond: AUDIO_BPS,
    });
    chunksRef.current = [];
    bytesRef.current = 0;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        bytesRef.current += e.data.size;
        // 기기가 비트레이트 지정을 무시해도 상한을 넘기 전에 자동 종료
        if (bytesRef.current >= quality.maxBytes && recorder.state === "recording") {
          recorder.stop();
        }
      }
    };
    recorder.onstop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mrElRef.current) mrElRef.current.pause();
      const type = recorder.mimeType || mimeType || "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type });
      const file = new File([blob], `recording-${Date.now()}.${ext}`, { type });
      setRecordedFile(file);
      setPreviewUrl(URL.createObjectURL(blob));
      stopStream();
      setPhase("preview");
    };

    recorderRef.current = recorder;
    recorder.start(1000); // 1초 단위 청크 → 용량 감시

    // 반주는 녹화 시작과 동시에 처음부터
    if (mrElRef.current && mrUrl) {
      mrElRef.current.currentTime = 0;
      void mrElRef.current.play().catch(() => setMrError("반주를 재생하지 못했어요."));
    }

    setElapsed(0);
    setPhase("recording");
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= MAX_SECONDS && recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
        return next;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const retake = async () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedFile(null);
    await startStream(facing);
  };

  const confirm = () => {
    if (recordedFile) onRecorded(recordedFile);
  };

  const trackLabel = (track: RecorderTrack) =>
    `${track.label ?? "MR"} (${track.uploaderName})`;

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* MR 재생용 (화면에는 보이지 않음) */}
      {mrUrl && (
        <audio ref={mrElRef} src={mrUrl} crossOrigin="anonymous" preload="auto" className="hidden" />
      )}

      {/* 상단 바 */}
      <div className="flex items-center justify-between p-4 text-white">
        <button type="button" onClick={onClose} className="text-2xl w-10 h-10" aria-label="닫기">
          ✕
        </button>
        {phase === "recording" ? (
          <span className="font-bold tabular-nums">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse mr-2" />
            {formatTime(elapsed)} / {formatTime(MAX_SECONDS)}
            {mrUrl && <span className="ml-2 text-xs text-violet-300">🎧 반주</span>}
          </span>
        ) : (
          <span className="text-sm text-white/70">
            최대 5분까지 찍을 수 있어요{hd && " · ✨720p"}
          </span>
        )}
        {phase === "ready" ? (
          <button type="button" onClick={flipCamera} className="text-2xl w-10 h-10" aria-label="카메라 전환">
            🔄
          </button>
        ) : (
          <span className="w-10" />
        )}
      </div>

      {/* 화면 영역 */}
      <div className="flex-1 relative overflow-hidden">
        {phase === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
            <div className="text-5xl">😢</div>
            <p className="font-bold">카메라를 켤 수 없어요</p>
            <p className="text-sm text-white/70">
              카메라 사용을 허용했는지 확인해 주세요.
              <br />
              아니면 폰의 기본 카메라로 찍어서 올릴 수도 있어요.
            </p>
            <button
              type="button"
              onClick={onFallback}
              className="h-12 px-6 rounded-xl bg-white text-gray-900 font-bold"
            >
              기본 카메라로 촬영하기
            </button>
          </div>
        ) : phase === "preview" && previewUrl ? (
          <video src={previewUrl} controls playsInline className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}
        {phase === "initializing" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* MR 선택 (촬영 전에만) */}
      {phase === "ready" && tracks.length > 0 && (
        <div className="px-5 pb-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white/80 shrink-0">🎧 반주</span>
            <select
              value={mrTrackId}
              onChange={(e) => pickTrack(e.target.value)}
              className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-white/10 text-white text-sm font-bold border border-white/20"
            >
              <option value="" className="text-gray-900">없이 녹음</option>
              {tracks.map((track) => (
                <option key={track.id} value={track.id} className="text-gray-900">
                  {trackLabel(track)}
                </option>
              ))}
            </select>
          </div>
          {mrUrl && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60 shrink-0">반주 크기</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={mrVolume}
                  onChange={(e) => setMrVolume(Number(e.target.value))}
                  className="flex-1 accent-violet-500"
                />
                <span className="text-xs text-white/60 w-8 text-right">
                  {Math.round(mrVolume * 100)}
                </span>
              </div>
              <p className="text-[11px] text-amber-300">
                🎧 이어폰을 끼면 반주와 내 연주가 깔끔하게 섞여요.
              </p>
            </>
          )}
          {mrError && <p className="text-[11px] text-red-400">{mrError}</p>}
        </div>
      )}

      {/* 하단 컨트롤 */}
      <div className="p-6 pb-10 flex items-center justify-center gap-4">
        {phase === "ready" && (
          <button
            type="button"
            onClick={startRecording}
            aria-label="녹화 시작"
            className="w-18 h-18 p-1 rounded-full border-4 border-white"
          >
            <span className="block w-full h-full rounded-full bg-red-500" />
          </button>
        )}
        {phase === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            aria-label="녹화 끝내기"
            className="w-18 h-18 p-1 rounded-full border-4 border-white flex items-center justify-center"
          >
            <span className="block w-8 h-8 rounded bg-red-500" />
          </button>
        )}
        {phase === "preview" && (
          <div className="w-full max-w-sm grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={retake}
              className="h-14 rounded-2xl bg-white/20 text-white font-bold"
            >
              ↺ 다시 찍기
            </button>
            <button
              type="button"
              onClick={confirm}
              className="h-14 rounded-2xl bg-violet-500 text-white font-bold"
            >
              이 영상 올리기 🍇
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
