import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deriveGrapes, approvedCount } from "@/lib/grapes";
import { dueBadge } from "@/lib/due";
import { AddMyCardForm } from "@/components/AddMyCardForm";
import type { ProgressCard, Profile, Submission, Team } from "@/lib/types";

export default async function MyCardsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profileRow }, { data: cards }, { data: subs }, { data: leadingTeams }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("progress_cards").select("*").order("created_at", { ascending: false }),
    supabase.from("submissions").select("*"),
    supabase.from("teams").select("*").eq("leader_id", user!.id),
  ]);

  const profile = profileRow as Profile;
  const allCards = (cards ?? []) as ProgressCard[];
  const subList = (subs ?? []) as Submission[];
  const myCards = allCards.filter((c) => c.student_id === user!.id); // 파트장은 팀원 카드도 조회되므로 내 것만
  const cardList = myCards.filter((c) => !c.completed_at); // 진행 중만 (완성작은 포도밭에)
  const completedCount = myCards.length - cardList.length;
  const totalApproved = subList.filter(
    (s) => s.student_id === user!.id && s.status === "approved"
  ).length;

  // 파트장이면 팀원들의 검토 대기 영상 수 (RLS로 팀원 것까지 조회됨, 내 것 제외)
  const isLeader = ((leadingTeams ?? []) as Team[]).length > 0;
  const teamPending = isLeader
    ? subList.filter((s) => s.status === "pending" && s.student_id !== user!.id).length
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-extrabold text-violet-900">
        {profile.display_name} 님, 안녕하세요! 👋
      </h1>

      {isLeader && (
        <Link
          href="/me/review"
          className="rounded-2xl bg-amber-50 border border-amber-300 p-4 flex items-center justify-between active:bg-amber-100"
        >
          <span className="font-bold text-amber-900">
            ⭐ 파트장이에요!{" "}
            {teamPending > 0
              ? `팀원 영상 ${teamPending}개가 검토를 기다려요`
              : "검토할 팀원 영상이 없어요"}
          </span>
          <span className="text-amber-700 font-bold text-sm shrink-0">검토함 →</span>
        </Link>
      )}

      <Link
        href="/me/vineyard"
        className="rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white p-4 flex items-center justify-between active:opacity-90"
      >
        <div>
          <p className="font-extrabold">🍇 지금까지 포도알 {totalApproved}개!</p>
          <p className="text-sm text-violet-100 mt-0.5">완성한 포도송이 {completedCount}개</p>
        </div>
        <span className="font-bold text-sm">내 포도밭 →</span>
      </Link>

      {cardList.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          {completedCount > 0 ? (
            <>
              진행 중인 카드를 전부 끝냈어요! 🎉
              <br />
              선생님이 곧 새 카드를 만들어 주실 거예요.
            </>
          ) : (
            <>
              아직 진도카드가 없어요.
              <br />
              선생님이 곧 카드를 만들어 주실 거예요! 🎹
            </>
          )}
        </div>
      ) : (
        <ul className="grid gap-3">
          {cardList.map((card) => {
            const grapes = deriveGrapes(
              card.total_grapes,
              subList.filter((s) => s.card_id === card.id)
            );
            const done = approvedCount(grapes);
            const percent = Math.round((done / card.total_grapes) * 100);
            const waiting = grapes.some((g) => g.status === "pending");
            const retry = grapes.some((g) => g.status === "retry");
            const due = dueBadge(card.due_date);
            return (
              <li key={card.id}>
                <Link
                  href={`/me/cards/${card.id}`}
                  className="block rounded-2xl bg-white border-2 border-violet-100 p-4 active:bg-violet-50"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold text-gray-800 text-lg">
                      {card.completed_at ? "🏆 " : "🎵 "}
                      {card.title}
                    </p>
                    {retry && (
                      <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                        ↺ 다시 도전!
                      </span>
                    )}
                    {!retry && waiting && (
                      <span className="text-xs font-bold text-lime-700 bg-lime-100 px-2 py-1 rounded-full">
                        👀 검토 중
                      </span>
                    )}
                  </div>
                  {(due || card.created_by === card.student_id) && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {card.created_by === card.student_id && (
                        <span className="text-xs font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                          🙋 내가 고른 곡
                        </span>
                      )}
                      {due && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${due.className}`}>
                          {due.text}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-3 h-3 rounded-full bg-violet-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-600 transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-violet-600">
                    🍇 {done} / {card.total_grapes}알
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <AddMyCardForm />
    </div>
  );
}
