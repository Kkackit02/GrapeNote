import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deriveGrapes } from "@/lib/grapes";
import { calcStreak } from "@/lib/streaks";
import { calcBadges } from "@/lib/badges";
import { GrapeBunch } from "@/components/GrapeBunch";
import type { ProgressCard, Submission } from "@/lib/types";

/** 내 포도밭: 완성한 포도송이 갤러리 + 누적 통계 */
export default async function VineyardPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // 파트장은 팀원 것도 조회되므로 내 것만 명시적으로 필터
  const [{ data: cards }, { data: subs }] = await Promise.all([
    supabase
      .from("progress_cards")
      .select("*")
      .eq("student_id", user!.id)
      .order("completed_at", { ascending: false }),
    supabase.from("submissions").select("*").eq("student_id", user!.id),
  ]);
  const cardList = (cards ?? []) as ProgressCard[];
  const subList = (subs ?? []) as Submission[];

  const completed = cardList.filter((c) => c.completed_at);
  const totalApproved = subList.filter((s) => s.status === "approved").length;
  const totalVideos = subList.length;
  const streak = calcStreak(subList.map((s) => s.created_at));
  const badges = calcBadges(cardList, subList, streak);
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/me" className="text-sm text-gray-400">← 내 카드 목록</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">🍇 내 포도밭</h1>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-white border-2 border-violet-100 py-4">
          <p className="text-2xl font-extrabold text-violet-700">{totalApproved}</p>
          <p className="text-xs font-bold text-gray-500 mt-1">모은 포도알</p>
        </div>
        <div className="rounded-2xl bg-white border-2 border-violet-100 py-4">
          <p className="text-2xl font-extrabold text-violet-700">{completed.length}</p>
          <p className="text-xs font-bold text-gray-500 mt-1">완성 포도송이</p>
        </div>
        <div className="rounded-2xl bg-white border-2 border-violet-100 py-4">
          <p className="text-2xl font-extrabold text-violet-700">{totalVideos}</p>
          <p className="text-xs font-bold text-gray-500 mt-1">연습 영상</p>
        </div>
        <div className="rounded-2xl bg-white border-2 border-orange-100 py-4">
          <p className="text-2xl font-extrabold text-orange-600">🔥 {streak}</p>
          <p className="text-xs font-bold text-gray-500 mt-1">연속 연습일</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-extrabold text-violet-900">
          🎖 배지 <span className="text-sm text-gray-400 font-bold">{earnedCount}/{badges.length}</span>
        </h2>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {badges.map((badge) => (
            <li
              key={badge.id}
              className={`rounded-2xl border-2 p-3 flex items-center gap-3 ${
                badge.earned
                  ? "bg-white border-amber-200"
                  : "bg-gray-50 border-gray-100 opacity-55"
              }`}
            >
              <span className={`text-2xl ${badge.earned ? "" : "grayscale"}`}>{badge.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-800 truncate">{badge.name}</p>
                <p className="text-xs text-gray-400 truncate">{badge.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {completed.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          아직 완성한 포도송이가 없어요.
          <br />첫 포도송이를 완성하면 여기에 걸려요! 🍇
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {completed.map((card) => {
            const grapes = deriveGrapes(
              card.total_grapes,
              subList.filter((s) => s.card_id === card.id)
            );
            return (
              <li key={card.id}>
                <Link
                  href={`/me/cards/${card.id}`}
                  className="block rounded-2xl bg-white border-2 border-violet-100 p-3 text-center active:bg-violet-50"
                >
                  <GrapeBunch grapes={grapes} className="max-h-32 mx-auto" />
                  <p className="mt-2 text-sm font-extrabold text-gray-800 truncate">
                    🏆 {card.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {card.completed_at &&
                      new Date(card.completed_at).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}{" "}
                    완성
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
