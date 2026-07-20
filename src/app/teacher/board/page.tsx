import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deriveGrapes, approvedCount } from "@/lib/grapes";
import { AssignCell } from "@/components/AssignCell";
import { BoardCell, type BoardCellData } from "@/components/BoardCell";
import { SongRowHeader, type LineupStudent } from "@/components/SongRowHeader";
import type { Profile, ProgressCard, Submission, Team } from "@/lib/types";

interface Cell {
  data: BoardCellData;
  className: string;
}

/** 곡 × 멤버 현황판 — 합주 편성표처럼 한눈에 보는 숙제 진행 상태 */
export default async function BoardPage() {
  const supabase = await createSupabaseServer();
  const [{ data: students }, { data: cards }, { data: subs }, { data: teams }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("role", "student").order("display_name"),
      supabase.from("progress_cards").select("*"),
      supabase.from("submissions").select("*"),
      supabase.from("teams").select("*"),
    ]);

  const studentList = (students ?? []) as Profile[];
  const cardList = (cards ?? []) as ProgressCard[];
  const subList = (subs ?? []) as Submission[];
  const teamList = (teams ?? []) as Team[];
  const teamName = (id: string | null) =>
    teamList.find((t) => t.id === id)?.name.replace(/^🎵\s*/, "") ?? null;

  // 행 = 곡(제목). 같은 제목 카드들을 한 행으로 묶는다.
  const titles = [...new Set(cardList.map((c) => c.title))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );
  // 열 = 카드가 하나라도 있는 학생 (전원 표시하되 카드 없는 학생은 뒤로)
  const hasCard = new Set(cardList.map((c) => c.student_id));
  const columns = [
    ...studentList.filter((s) => hasCard.has(s.id)),
    ...studentList.filter((s) => !hasCard.has(s.id)),
  ];

  const cellOf = (title: string, student: Profile): Cell | null => {
    const card = cardList.find((c) => c.title === title && c.student_id === student.id);
    if (!card) return null; // 미배정 → AssignCell 렌더

    const cardSubs = subList.filter((s) => s.card_id === card.id);
    const grapes = deriveGrapes(card.total_grapes, cardSubs);
    const done = approvedCount(grapes);
    const progress = `${done}/${card.total_grapes}`;
    const pendingList = cardSubs
      .filter((s) => s.status === "pending")
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const retryCount = grapes.filter((g) => g.status === "retry").length;

    let label: string;
    let className: string;
    let href: string;
    if (pendingList.length > 0) {
      label = `👀 ${progress}`;
      className = "bg-lime-100 text-lime-800 font-bold";
      href = `/teacher/review/${pendingList[0].id}`;
    } else if (card.completed_at || done === card.total_grapes) {
      label = `🍇 ${progress}`;
      className = "bg-violet-100 text-violet-800 font-bold";
      href = `/teacher/cards/${card.id}`;
    } else if (retryCount > 0) {
      label = `↺ ${progress}`;
      className = "bg-orange-100 text-orange-700 font-bold";
      href = `/teacher/cards/${card.id}`;
    } else {
      label = progress;
      className = done > 0 ? "text-gray-600 font-medium" : "text-gray-400";
      href = `/teacher/cards/${card.id}`;
    }

    return {
      className,
      data: {
        label,
        className,
        href,
        studentName: student.display_name,
        card: {
          id: card.id,
          title: card.title,
          description: card.description,
          totalGrapes: card.total_grapes,
          dueDate: card.due_date,
        },
        done,
        pendingCount: pendingList.length,
        retryCount,
      },
    };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-violet-900">📊 현황판</h1>
          <p className="mt-1 text-sm text-gray-500">
            곡 × 멤버 진행 상태예요. 곡명을 누르면 편성을 수정할 수 있어요.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            🍇 완료 · 👀 검토 대기 (누르면 바로 검토) · ↺ 재연습 중 · ＋ 미배정 (누르면 바로 배정)
          </p>
        </div>
        <Link
          href="/teacher/songs/new"
          className="shrink-0 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold active:bg-violet-800"
        >
          🎵 새 곡
        </Link>
      </div>

      {titles.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          아직 배정된 숙제가 없어요.
        </div>
      ) : (
        // 데스크톱에서 곡×멤버를 한눈에: 부모 max-width를 벗어나 화면 전체 폭 사용 (full-bleed)
        <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen px-4">
          <div className="rounded-2xl bg-white border border-violet-100 overflow-x-auto">
          <table className="text-sm border-collapse min-w-full">
            <thead>
              <tr className="bg-violet-50">
                <th className="sticky left-0 top-0 z-20 bg-violet-50 px-3 py-2.5 text-left font-extrabold text-violet-900 border-b border-violet-100 min-w-36">
                  곡명
                </th>
                {columns.map((s) => (
                  <th
                    key={s.id}
                    className="sticky top-0 z-10 bg-violet-50 px-2 py-2.5 font-bold text-gray-700 border-b border-violet-100 whitespace-nowrap min-w-16"
                  >
                    <Link href={`/teacher/students/${s.id}`} className="hover:text-violet-700">
                      {s.display_name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {titles.map((title, rowIdx) => {
                const anyCard = cardList.find((c) => c.title === title);
                const team = teamName(anyCard?.team_id ?? null);
                const songCards = cardList.filter((c) => c.title === title);
                const assignedIds = songCards.map((c) => c.student_id);
                const cardIdsWithSubs = new Set(subList.map((s) => s.card_id));
                const lineupStudents: LineupStudent[] = studentList.map((s) => {
                  const myCard = songCards.find((c) => c.student_id === s.id);
                  return {
                    id: s.id,
                    name: s.display_name,
                    instrument: s.instrument,
                    hasRecords: !!myCard && cardIdsWithSubs.has(myCard.id),
                  };
                });
                return (
                  <tr key={title} className={rowIdx % 2 ? "bg-gray-50" : "bg-white"}>
                    <th className="sticky left-0 z-10 bg-inherit px-3 py-2 text-left border-b border-gray-100 whitespace-nowrap">
                      <SongRowHeader
                        title={title}
                        teamLabel={team}
                        students={lineupStudents}
                        assignedIds={assignedIds}
                      />
                    </th>
                    {columns.map((s) => {
                      const cell = cellOf(title, s);
                      return (
                        <td
                          key={s.id}
                          className={`text-center border-b border-gray-100 whitespace-nowrap ${cell?.className ?? ""}`}
                        >
                          {!cell ? (
                            <AssignCell title={title} studentId={s.id} studentName={s.display_name} />
                          ) : (
                            <BoardCell data={cell.data} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
