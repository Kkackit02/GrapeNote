import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

interface PendingRow {
  id: string;
  grape_index: number;
  created_at: string;
  student_title: string | null;
  progress_cards: { title: string } | null;
  profiles: { display_name: string } | null;
}

/** 파트장 검토함: 팀원들의 검토 대기 영상 (RLS가 팀원 것만 보여준다) */
export default async function LeaderReviewInboxPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: leading } = await supabase
    .from("teams")
    .select("id, name")
    .eq("leader_id", user!.id);
  if (!leading || leading.length === 0) redirect("/me");

  const { data } = await supabase
    .from("submissions")
    .select(
      "id, grape_index, created_at, student_title, progress_cards(title), profiles!submissions_student_id_fkey(display_name)"
    )
    .eq("status", "pending")
    .neq("student_id", user!.id) // 내 영상은 내가 검토할 수 없다
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as unknown as PendingRow[];
  const teamNames = leading.map((t) => t.name).join(", ");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/me" className="text-sm text-gray-400">← 내 카드 목록</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">⭐ 우리 팀 검토함</h1>
        <p className="mt-1 text-sm text-gray-500">
          {teamNames} 파트장으로서 팀원들의 연습 영상을 검토해 주세요.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          검토할 팀원 영상이 없어요. 모두 확인했네요! 🎉
        </div>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/me/review/${row.id}`}
                className="rounded-2xl bg-white border border-violet-100 p-4 flex items-center justify-between active:bg-violet-50"
              >
                <div>
                  <p className="font-bold text-gray-800">
                    🎹 {row.profiles?.display_name} — {row.progress_cards?.title}
                  </p>
                  {row.student_title && (
                    <p className="text-sm text-gray-600 mt-0.5">🎬 {row.student_title}</p>
                  )}
                  <p className="text-sm text-gray-400 mt-0.5">
                    포도알 #{row.grape_index} ·{" "}
                    {new Date(row.created_at).toLocaleString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className="text-violet-500 font-bold text-sm">검토 →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
