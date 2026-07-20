"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { reviewSubmission } from "@/lib/actions/review";
import type { ReviewQueueItem } from "@/lib/review-queue";

const MODES = [1, 2, 4, 6] as const;
const RATES = [1, 1.5, 2] as const;
type Mode = (typeof MODES)[number];

const MODE_STORAGE_KEY = "grapenote-review-mode";

// 분할 모드별 그리드/폭 — 훑어보는 밀도를 검토자가 고른다
const MODE_LAYOUT: Record<Mode, { grid: string; width: string }> = {
  1: { grid: "grid-cols-1", width: "max-w-xl" },
  2: { grid: "grid-cols-1 sm:grid-cols-2", width: "max-w-4xl" },
  4: { grid: "grid-cols-1 sm:grid-cols-2", width: "max-w-5xl" },
  6: { grid: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", width: "max-w-7xl" },
};

interface Props {
  items: ReviewQueueItem[];
  /** 상세 페이지 경로 (선생님: /teacher/review, 파트장: /me/review) */
  basePath: string;
  /** 코멘트 대상 호칭 (선생님: 학생, 파트장: 팀원) */
  memberLabel?: string;
}

/**
 * 동시 재생 검토 그리드: 밀린 영상들을 음소거 상태로 한꺼번에 틀어놓고
 * 영상 길이·손 움직임으로 훑으면서 타일에서 바로 판정한다. 소리는 한 타일만.
 */
export function ReviewGrid({ items, basePath, memberLabel = "학생" }: Props) {
  const [queue, setQueue] = useState(items);
  const [mode, setMode] = useState<Mode>(2);
  const [rate, setRate] = useState(1);
  const [soundId, setSoundId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // SSR과 첫 클라이언트 렌더를 일치시키기 위해 저장된 분할 모드는 마운트 후에 복원한다
    queueMicrotask(() => {
      const stored = Number(localStorage.getItem(MODE_STORAGE_KEY));
      if ((MODES as readonly number[]).includes(stored)) setMode(stored as Mode);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const pickMode = (m: Mode) => {
    setMode(m);
    localStorage.setItem(MODE_STORAGE_KEY, String(m));
  };

  const handleJudged = (id: string, completedMessage: string | null) => {
    setQueue((q) => q.filter((item) => item.id !== id));
    setSoundId((current) => (current === id ? null : current));
    if (completedMessage) setToast(completedMessage);
  };

  if (queue.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
        모두 확인했어요! 🎉
      </div>
    );
  }

  const visible = queue.slice(0, mode);
  const layout = MODE_LAYOUT[mode];

  return (
    // 부모 max-width를 벗어나 화면 전체 폭 사용 (full-bleed) — 4·6분할에서 필요
    <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen px-4">
      <div className={`mx-auto ${layout.width} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-gray-600">👀 대기 {queue.length}개</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-0.5">분할</span>
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => pickMode(m)}
                  className={`w-8 h-8 rounded-lg text-sm font-bold ${
                    mode === m ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-600"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRate(r)}
                  className={`px-2 h-8 rounded-lg text-xs font-bold ${
                    rate === r ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-600"
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`grid gap-3 ${layout.grid}`}>
          {visible.map((item) => (
            <ReviewTile
              key={item.id}
              item={item}
              rate={rate}
              basePath={basePath}
              memberLabel={memberLabel}
              soundOn={soundId === item.id}
              onToggleSound={() =>
                setSoundId(soundId === item.id ? null : item.id)
              }
              onJudged={handleJudged}
            />
          ))}
        </div>

        {queue.length > visible.length && (
          <p className="text-center text-xs text-gray-400">
            판정하면 다음 영상이 이어서 나와요 · 대기 {queue.length - visible.length}개 더
          </p>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-violet-700 text-white text-sm font-bold px-5 py-2.5 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function formatSubmittedAt(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface TileProps {
  item: ReviewQueueItem;
  rate: number;
  basePath: string;
  memberLabel: string;
  soundOn: boolean;
  onToggleSound: () => void;
  onJudged: (id: string, completedMessage: string | null) => void;
}

function ReviewTile({ item, rate, basePath, memberLabel, soundOn, onToggleSound, onJudged }: TileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  const [retryOpen, setRetryOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  const judge = async (verdict: "approved" | "needs_retry") => {
    const trimmed = comment.trim();
    if (verdict === "needs_retry" && !trimmed) {
      setError("재연습에는 코멘트를 남겨 주세요.");
      return;
    }
    setError(null);
    setBusy(true);
    const result = await reviewSubmission({ submissionId: item.id, verdict, comment: trimmed });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onJudged(
      item.id,
      result.data.cardCompleted
        ? `🍇 ${item.studentName}의 「${item.songTitle}」 포도송이 완성!`
        : null
    );
  };

  const replay = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      void video.play();
    }
  };

  const note = [
    item.studentTitle && `🎬 ${item.studentTitle}`,
    item.studentComment && `💬 ${item.studentComment}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-2xl bg-white border border-violet-100 overflow-hidden flex flex-col">
      <div className="px-3 pt-2.5 pb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-gray-800 text-sm truncate">
            🎹 {item.studentName} — {item.songTitle}
          </p>
          <p className="text-xs text-gray-400" suppressHydrationWarning>
            포도알 #{item.grapeIndex} · {formatSubmittedAt(item.createdAt)}
            {duration != null && <> · ⏱ {formatDuration(duration)}</>}
          </p>
        </div>
        <Link href={`${basePath}/${item.id}`} className="shrink-0 text-xs font-bold text-violet-500">
          크게 →
        </Link>
      </div>

      {note && (
        <p className="px-3 pb-1.5 text-xs text-gray-600 truncate" title={note}>
          {note}
        </p>
      )}

      <div className="relative bg-black aspect-video">
        {item.url ? (
          <>
            <video
              ref={(el) => {
                videoRef.current = el;
                if (el) {
                  // muted 속성이 로드 전에 확실히 걸려야 자동 재생이 허용된다
                  el.defaultMuted = true;
                  el.playbackRate = rate;
                }
              }}
              src={item.url}
              autoPlay
              muted={!soundOn}
              playsInline
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onEnded={() => setEnded(true)}
              onPlay={() => setEnded(false)}
              className="w-full h-full object-contain"
            />
            <button
              type="button"
              onClick={onToggleSound}
              className={`absolute bottom-2 right-2 w-9 h-9 rounded-full text-base flex items-center justify-center ${
                soundOn ? "bg-violet-600" : "bg-black/50"
              }`}
              aria-label={soundOn ? "소리 끄기" : "소리 켜기"}
            >
              {soundOn ? "🔊" : "🔇"}
            </button>
            {ended && (
              <button
                type="button"
                onClick={replay}
                className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold text-sm"
              >
                ↻ 다시 보기
              </button>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
            영상을 불러올 수 없어요
          </div>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-2">
        {error && <p className="text-xs text-red-500">{error}</p>}
        {retryOpen ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`${memberLabel}에게 남길 코멘트 (필수)`}
              rows={2}
              autoFocus
              className="w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setRetryOpen(false);
                  setError(null);
                }}
                className="py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold disabled:opacity-50 active:bg-gray-200"
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => judge("needs_retry")}
                className="py-2 rounded-xl bg-orange-500 text-white text-sm font-bold disabled:opacity-50 active:bg-orange-600"
              >
                ↺ 재연습 보내기
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setRetryOpen(true)}
              className="py-2 rounded-xl bg-orange-100 text-orange-700 text-sm font-bold disabled:opacity-50 active:bg-orange-200"
            >
              ↺ 재연습
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => judge("approved")}
              className="py-2 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50 active:bg-violet-800"
            >
              🍇 합격!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
