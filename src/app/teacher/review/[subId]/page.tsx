import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getTerms } from "@/lib/terms-server";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ReviewPanel } from "@/components/ReviewPanel";
import type { Submission } from "@/lib/types";

interface SubRow extends Submission {
  progress_cards: { title: string; student_id: string } | null;
  profiles: { display_name: string } | null;
}

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ subId: string }>;
}) {
  const { subId } = await params;
  const supabase = await createSupabaseServer();
  const terms = await getTerms();

  const { data } = await supabase
    .from("submissions")
    .select(
      "*, progress_cards(title, student_id), profiles!submissions_student_id_fkey(display_name)"
    )
    .eq("id", subId)
    .maybeSingle();
  if (!data) notFound();
  const sub = data as unknown as SubRow;

  // 몰아보기: 다음 검토 대기 영상 (오래된 순, 현재 건 제외)
  const { data: pendingQueue } = await supabase
    .from("submissions")
    .select("id")
    .eq("status", "pending")
    .neq("id", subId)
    .order("created_at", { ascending: true })
    .limit(1);
  const { count: remaining } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .neq("id", subId);
  const nextId = pendingQueue?.[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto w-full">
      <div>
        <Link href="/teacher/review" className="text-sm text-gray-400">← 검토함</Link>
        <h1 className="mt-2 text-xl font-extrabold text-violet-900">
          🎵 {sub.profiles?.display_name} — {sub.progress_cards?.title}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          포도알 #{sub.grape_index} ·{" "}
          {new Date(sub.created_at).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
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
              💬 {terms.member}의 한마디: {sub.student_comment}
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
          memberLabel={terms.member}
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
