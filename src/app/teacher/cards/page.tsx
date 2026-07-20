import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getTerms } from "@/lib/terms-server";
import { deriveGrapes, approvedCount } from "@/lib/grapes";
import { HomeworkTable, type HomeworkRow } from "@/components/HomeworkTable";
import type { ProgressCard, Profile, Submission } from "@/lib/types";

/** 숙제(진도카드) 관리: 곡×멤버 배정 현황을 표로 보고 그 자리에서 수정·삭제한다 */
export default async function HomeworkAdminPage() {
  const supabase = await createSupabaseServer();
  const terms = await getTerms();

  const [{ data: cards }, { data: students }, { data: subs }] = await Promise.all([
    supabase.from("progress_cards").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("role", "student"),
    supabase.from("submissions").select("*"),
  ]);

  const cardList = (cards ?? []) as ProgressCard[];
  const nameOf = new Map(
    ((students ?? []) as Profile[]).map((p) => [p.id, p.display_name])
  );
  const subList = (subs ?? []) as Submission[];

  const rows: HomeworkRow[] = cardList.map((card) => {
    const cardSubs = subList.filter((sub) => sub.card_id === card.id);
    const grapes = deriveGrapes(card.total_grapes, cardSubs);
    return {
      id: card.id,
      title: card.title,
      studentId: card.student_id,
      studentName: nameOf.get(card.student_id) ?? "?",
      description: card.description,
      done: approvedCount(grapes),
      totalGrapes: card.total_grapes,
      pending: grapes.filter((g) => g.status === "pending").length,
      retry: grapes.filter((g) => g.status === "retry").length,
      dueDate: card.due_date,
      completedAt: card.completed_at,
      createdAt: card.created_at,
      selfAdded: card.created_by === card.student_id,
    };
  });

  const active = rows.filter((row) => !row.completedAt).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold text-violet-900">📋 숙제 관리</h1>
          <Link
            href="/teacher/cards/new"
            className="shrink-0 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold active:bg-violet-800"
          >
            + 새 숙제
          </Link>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          전체 {rows.length}개 · 진행 중 {active}개 — ✏️로 곡명·미션·포도알·기한을 고쳐요.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          아직 배정한 숙제가 없어요.
          <br />
          <Link href="/teacher/songs/new" className="font-bold text-violet-700 underline">
            곡 만들기
          </Link>
          로 시작해 보세요!
        </div>
      ) : (
        // 데스크톱에서 넓게: 부모 max-width를 벗어나 화면 전체 폭 사용 (full-bleed)
        <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen px-4">
          <div className="mx-auto max-w-5xl">
            <HomeworkTable rows={rows} memberLabel={terms.member} />
          </div>
        </div>
      )}
    </div>
  );
}
