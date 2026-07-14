"use client";

import { useEffect, useState } from "react";
import { getPlaybackUrl } from "@/lib/actions/uploads";

interface Props {
  submissionId: string;
  className?: string;
}

/** 서버 액션으로 signed URL을 받아 재생 (버킷은 private) */
export function VideoPlayer({ submissionId, className }: Props) {
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
  return (
    <video src={url} controls playsInline className={`w-full rounded-xl bg-black ${className ?? ""}`} />
  );
}
