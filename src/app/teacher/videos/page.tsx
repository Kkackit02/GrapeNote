import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { VideosTable, type VideoRow } from "@/components/VideosTable";
import type { Profile, ProgressCard, Submission } from "@/lib/types";

/** 영상 관리: 전체 제출 영상을 엑셀 표처럼 보고 바로 재생·다운로드한다 */
export default async function VideosPage() {
  const supabase = await createSupabaseServer();
  const [{ data: subs }, { data: cards }, { data: students }] = await Promise.all([
    supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("progress_cards").select("id, title"),
    supabase.from("profiles").select("id, display_name").eq("role", "student"),
  ]);

  const titleOf = new Map(((cards ?? []) as ProgressCard[]).map((c) => [c.id, c.title]));
  const nameOf = new Map(((students ?? []) as Profile[]).map((p) => [p.id, p.display_name]));

  const rows: VideoRow[] = ((subs ?? []) as Submission[]).map((sub) => ({
    id: sub.id,
    createdAt: sub.created_at,
    reviewedAt: sub.reviewed_at,
    songTitle: titleOf.get(sub.card_id) ?? "?",
    studentName: nameOf.get(sub.student_id) ?? "?",
    grapeIndex: sub.grape_index,
    status: sub.status,
    sizeBytes: sub.video_size_bytes ?? 0,
    fileState: sub.video_deleted_at ? (sub.drive_file_id ? "drive" : "gone") : "live",
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">🎬 영상 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          최근 제출 {rows.length}개예요. 제목을 누르면 정렬돼요. 보관 중인 영상은 바로 저장할 수 있어요.
        </p>
      </div>

      {/* 데스크톱에서 넓게: 부모 max-width를 벗어나 화면 전체 폭 사용 (full-bleed) */}
      <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen px-4">
        <div className="mx-auto max-w-5xl">
          <VideosTable rows={rows} />
        </div>
      </div>
    </div>
  );
}
