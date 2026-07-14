"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewSubmission } from "@/lib/actions/review";

interface Props {
  submissionId: string;
}

/** 합격/재연습 판정 + 코멘트 */
export function ReviewPanel({ submissionId }: Props) {
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
    router.push("/teacher/review");
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
