import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

interface BoardRow {
  song_title: string;
  student_id: string;
  student_name: string;
  done: number;
  total: number;
  pending: number;
  retry: number;
  completed: boolean;
}

/** 멤버용 읽기 전용 현황판 — 리더가 공개(show_board)했을 때만 RPC가 데이터를 준다 */
export default async function MemberBoardPage() {
  const supabase = await createSupabaseServer();
  const [{ data }, { data: { user } }] = await Promise.all([
    supabase.rpc("get_group_board"),
    supabase.auth.getUser(),
  ]);
  const rows = (data ?? []) as BoardRow[];
  const myId = user?.id ?? "";

  // 내가 참여하는 곡을 먼저, 그다음 나머지
  const myTitles = new Set(rows.filter((r) => r.student_id === myId).map((r) => r.song_title));
  const titles = [...new Set(rows.map((r) => r.song_title))].sort((a, b) => {
    const mine = Number(myTitles.has(b)) - Number(myTitles.has(a));
    return mine || a.localeCompare(b, "ko");
  });

  // 내 열을 맨 앞에 고정 (스크롤 없이 내 진행이 바로 보이게)
  const all = [...new Map(rows.map((r) => [r.student_id, r.student_name])).entries()];
  const students = [
    ...all.filter(([id]) => id === myId).map(([id]) => [id, "나"] as [string, string]),
    ...all.filter(([id]) => id !== myId),
  ];
  const cellOf = (title: string, studentId: string) =>
    rows.find((r) => r.song_title === title && r.student_id === studentId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/me" className="text-sm text-gray-400">← 내 카드 목록</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">📊 우리 그룹 현황판</h1>
        <p className="mt-1 text-xs text-gray-400">
          🍇 완료 · 👀 검토 대기 · ↺ 재연습 중 · — 미배정
        </p>
        <p className="mt-0.5 text-xs font-bold text-violet-500">
          보라색 &apos;나&apos; 열이 내 진행이에요. 옆으로 밀면 다른 멤버도 볼 수 있어요.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          아직 공개된 현황이 없어요.
        </div>
      ) : (
        // 부모 max-width를 벗어나 화면 전체 폭 사용 (full-bleed)
        <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen px-4">
          <div className="rounded-2xl bg-white border border-violet-100 overflow-x-auto">
            <table className="text-sm border-collapse min-w-full">
              <thead>
                <tr className="bg-violet-50">
                  <th className="sticky left-0 z-10 bg-violet-50 px-3 py-2.5 text-left font-extrabold text-violet-900 border-b border-violet-100 min-w-32">
                    곡명
                  </th>
                  {students.map(([id, name]) => (
                    <th
                      key={id}
                      className={`sticky top-0 z-10 px-2 py-2.5 font-bold border-b border-violet-100 whitespace-nowrap min-w-14 ${
                        id === myId
                          ? "bg-violet-200 text-violet-900"
                          : "bg-violet-50 text-gray-700"
                      }`}
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {titles.map((title, rowIdx) => (
                  <tr key={title} className={rowIdx % 2 ? "bg-gray-50/60" : ""}>
                    <th className="sticky left-0 z-10 px-3 py-2 text-left font-bold text-gray-800 border-b border-gray-100 whitespace-nowrap bg-white">
                      🎵 {title}
                    </th>
                    {students.map(([id]) => {
                      const cell = cellOf(title, id);
                      if (!cell) {
                        return (
                          <td
                            key={id}
                            className={`text-center text-gray-300 border-b border-gray-100 ${
                              id === myId ? "ring-1 ring-inset ring-violet-300" : ""
                            }`}
                          >
                            —
                          </td>
                        );
                      }
                      const label = cell.completed
                        ? `🍇 ${cell.done}/${cell.total}`
                        : cell.pending > 0
                          ? `👀 ${cell.done}/${cell.total}`
                          : cell.retry > 0
                            ? `↺ ${cell.done}/${cell.total}`
                            : `${cell.done}/${cell.total}`;
                      const className = cell.completed
                        ? "bg-violet-100 text-violet-800 font-bold"
                        : cell.pending > 0
                          ? "bg-lime-100 text-lime-800 font-bold"
                          : cell.retry > 0
                            ? "bg-orange-100 text-orange-700 font-bold"
                            : cell.done > 0
                              ? "text-gray-600"
                              : "text-gray-400";
                      return (
                        <td
                          key={id}
                          className={`text-center border-b border-gray-100 whitespace-nowrap px-2 py-2 ${className} ${
                            id === myId ? "ring-1 ring-inset ring-violet-300 font-bold" : ""
                          }`}
                        >
                          {label}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
