import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

interface PendingRow {
  id: string;
  grape_index: number;
  created_at: string;
  student_title: string | null;
  progress_cards: { title: string } | null;
  profiles: { display_name: string } | null;
}

export default async function ReviewInboxPage() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("submissions")
    .select(
      "id, grape_index, created_at, student_title, progress_cards(title), profiles!submissions_student_id_fkey(display_name)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as unknown as PendingRow[];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold text-violet-900">👀 검토함</h1>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          검토할 영상이 없어요. 모두 확인하셨네요! 🎉
        </div>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/teacher/review/${row.id}`}
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
