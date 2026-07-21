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

  // MR 믹싱: <audio> 엘리먼트 대신 디코딩한 버퍼를 쓴다.
  // (엘리먼트는 자동재생 정책·라우팅 문제로 소리가 안 나는 기기가 있다)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mrBufferRef = useRef<AudioBuffer | null>(null);
  const mrNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const mrGainRef = useRef<GainNode | null>(null);

  // 메트로놈: lookahead 스케줄러로 정확한 박자 클릭 (녹음 스트림에도 함께 싣는다)
  const metroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextClickRef = useRef(0);
  const beatRef = useRef(0);
  const bpmRef = useRef(90);
  const recordDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const [phase, setPhase] = useState<Phase>("initializing");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [mrTrackId, setMrTrackId] = useState("");
  const [mrReady, setMrReady] = useState(false);
  const [mrLoading, setMrLoading] = useState(false);
  const [mrPreviewing, setMrPreviewing] = useState(false);
  const [mrVolume, setMrVolume] = useState(0.7);
  const [mrError, setMrError] = useState<string | null>(null);
  const [bpm, setBpm] = useState(90);
  const [metroOn, setMetroOn] = useState(false);

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
      if (metroTimerRef.current) clearInterval(metroTimerRef.current);
      recorderRef.current?.stop();
      stopStream();
      try {
        mrNodeRef.current?.stop();
      } catch {
        // 이미 멈춤
      }
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

  // 볼륨은 게인 노드로 (재생 중에도 즉시 반영)
  useEffect(() => {
    if (mrGainRef.current) mrGainRef.current.gain.value = mrVolume;
  }, [mrVolume]);

  /** 사용자 제스처 안에서 AudioContext를 만들어 둔다 (모바일 자동재생 정책) */
  const ensureCtx = (): AudioContext => {
    const ctx =
      audioCtxRef.current ??
      new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioCtxRef.current = ctx;
    void ctx.resume();
    if (!mrGainRef.current) {
      mrGainRef.current = ctx.createGain();
      mrGainRef.current.gain.value = mrVolume;
    }
    return ctx;
  };

  const stopMr = () => {
    try {
      mrNodeRef.current?.stop();
    } catch {
      // 이미 멈춘 경우
    }
    mrNodeRef.current = null;
    setMrPreviewing(false);
  };

  /** 반주 재생 시작 — connectTo가 있으면 녹음 스트림에도 함께 보낸다 */
  const playMr = (connectTo?: AudioNode) => {
    const ctx = audioCtxRef.current;
    const buffer = mrBufferRef.current;
    const gain = mrGainRef.current;
    if (!ctx || !buffer || !gain) return;
    stopMr();
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(gain);
    gain.disconnect();
    gain.connect(ctx.destination); // 내 귀로
    if (connectTo) gain.connect(connectTo); // 녹음에도
    node.onended = () => setMrPreviewing(false);
    node.start();
    mrNodeRef.current = node;
  };

  const pickTrack = async (trackId: string) => {
    setMrError(null);
    setMrTrackId(trackId);
    stopMr();
    mrBufferRef.current = null;
    setMrReady(false);
    if (!trackId) return;

    // 선택은 사용자 제스처 — 여기서 오디오 컨텍스트를 깨워 둔다
    const ctx = ensureCtx();
    setMrLoading(true);
    try {
      const result = await getTrackUrl(trackId);
      if (!result.ok) throw new Error(result.error);
      const res = await fetch(result.data.url);
      if (!res.ok) throw new Error("반주를 내려받지 못했어요.");
      mrBufferRef.current = await ctx.decodeAudioData(await res.arrayBuffer());
      setMrReady(true);
    } catch (e) {
      setMrError(e instanceof Error ? e.message : "반주를 불러오지 못했어요.");
      setMrTrackId("");
    } finally {
      setMrLoading(false);
    }
  };

  const togglePreview = () => {
    if (mrPreviewing) {
      stopMr();
      return;
    }
    ensureCtx();
    playMr();
    setMrPreviewing(true);
  };

  /** 클릭 한 번을 정확한 시각에 예약한다 (스피커 + 녹음 중이면 녹음에도) */
  const scheduleClick = (time: number, accent: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000; // 첫 박은 높게
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.5, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (recordDestRef.current) gain.connect(recordDestRef.current);
    osc.start(time);
    osc.stop(time + 0.06);
  };

  /** 25ms마다 앞으로 0.12초치 클릭을 미리 예약 (setInterval 지터를 흡수) */
  const metroTick = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    while (nextClickRef.current < ctx.currentTime + 0.12) {
      scheduleClick(nextClickRef.current, beatRef.current % 4 === 0);
      nextClickRef.current += 60 / bpmRef.current;
      beatRef.current += 1;
    }
  };

  const startMetro = () => {
    const ctx = ensureCtx();
    beatRef.current = 0;
    nextClickRef.current = ctx.currentTime + 0.1;
    if (metroTimerRef.current) clearInterval(metroTimerRef.current);
    metroTimerRef.current = setInterval(metroTick, 25);
    setMetroOn(true);
  };

  const stopMetro = () => {
    if (metroTimerRef.current) clearInterval(metroTimerRef.current);
    metroTimerRef.current = null;
    setMetroOn(false);
  };

  const toggleMetro = () => (metroOn ? stopMetro() : startMetro());

  const changeBpm = (next: number) => {
    const clamped = Math.max(40, Math.min(240, next));
    bpmRef.current = clamped;
    setBpm(clamped);
  };

  const flipCamera = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    await startStream(next);
  };

  /** 마이크 + (MR·메트로놈)을 믹싱한 스트림. 둘 다 없으면 원본 그대로. */
  const buildRecordStream = (stream: MediaStream): MediaStream => {
    const withMr = mrReady && !!mrBufferRef.current;
    if (!withMr && !metroOn) return stream;
    try {
      const ctx = ensureCtx();
      const dest = ctx.createMediaStreamDestination();
      const micSource = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      micSource.connect(dest);
      if (withMr) playMr(dest); // 반주를 스피커 + 녹음 스트림 양쪽으로
      recordDestRef.current = dest; // 메트로놈 클릭도 녹음에 실린다
      return new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    } catch {
      setMrError("반주 믹싱에 실패했어요. 반주 없이 녹음해요.");
      return stream;
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    stopMr(); // 미리듣기 중이었다면 정리
    // 사용자 제스처를 잃지 않도록 await 없이 동기적으로 처리한다
    const recordStream = buildRecordStream(stream);
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
      stopMr();
      stopMetro();
      recordDestRef.current = null;
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

  const trackLabel = (track: RecorderTrack) =>
    `${track.label ?? "MR"} (${track.uploaderName})`;

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
            {mrReady && <span className="ml-2 text-xs text-violet-300">🎧 반주</span>}
            {metroOn && <span className="ml-2 text-xs text-violet-300">🥁 {bpm}</span>}
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
          {mrLoading && <p className="text-[11px] text-white/60">반주를 불러오는 중...</p>}
          {mrReady && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePreview}
                  className={`shrink-0 px-3 h-9 rounded-xl text-xs font-bold ${
                    mrPreviewing ? "bg-violet-500 text-white" : "bg-white/15 text-white"
                  }`}
                >
                  {mrPreviewing ? "■ 정지" : "▶ 미리듣기"}
                </button>
                <span className="text-xs text-white/60 shrink-0">크기</span>
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
                🎧 이어폰을 끼면 반주와 내 연주가 깔끔하게 섞여요. 미리듣기로 소리를 먼저 확인해 보세요.
              </p>
            </>
          )}
          {mrError && <p className="text-[11px] text-red-400">{mrError}</p>}
        </div>
      )}

      {/* 메트로놈 (촬영 전에만 켜고 BPM 조절) */}
      {phase === "ready" && (
        <div className="px-5 pb-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMetro}
              className={`shrink-0 px-3 h-10 rounded-xl text-sm font-bold ${
                metroOn ? "bg-violet-500 text-white" : "bg-white/15 text-white"
              }`}
            >
              🥁 메트로놈 {metroOn ? "켜짐" : "꺼짐"}
            </button>
            <button
              type="button"
              onClick={() => changeBpm(bpm - 5)}
              className="w-9 h-10 rounded-xl bg-white/10 text-white text-lg font-bold"
              aria-label="BPM 낮추기"
            >
              −
            </button>
            <span className="w-16 text-center text-white font-bold tabular-nums">{bpm} BPM</span>
            <button
              type="button"
              onClick={() => changeBpm(bpm + 5)}
              className="w-9 h-10 rounded-xl bg-white/10 text-white text-lg font-bold"
              aria-label="BPM 높이기"
            >
              +
            </button>
          </div>
          <input
            type="range"
            min={40}
            max={240}
            step={1}
            value={bpm}
            onChange={(e) => changeBpm(Number(e.target.value))}
            className="w-full accent-violet-500"
          />
          {metroOn && (
            <p className="text-[11px] text-amber-300">
              🎧 이어폰을 끼면 클릭이 내 연주에 겹쳐 들리지 않아요. 녹화 내내 박자가 함께 녹음돼요.
            </p>
          )}
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
