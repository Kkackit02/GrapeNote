import Link from "next/link";
import { buildReviewQueue } from "@/lib/review-queue";
import { getTerms } from "@/lib/terms-server";
import { ReviewGrid } from "@/components/ReviewGrid";

export default async function ReviewInboxPage() {
  const queue = await buildReviewQueue();
  const terms = await getTerms();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">👀 검토함</h1>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          검토할 영상이 없어요. 모두 확인하셨네요! 🎉
        </div>
      ) : (
        <ReviewGrid items={queue} basePath="/teacher/review" memberLabel={terms.member} />
      )}
    </div>
  );
}
