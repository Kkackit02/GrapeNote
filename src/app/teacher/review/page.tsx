import { buildReviewQueue } from "@/lib/review-queue";
import { ReviewGrid } from "@/components/ReviewGrid";

export default async function ReviewInboxPage() {
  const queue = await buildReviewQueue();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold text-violet-900">👀 검토함</h1>

      {queue.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          검토할 영상이 없어요. 모두 확인하셨네요! 🎉
        </div>
      ) : (
        <ReviewGrid items={queue} basePath="/teacher/review" memberLabel="학생" />
      )}
    </div>
  );
}
