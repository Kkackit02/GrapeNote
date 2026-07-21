import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { calcStreak } from "@/lib/streaks";
import { calcTitleStats } from "@/lib/titles";
import { tallyGrapesByInstrument, type SkinStats } from "@/lib/skins";
import { StyleTabs } from "@/components/StyleTabs";
import type { ProgressCard, Profile, Submission } from "@/lib/types";

/** 꾸미기: 포도알 스킨 · 칭호 (포도밭에서 분리 — 목록이 길어 갤러리를 가렸다) */
export default async function StylePage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/student/login");

  const [{ data: cards }, { data: subs }, { data: profileRow }] = await Promise.all([
    supabase.from("progress_cards").select("*").eq("student_id", user.id),
    supabase.from("submissions").select("*").eq("student_id", user.id),
    supabase.from("profiles").select("grape_skin, title").eq("id", user.id).maybeSingle(),
  ]);
  const cardList = (cards ?? []) as ProgressCard[];
  const subList = (subs ?? []) as Submission[];
  const profile = profileRow as Pick<Profile, "grape_skin" | "title"> | null;

  const streak = calcStreak(subList.map((s) => s.created_at));
  const skinStats: SkinStats = {
    grapes: subList.filter((s) => s.status === "approved").length,
    bunches: cardList.filter((c) => c.completed_at).length,
    videos: subList.length,
    streak,
    grapesByInstrument: tallyGrapesByInstrument(subList),
  };
  const titleStats = calcTitleStats(cardList, subList, streak);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/me/vineyard" className="text-sm text-gray-400">← 내 포도밭</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">🎨 꾸미기</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          연습할수록 새 스킨과 칭호가 열려요. 미리 보고 골라 보세요!
        </p>
      </div>

      <StyleTabs
        currentSkinId={profile?.grape_skin ?? "violet"}
        skinStats={skinStats}
        currentTitleId={profile?.title ?? null}
        titleStats={titleStats}
      />
    </div>
  );
}
