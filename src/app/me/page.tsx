import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deriveGrapes, approvedCount } from "@/lib/grapes";
import type { ProgressCard, Profile, Submission } from "@/lib/types";

export default async function MyCardsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profileRow }, { data: cards }, { data: subs }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("progress_cards").select("*").order("created_at", { ascending: false }),
    supabase.from("submissions").select("*"),
  ]);

  const profile = profileRow as Profile;
  const cardList = (cards ?? []) as ProgressCard[];
  const subList = (subs ?? []) as Submission[];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-extrabold text-violet-900">
        {profile.display_name} 님, 안녕하세요! 👋
      </h1>

      {cardList.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          아직 진도카드가 없어요.
          <br />
          선생님이 곧 카드를 만들어 주실 거예요! 🎹
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
    </div>
  );
}
