import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ReviewPanel } from "@/components/ReviewPanel";
import type { Submission } from "@/lib/types";

interface SubRow extends Submission {
  progress_cards: { title: string; student_id: string } | null;
  profiles: { display_name: string } | null;
}

/** 파트장의 팀원 영상 검토 화면 */
export default async function LeaderReviewDetailPage({
  params,
}: {
  params: Promise<{ subId: string }>;
}) {
  const { subId } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: leading } = await supabase
    .from("teams")
    .select("id")
    .eq("leader_id", user!.id);
  if (!leading || leading.length === 0) redirect("/me");

  // RLS: 파트장은 팀원 제출만 조회된다. 자기 제출은 검토 불가.
  const { data } = await supabase
    .from("submissions")
    .select(
      "*, progress_cards(title, student_id), profiles!submissions_student_id_fkey(display_name)"
    )
    .eq("id", subId)
    .neq("student_id", user!.id)
    .maybeSingle();
  if (!data) notFound();
  const sub = data as unknown as SubRow;

  // 몰아보기: 다음 검토 대기 영상 (오래된 순, 현재 건과 내 것 제외)
  const { data: pendingQueue } = await supabase
    .from("submissions")
    .select("id")
    .eq("status", "pending")
    .neq("id", subId)
    .neq("student_id", user!.id)
    .order("created_at", { ascending: true })
    .limit(1);
  const { count: remaining } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .neq("id", subId)
    .neq("student_id", user!.id);
  const nextId = pendingQueue?.[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto w-full">
      <div>
        <Link href="/me/review" className="text-sm text-gray-400">← 우리 팀 검토함</Link>
        <h1 className="mt-2 text-xl font-extrabold text-violet-900">
          🎵 {sub.profiles?.display_name} — {sub.progress_cards?.title}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          포도알 #{sub.grape_index} ·{" "}
          {new Date(sub.created_at).toLocaleString("ko-KR", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {(sub.student_title || sub.student_comment) && (
        <div className="rounded-2xl bg-lime-50 border border-lime-200 p-3">
          {sub.student_title && (
            <p className="font-bold text-gray-800">🎬 {sub.student_title}</p>
          )}
          {sub.student_comment && (
            <p className="mt-1 text-sm text-gray-600">
              💬 친구의 한마디: {sub.student_comment}
            </p>
          )}
        </div>
      )}

      <VideoPlayer submissionId={sub.id} withRate />

      {sub.status === "pending" ? (
        <ReviewPanel
          submissionId={sub.id}
          nextSubmissionId={nextId}
          remaining={remaining ?? 0}
          basePath="/me/review"
          memberLabel="팀원"
        />
      ) : (
        <div
          className={`rounded-2xl p-4 ${
            sub.status === "approved"
              ? "bg-violet-50 border border-violet-200"
              : "bg-orange-50 border border-orange-200"
          }`}
        >
          <p className="font-bold">
            {sub.status === "approved" ? "🍇 합격 처리됨" : "↺ 재연습 처리됨"}
          </p>
          {sub.teacher_comment && (
            <p className="mt-1 text-sm text-gray-600">💬 {sub.teacher_comment}</p>
          )}
        </div>
      )}
    </div>
  );
}
