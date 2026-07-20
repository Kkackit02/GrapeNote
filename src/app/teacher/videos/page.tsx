import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getTerms } from "@/lib/terms-server";
import { VideosTable, type VideoRow } from "@/components/VideosTable";
import type { Profile, ProgressCard, Submission } from "@/lib/types";

// 일괄 드라이브 백업 서버 액션이 이 라우트에서 실행된다 — 시간 여유 확보
export const maxDuration = 60;

/** 영상 관리: 전체 제출 영상을 엑셀 표처럼 보고 일괄 다운로드·백업·정리한다 */
export default async function VideosPage() {
  const supabase = await createSupabaseServer();
  const terms = await getTerms();
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
    videoPath: sub.video_path,
    fileState: sub.video_deleted_at ? (sub.drive_file_id ? "drive" : "gone") : "live",
    driveBacked: !sub.video_deleted_at && !!sub.drive_file_id,
  }));

  // 드라이브 연결 여부 (백업 버튼 활성화용 — boolean만 노출)
  const { data: { user } } = await supabase.auth.getUser();
  const { data: conn } = await createSupabaseAdmin()
    .from("drive_connections")
    .select("academy_id")
    .eq("academy_id", user?.app_metadata?.academy_id ?? "")
    .maybeSingle();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">🎬 영상 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          최근 제출 {rows.length}개예요. 체크해서 일괄 다운로드·드라이브 백업·파일 정리를 할 수 있어요.
        </p>
      </div>

      {/* 데스크톱에서 넓게: 부모 max-width를 벗어나 화면 전체 폭 사용 (full-bleed) */}
      <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen px-4">
        <div className="mx-auto max-w-5xl">
          <VideosTable rows={rows} driveConnected={!!conn} memberLabel={terms.member} />
        </div>
      </div>
    </div>
  );
}
