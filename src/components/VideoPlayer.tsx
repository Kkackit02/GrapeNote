"use client";

import { useEffect, useRef, useState } from "react";
import { getPlaybackUrl } from "@/lib/actions/uploads";

const RATES = [1, 1.5, 2];

interface Props {
  submissionId: string;
  className?: string;
  /** 배속 버튼 표시 (선생님 검토용) */
  withRate?: boolean;
}

/** 서버 액션으로 signed URL을 받아 재생 (버킷은 private) */
export function VideoPlayer({ submissionId, className, withRate }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rate, setRate] = useState(1);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPlaybackUrl(submissionId).then((result) => {
      if (cancelled) return;
      if (result.ok) setUrl(result.data.url);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  if (error) return <p className="text-sm text-red-500 py-4 text-center">{error}</p>;
  if (!url) {
    return (
      <div className={`aspect-video bg-gray-100 rounded-xl flex items-center justify-center ${className ?? ""}`}>
        <div className="w-8 h-8 border-4 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }
  const applyRate = (r: number) => {
    setRate(r);
    if (videoRef.current) videoRef.current.playbackRate = r;
  };

  return (
    <div className={className}>
      <video
        ref={videoRef}
        src={url}
        controls
        playsInline
        onLoadedMetadata={() => {
          if (videoRef.current) videoRef.current.playbackRate = rate;
        }}
        className="w-full rounded-xl bg-black"
      />
      {withRate && (
        <div className="mt-2 flex gap-1.5 justify-end">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => applyRate(r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                rate === r ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-600"
              }`}
            >
              {r}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
