import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SongManageCard, type SongSummary } from "@/components/SongManageCard";
import type { LineupStudent } from "@/components/LineupModal";
import type { Profile, ProgressCard, SongTrack, Submission } from "@/lib/types";

/** 곡 관리: 곡별 편성·미션·기한·진행·MR을 한 화면에서. 마감한 곡은 따로 본다. */
export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const showClosed = show === "closed";
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
      // 편성 전원이 마감된 곡 = 끝난 곡
      isClosed: song.cardIds.length > 0 && song.closedCount >= song.cardIds.length,
    };
  });

  const closedCount = songs.filter((s) => s.isClosed).length;
  const visible = songs.filter((s) => (showClosed ? s.isClosed : !s.isClosed));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-violet-900">
            {showClosed ? "🔒 마감한 곡" : "🎵 곡 관리"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {showClosed
              ? "끝난 곡이에요. 기록은 그대로 남아 있고, 필요하면 마감을 풀 수 있어요."
              : "진행 중인 곡의 편성·미션·기한을 관리해요."}
          </p>
        </div>
        {!showClosed && (
          <Link
            href="/teacher/songs/new"
            className="shrink-0 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold active:bg-violet-800"
          >
            🎵 새 곡
          </Link>
        )}
      </div>

      {/* 마감한 곡은 기본 화면에서 빠지고 여기로만 들어온다 */}
      {showClosed ? (
        <Link
          href="/teacher/songs"
          className="self-start px-4 py-2 rounded-xl bg-white border border-violet-200 text-violet-700 text-sm font-bold active:bg-violet-50"
        >
          ← 진행 중인 곡 보기
        </Link>
      ) : (
        closedCount > 0 && (
          <Link
            href="/teacher/songs?show=closed"
            className="self-start px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-600 text-sm font-bold active:bg-gray-100"
          >
            🔒 마감한 곡 {closedCount}개 보기
          </Link>
        )
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          {showClosed ? (
            "마감한 곡이 없어요."
          ) : (
            <>
              진행 중인 곡이 없어요.
              <br />
              <b>🎵 새 곡</b>으로 시작하거나, {closedCount > 0 && "마감한 곡을 다시 열거나, "}
              멤버 상세에서 개별로 배정할 수 있어요.
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map(({ song, lineupStudents, assignedIds, tracks: songTracks }) => (
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
