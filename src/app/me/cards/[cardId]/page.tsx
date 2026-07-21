import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deriveGrapes } from "@/lib/grapes";
import { getTerms } from "@/lib/terms-server";
import { isPremiumActive } from "@/lib/limits";
import { StudentCardView } from "@/components/StudentCardView";
import { getSkin } from "@/lib/skins";
import type { ProgressCard, Profile, SongTrack, Submission } from "@/lib/types";

export default async function MyCardPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // 파트장은 팀원 카드도 RLS를 통과하므로 내 카드인지 명시적으로 확인
  const { data: cardRow } = await supabase
    .from("progress_cards")
    .select("*")
    .eq("id", cardId)
    .eq("student_id", user!.id)
    .maybeSingle();
  if (!cardRow) notFound();
  const card = cardRow as ProgressCard;

  const [{ data: subs }, { data: trackRows }, { data: academyRow }, { data: profileRow }] =
    await Promise.all([
      supabase.from("submissions").select("*").eq("card_id", cardId),
      supabase
        .from("song_tracks")
        .select("*")
        .eq("song_title", card.title)
        .order("created_at", { ascending: true }),
      supabase.from("academies").select("is_premium, premium_until, name").maybeSingle(),
      supabase
        .from("profiles")
        .select("grape_skin, display_name, showcase_submission_id")
        .eq("id", user!.id)
        .maybeSingle(),
    ]);
  const grapes = deriveGrapes(card.total_grapes, (subs ?? []) as Submission[]);
  const profile = profileRow as Pick<
    Profile,
    "grape_skin" | "display_name" | "showcase_submission_id"
  > | null;
  const skinId = getSkin(profile?.grape_skin).id;

  return (
    <div>
      <Link href="/me" className="text-sm text-gray-400">← 내 카드 목록</Link>
      <div className="mt-3">
        <StudentCardView
          card={card}
          grapes={grapes}
          tracks={(trackRows ?? []) as SongTrack[]}
          myId={user!.id}
          leaderLabel={(await getTerms()).leader}
          premium={isPremiumActive(academyRow)}
          // 마감된 숙제는 지난 기록만 볼 수 있다 (제출은 DB가 막는다)
          readOnly={!!card.closed_at}
          skinId={skinId}
          memberName={profile?.display_name ?? "멤버"}
          groupName={(academyRow as { name?: string } | null)?.name ?? "우리 그룹"}
          showcaseSubmissionId={profile?.showcase_submission_id ?? null}
        />
      </div>
    </div>
  );
}
