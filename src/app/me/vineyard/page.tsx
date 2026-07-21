import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deriveGrapes } from "@/lib/grapes";
import { calcStreak } from "@/lib/streaks";
import { calcTitleStats, getTitle } from "@/lib/titles";
import { GrapeBunch } from "@/components/GrapeBunch";
import { SkinPicker } from "@/components/SkinPicker";
import { TitlePicker } from "@/components/TitlePicker";
import { getSkin, unlockedSkinIds, tallyGrapesByInstrument, type SkinStats } from "@/lib/skins";
import type { ProgressCard, Profile, Submission } from "@/lib/types";

/** 내 포도밭: 완성한 포도송이 갤러리 + 누적 통계 */
export default async function VineyardPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // 파트장은 팀원 것도 조회되므로 내 것만 명시적으로 필터
  const [{ data: cards }, { data: subs }, { data: profileRow }] = await Promise.all([
    supabase
      .from("progress_cards")
      .select("*")
      .eq("student_id", user!.id)
      .order("completed_at", { ascending: false }),
    supabase.from("submissions").select("*").eq("student_id", user!.id),
    supabase.from("profiles").select("grape_skin, title, instrument").eq("id", user!.id).maybeSingle(),
  ]);
  const cardList = (cards ?? []) as ProgressCard[];
  const subList = (subs ?? []) as Submission[];
  const profile = profileRow as Pick<Profile, "grape_skin" | "title" | "instrument"> | null;
  // 저장된 원본 값 그대로 쓴다 ("random"이면 랜덤 포도로 렌더돼야 하므로)
  const skinId = profile?.grape_skin ?? getSkin(undefined).id;
  const wornTitle = getTitle(profile?.title);

  // 마감된 숙제도 완성작이면 트로피는 남긴다 (기록은 사라지지 않음)
  const completed = cardList.filter((c) => c.completed_at);
  const totalApproved = subList.filter((s) => s.status === "approved").length;
  const totalVideos = subList.length;
  const streak = calcStreak(subList.map((s) => s.created_at));
  const titleStats = calcTitleStats(cardList, subList, streak);
  const skinStats: SkinStats = {
    grapes: totalApproved,
    bunches: completed.length,
    videos: totalVideos,
    streak,
    grapesByInstrument: tallyGrapesByInstrument(subList),
  };
  const myPool = unlockedSkinIds(skinStats); // 랜덤 포도 재료

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/me" className="text-sm text-gray-400">← 내 카드 목록</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">🍇 내 포도밭</h1>
        {wornTitle && (
          <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-violet-700 bg-violet-100 px-2.5 py-1 rounded-full">
            {wornTitle.emoji} {wornTitle.name}
          </p>
        )}
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

      <SkinPicker currentSkinId={skinId} stats={skinStats} />

      <TitlePicker currentTitleId={profile?.title ?? null} stats={titleStats} />

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
                  <GrapeBunch
                    grapes={grapes}
                    skinId={skinId}
                    randomPool={myPool}
                    className="max-h-32 mx-auto"
                  />
                  <p className="mt-2 text-sm font-extrabold text-gray-800 truncate">
                    🏆 {card.title}
                  </p>
                  {!card.shared_at && (
                    <p className="text-[11px] font-bold text-amber-600">📣 자랑하기</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {card.completed_at &&
                      new Date(card.completed_at).toLocaleDateString("ko-KR", {
                        timeZone: "Asia/Seoul",
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
