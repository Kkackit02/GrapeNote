"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getAccessToken } from "@/lib/google-drive";
import type { ActionResult } from "@/lib/types";

/**
 * 브라우저에서 드라이브로 직접 업로드하기 위한 세션.
 * 서버(Vercel 함수)를 거치면 60초 제한에 걸리므로, 리더 본인 브라우저가
 * Supabase에서 영상을 받아 자기 드라이브로 바로 올린다.
 *
 * 노출되는 access token은 1시간짜리이고 scope가 drive.file이라
 * "이 앱이 만든 파일"에만 접근할 수 있다 (리더 본인의 드라이브).
 */
export async function getDriveUploadSession(): Promise<
  ActionResult<{ accessToken: string; folderId: string }>
> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "리더 계정으로 로그인해 주세요." };
  }

  const admin = createSupabaseAdmin();
  const { data: conn } = await admin
    .from("drive_connections")
    .select("refresh_token, folder_id")
    .eq("academy_id", user.app_metadata.academy_id)
    .maybeSingle();
  if (!conn) {
    return { ok: false, error: "구글 드라이브가 연결되어 있지 않아요. 설정에서 먼저 연결해 주세요." };
  }

  const accessToken = await getAccessToken(conn.refresh_token);
  if (!accessToken) {
    return { ok: false, error: "드라이브 인증에 실패했어요. 연결을 해제 후 다시 연결해 주세요." };
  }
  return { ok: true, data: { accessToken, folderId: conn.folder_id } };
}

/** 브라우저가 드라이브 업로드를 끝낸 뒤 결과를 기록한다 (drive_file_id만 수정) */
export async function markSubmissionArchived(
  submissionId: string,
  driveFileId: string
): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "리더 계정으로 로그인해 주세요." };
  }
  if (!driveFileId.trim()) return { ok: false, error: "업로드 결과가 올바르지 않아요." };

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("submissions")
    .update({ drive_file_id: driveFileId })
    .eq("id", submissionId)
    .eq("academy_id", user.app_metadata.academy_id); // 우리 그룹 것만
  if (error) return { ok: false, error: "백업 기록에 실패했어요." };
  return { ok: true, data: undefined };
}

/** 드라이브 아카이브 연결 해제 — 이미 백업된 파일은 드라이브에 그대로 남는다 */
export async function disconnectDrive(): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "리더 계정으로 로그인해 주세요." };
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("drive_connections")
    .delete()
    .eq("academy_id", user.app_metadata.academy_id);
  if (error) return { ok: false, error: "연결 해제에 실패했어요." };

  revalidatePath("/teacher");
  return { ok: true, data: undefined };
}
