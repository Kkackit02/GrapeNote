import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { buildReviewQueue } from "@/lib/review-queue";
import { ReviewGrid } from "@/components/ReviewGrid";

/** 파트장 검토함: 팀원들의 검토 대기 영상 (RLS가 팀원 것만 보여준다) */
export default async function LeaderReviewInboxPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: leading } = await supabase
    .from("teams")
    .select("id, name")
    .eq("leader_id", user!.id);
  if (!leading || leading.length === 0) redirect("/me");

  // 내 영상은 내가 검토할 수 없다
  const queue = await buildReviewQueue({ excludeStudentId: user!.id });
  const teamNames = leading.map((t) => t.name).join(", ");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/me" className="text-sm text-gray-400">← 내 카드 목록</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">⭐ 우리 팀 검토함</h1>
        <p className="mt-1 text-sm text-gray-500">
          {teamNames} 파트장으로서 팀원들의 연습 영상을 검토해 주세요.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          검토할 팀원 영상이 없어요. 모두 확인했네요! 🎉
        </div>
      ) : (
        <ReviewGrid items={queue} basePath="/me/review" memberLabel="팀원" />
      )}
    </div>
  );
}
