import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deriveGrapes } from "@/lib/grapes";
import { StudentCardView } from "@/components/StudentCardView";
import type { ProgressCard, Submission } from "@/lib/types";

export default async function MyCardPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const supabase = await createSupabaseServer();

  // RLS: 내 카드만 조회된다
  const { data: cardRow } = await supabase
    .from("progress_cards")
    .select("*")
    .eq("id", cardId)
    .maybeSingle();
  if (!cardRow) notFound();
  const card = cardRow as ProgressCard;

  const { data: subs } = await supabase
    .from("submissions")
    .select("*")
    .eq("card_id", cardId);
  const grapes = deriveGrapes(card.total_grapes, (subs ?? []) as Submission[]);

  return (
    <div>
      <Link href="/me" className="text-sm text-gray-400">← 내 카드 목록</Link>
      <div className="mt-3">
        <StudentCardView card={card} grapes={grapes} />
      </div>
    </div>
  );
}
