import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deriveGrapes, approvedCount } from "@/lib/grapes";
import { NewCardForm } from "@/components/NewCardForm";
import { StudentAdminPanel } from "@/components/StudentAdminPanel";
import type { ProgressCard, Profile, Submission } from "@/lib/types";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: student } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "student")
    .maybeSingle();
  if (!student) notFound();
  const profile = student as Profile;

  const { data: cards } = await supabase
    .from("progress_cards")
    .select("*")
    .eq("student_id", id)
    .order("created_at", { ascending: false });
  const cardList = (cards ?? []) as ProgressCard[];

  const { data: subs } = await supabase
    .from("submissions")
    .select("*")
    .in("card_id", cardList.map((c) => c.id));
  const subList = (subs ?? []) as Submission[];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 학생 목록</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">
          🎹 {profile.display_name}
          {profile.username && (
            <span className="ml-2 text-sm font-medium text-gray-400">@{profile.username}</span>
          )}
        </h1>
      </div>

      <NewCardForm studentId={id} />

      {cardList.length === 0 ? (
        <p className="text-center text-gray-500 py-6">아직 배정된 진도카드가 없어요.</p>
      ) : (
        <ul className="grid gap-2">
          {cardList.map((card) => {
            const grapes = deriveGrapes(
              card.total_grapes,
              subList.filter((s) => s.card_id === card.id)
            );
            const done = approvedCount(grapes);
            const hasPending = grapes.some((g) => g.status === "pending");
            return (
              <li key={card.id}>
                <Link
                  href={`/teacher/cards/${card.id}`}
                  className="rounded-2xl bg-white border border-violet-100 p-4 flex items-center justify-between active:bg-violet-50"
                >
                  <div>
                    <p className="font-bold text-gray-800">
                      {card.completed_at ? "🏆 " : ""}
                      {card.title}
                      {hasPending && (
                        <span className="ml-2 text-xs font-bold text-lime-700 bg-lime-100 px-2 py-0.5 rounded-full">
                          검토 대기
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      🍇 {done} / {card.total_grapes}알
                    </p>
                  </div>
                  <span className="text-gray-300">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <StudentAdminPanel studentId={id} displayName={profile.display_name} />
    </div>
  );
}
