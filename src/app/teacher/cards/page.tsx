import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HomeworkAdminItem } from "@/components/HomeworkAdminItem";
import type { ProgressCard, Profile, Submission } from "@/lib/types";

/** 숙제(진도카드) 관리 패널: 내가 어떤 숙제를 줬는지 한눈에 보고 수정/삭제한다 */
export default async function HomeworkAdminPage() {
  const supabase = await createSupabaseServer();

  const [{ data: cards }, { data: students }, { data: subs }] = await Promise.all([
    supabase.from("progress_cards").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("role", "student").order("display_name"),
    supabase.from("submissions").select("*").eq("status", "approved"),
  ]);

  const cardList = (cards ?? []) as ProgressCard[];
  const studentList = (students ?? []) as Profile[];
  const approvedByCard = new Map<string, number>();
  for (const sub of (subs ?? []) as Submission[]) {
    approvedByCard.set(sub.card_id, (approvedByCard.get(sub.card_id) ?? 0) + 1);
  }

  const active = cardList.filter((c) => !c.completed_at).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-violet-900">📋 숙제 관리</h1>
          <Link
            href="/teacher/cards/new"
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold active:bg-violet-800"
          >
            + 새 숙제 배정
          </Link>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          전체 {cardList.length}개 · 진행 중 {active}개 — 제목·지시사항·포도알·기한을 고칠 수 있어요.
        </p>
      </div>

      {cardList.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          아직 배정한 숙제가 없어요.
          <br />
          <Link href="/teacher/cards/new" className="font-bold text-violet-700 underline">
            첫 숙제를 배정
          </Link>
          해 보세요!
        </div>
      ) : (
        studentList
          .filter((student) => cardList.some((c) => c.student_id === student.id))
          .map((student) => (
            <section key={student.id}>
              <h2 className="text-lg font-bold text-gray-700">
                🎹 {student.display_name}
                {student.username && (
                  <span className="ml-1.5 text-sm font-medium text-gray-400">@{student.username}</span>
                )}
              </h2>
              <ul className="mt-2 grid gap-2">
                {cardList
                  .filter((c) => c.student_id === student.id)
                  .map((card) => (
                    <li key={card.id}>
                      <HomeworkAdminItem
                        card={card}
                        studentName={student.display_name}
                        done={approvedByCard.get(card.id) ?? 0}
                        selfAdded={card.created_by === card.student_id}
                      />
                    </li>
                  ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}
