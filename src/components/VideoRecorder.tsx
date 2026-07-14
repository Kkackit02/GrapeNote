"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SECONDS = 300; // 최대 5분
const MAX_BYTES = 48 * 1024 * 1024; // 버킷 50MB 제한보다 여유 있게 자동 종료
const VIDEO_BPS = 1_000_000; // 480p 기준 ~1Mbps → 5분에 약 42MB
const AUDIO_BPS = 128_000;

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

interface Props {
  /** 녹화 확정 — 부모가 업로드를 이어받는다 */
  onRecorded: (file: File) => void;
  onClose: () => void;
  /** 카메라 사용 불가 시 기본 카메라 앱으로 폴백 */
  onFallback: () => void;
}

/**
 * 인앱 480p 녹화기 (전체화면 오버레이).
 * 촬영 단계에서 해상도/비트레이트를 제한해 압축 없이 작은 파일을 만든다.
 * 피아노 음질을 위해 노이즈 억제/자동 음량을 끈다.
 */
export function VideoRecorder({ onRecorded, onClose, onFallback }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bytesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<Phase>("initializing");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);

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
          width: { ideal: 854 },
          height: { ideal: 480 },
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
  }, [stopStream]);

  useEffect(() => {
    // 마이크로태스크로 미뤄 effect 본문에서의 동기 setState를 피한다 (react-hooks/set-state-in-effect)
    queueMicrotask(() => startStream(facing));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stop();
      stopStream();
    };
    // facing 변경은 flipCamera에서 직접 처리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const flipCamera = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    await startStream(next);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: VIDEO_BPS,
      audioBitsPerSecond: AUDIO_BPS,
    });
    chunksRef.current = [];
    bytesRef.current = 0;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        bytesRef.current += e.data.size;
        // 기기가 비트레이트 지정을 무시해도 50MB를 넘기 전에 자동 종료
        if (bytesRef.current >= MAX_BYTES && recorder.state === "recording") {
          recorder.stop();
        }
      }
    };
    recorder.onstop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
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

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* 상단 바 */}
      <div className="flex items-center justify-between p-4 text-white">
        <button type="button" onClick={onClose} className="text-2xl w-10 h-10" aria-label="닫기">
          ✕
        </button>
        {phase === "recording" ? (
          <span className="font-bold tabular-nums">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse mr-2" />
            {formatTime(elapsed)} / {formatTime(MAX_SECONDS)}
          </span>
        ) : (
          <span className="text-sm text-white/70">최대 5분까지 찍을 수 있어요</span>
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
