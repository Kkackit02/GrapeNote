import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/** 검토 그리드 한 세션에서 서명해 둘 최대 영상 수 (signed URL 유효 1시간) */
const MAX_QUEUE = 60;

export interface ReviewQueueItem {
  id: string;
  /** 재생용 signed URL. 발급 실패 시 null (타일에 안내 표시) */
  url: string | null;
  studentName: string;
  songTitle: string;
  grapeIndex: number;
  createdAt: string;
  studentTitle: string | null;
  studentComment: string | null;
}

interface PendingRow {
  id: string;
  grape_index: number;
  created_at: string;
  student_title: string | null;
  student_comment: string | null;
  video_path: string;
  progress_cards: { title: string } | null;
  profiles: { display_name: string } | null;
}

/**
 * 검토 대기 영상 목록(오래된 순) + 재생 URL을 한 번에 만든다.
 * RLS를 통과해 조회된 제출물의 경로만 서명한다 — 버킷은 private이라 이 URL만이 재생 수단.
 */
export async function buildReviewQueue(options?: {
  /** 파트장 검토함: 본인 제출은 제외 */
  excludeStudentId?: string;
}): Promise<ReviewQueueItem[]> {
  const supabase = await createSupabaseServer();
  const base = supabase
    .from("submissions")
    .select(
      "id, grape_index, created_at, student_title, student_comment, video_path, progress_cards(title), profiles!submissions_student_id_fkey(display_name)"
    )
    .eq("status", "pending");
  const filtered = options?.excludeStudentId
    ? base.neq("student_id", options.excludeStudentId)
    : base;
  const { data } = await filtered
    .order("created_at", { ascending: true })
    .limit(MAX_QUEUE);

  const rows = (data ?? []) as unknown as PendingRow[];
  if (rows.length === 0) return [];

  const { data: signed } = await createSupabaseAdmin()
    .storage.from("videos")
    .createSignedUrls(rows.map((row) => row.video_path), 3600);
  const urlByPath = new Map(
    (signed ?? [])
      .filter((entry) => entry.path && entry.signedUrl)
      .map((entry) => [entry.path as string, entry.signedUrl])
  );

  return rows.map((row) => ({
    id: row.id,
    url: urlByPath.get(row.video_path) ?? null,
    studentName: row.profiles?.display_name ?? "?",
    songTitle: row.progress_cards?.title ?? "?",
    grapeIndex: row.grape_index,
    createdAt: row.created_at,
    studentTitle: row.student_title,
    studentComment: row.student_comment,
  }));
}
