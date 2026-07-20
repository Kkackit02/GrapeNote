import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deriveGrapes } from "@/lib/grapes";
import { getTerms } from "@/lib/terms-server";
import { StudentCardView } from "@/components/StudentCardView";
import type { ProgressCard, SongTrack, Submission } from "@/lib/types";

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

  const [{ data: subs }, { data: trackRows }, { data: academyRow }] = await Promise.all([
    supabase.from("submissions").select("*").eq("card_id", cardId),
    supabase
      .from("song_tracks")
      .select("*")
      .eq("song_title", card.title)
      .order("created_at", { ascending: true }),
    supabase.from("academies").select("is_premium").maybeSingle(),
  ]);
  const grapes = deriveGrapes(card.total_grapes, (subs ?? []) as Submission[]);

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
          premium={!!academyRow?.is_premium}
        />
      </div>
    </div>
  );
}
