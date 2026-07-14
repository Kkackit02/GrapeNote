"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewSubmission } from "@/lib/actions/review";

interface Props {
  submissionId: string;
  /** 판정 후 이어서 검토할 다음 영상 (몰아보기) */
  nextSubmissionId?: string | null;
  /** 이 건을 제외한 검토 대기 수 */
  remaining?: number;
  /** 검토함 경로 (선생님: /teacher/review, 파트장: /me/review) */
  basePath?: string;
}

/** 합격/재연습 판정 + 코멘트 */
export function ReviewPanel({
  submissionId,
  nextSubmissionId,
  remaining = 0,
  basePath = "/teacher/review",
}: Props) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (verdict: "approved" | "needs_retry") => {
    setError(null);
    setSubmitting(true);
    const result = await reviewSubmission({ submissionId, verdict, comment });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // 몰아보기: 다음 대기 영상으로 바로 이동
    router.push(nextSubmissionId ? `${basePath}/${nextSubmissionId}` : basePath);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="학생에게 남길 코멘트 (재연습 시 필수)"
        rows={3}
        className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      {remaining > 0 && (
        <p className="text-xs text-gray-400 text-center">
          판정하면 다음 영상으로 넘어가요 · 대기 {remaining}개 남음
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={() => submit("needs_retry")}
          className="h-13 py-3 rounded-xl bg-orange-100 text-orange-700 font-bold disabled:opacity-50 active:bg-orange-200"
        >
          ↺ 재연습
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => submit("approved")}
          className="h-13 py-3 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
        >
          🍇 합격!
        </button>
      </div>
    </div>
  );
}
