import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SongManageCard, type SongSummary } from "@/components/SongManageCard";
import type { LineupStudent } from "@/components/LineupModal";
import type { Profile, ProgressCard, SongTrack, Submission } from "@/lib/types";

/** 곡 관리: 곡별 편성·미션·기한·진행·MR을 한 화면에서 */
export default async function SongsPage() {
  const supabase = await createSupabaseServer();
  const [{ data: students }, { data: cards }, { data: subs }, { data: tracks }, { data: { user } }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("role", "student").order("display_name"),
      supabase.from("progress_cards").select("*").order("created_at", { ascending: false }),
      supabase.from("submissions").select("*"),
      supabase.from("song_tracks").select("*").order("created_at", { ascending: true }),
      supabase.auth.getUser(),
    ]);

  const studentList = (students ?? []) as Profile[];
  const cardList = (cards ?? []) as ProgressCard[];
  const subList = (subs ?? []) as Submission[];
  const trackList = (tracks ?? []) as SongTrack[];

  const titles = [...new Set(cardList.map((c) => c.title))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );
  const cardIdsWithSubs = new Set(subList.map((s) => s.card_id));

  const songs = titles.map((title) => {
    const songCards = cardList.filter((c) => c.title === title);
    const template = songCards[0]; // created_at 내림차순이라 첫 번째가 최신
    const assignedIds = songCards.map((c) => c.student_id);
    const song: SongSummary = {
      title,
      mission: template.description,
      dueDate: template.due_date,
      totalGrapes: template.total_grapes,
      completedIds: songCards.filter((c) => c.completed_at).map((c) => c.student_id),
      pendingCount: subList.filter(
        (s) => s.status === "pending" && songCards.some((c) => c.id === s.card_id)
      ).length,
      trackCount: trackList.filter((t) => t.song_title === title).length,
      cardIds: songCards.map((c) => c.id),
      closedCount: songCards.filter((c) => c.closed_at).length,
    };
    const lineupStudents: LineupStudent[] = studentList.map((s) => {
      const myCard = songCards.find((c) => c.student_id === s.id);
      return {
        id: s.id,
        name: s.display_name,
        instrument: s.instrument,
        hasRecords: !!myCard && cardIdsWithSubs.has(myCard.id),
      };
    });
    return {
      song,
      lineupStudents,
      assignedIds,
      tracks: trackList.filter((t) => t.song_title === title),
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-violet-900">🎵 곡 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            곡별 편성·미션·기한을 여기서 한 번에 관리해요.
          </p>
        </div>
        <Link
          href="/teacher/songs/new"
          className="shrink-0 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold active:bg-violet-800"
        >
          🎵 새 곡
        </Link>
      </div>

      {songs.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          아직 곡이 없어요. <b>새 곡</b>으로 첫 곡을 만들어 보세요!
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {songs.map(({ song, lineupStudents, assignedIds, tracks: songTracks }) => (
            <SongManageCard
              key={song.title}
              song={song}
              students={lineupStudents}
              assignedIds={assignedIds}
              tracks={songTracks}
              myId={user?.id ?? ""}
            />
          ))}
        </div>
      )}
    </div>
  );
}
