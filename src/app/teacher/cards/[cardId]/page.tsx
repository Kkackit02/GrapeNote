import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deriveGrapes, approvedCount } from "@/lib/grapes";
import { GrapeBunch } from "@/components/GrapeBunch";
import { SongTracks } from "@/components/SongTracks";
import type { ProgressCard, Profile, SongTrack, Submission } from "@/lib/types";

const STATUS_LABEL = {
  pending: { text: "검토 대기", className: "bg-lime-100 text-lime-700" },
  approved: { text: "합격", className: "bg-violet-100 text-violet-700" },
  needs_retry: { text: "재연습", className: "bg-orange-100 text-orange-700" },
} as const;

export default async function TeacherCardPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const supabase = await createSupabaseServer();

  const { data: cardRow } = await supabase
    .from("progress_cards")
    .select("*")
    .eq("id", cardId)
    .maybeSingle();
  if (!cardRow) notFound();
  const card = cardRow as ProgressCard;

  const [{ data: studentRow }, { data: subs }, { data: trackRows }, { data: { user } }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", card.student_id).single(),
      supabase
        .from("submissions")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false }),
      supabase
        .from("song_tracks")
        .select("*")
        .eq("song_title", card.title)
        .order("created_at", { ascending: true }),
      supabase.auth.getUser(),
    ]);
  const student = studentRow as Profile;
  const subList = (subs ?? []) as Submission[];
  const grapes = deriveGrapes(card.total_grapes, subList);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/teacher/students/${card.student_id}`} className="text-sm text-gray-400">
          ← {student.display_name}
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">
          {card.completed_at ? "🏆 " : ""}{card.title}
        </h1>
        {card.description && (
          <p className="mt-1 text-sm text-gray-600">
            <span className="font-bold text-sky-700">🎯 미션:</span>{" "}
            <span className="whitespace-pre-line">{card.description}</span>
          </p>
        )}
        <p className="mt-1 text-sm font-bold text-violet-600">
          🍇 {approvedCount(grapes)} / {card.total_grapes}알 완성
        </p>
      </div>

      <SongTracks
        songTitle={card.title}
        tracks={(trackRows ?? []) as SongTrack[]}
        myId={user?.id ?? ""}
        isTeacher
      />

      <div className="rounded-2xl bg-white border border-violet-100 p-4">
        <GrapeBunch grapes={grapes} skinId={student.grape_skin} className="max-w-xs mx-auto" />
      </div>

      <section>
        <h2 className="text-lg font-bold text-gray-700">제출 이력</h2>
        {subList.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">아직 제출된 영상이 없어요.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {subList.map((sub) => {
              const label = STATUS_LABEL[sub.status];
              return (
                <li key={sub.id}>
                  <Link
                    href={`/teacher/review/${sub.id}`}
                    className="rounded-xl bg-white border border-violet-100 px-4 py-3 flex items-center justify-between text-sm active:bg-violet-50"
                  >
                    <span className="font-bold text-gray-700">포도알 #{sub.grape_index}</span>
                    <span className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${label.className}`}>
                        {label.text}
                      </span>
                      <span className="text-gray-400">
                        {new Date(sub.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
