"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

/**
 * 합격 영상 하나를 그룹에 걸어 자랑한다 (멤버당 1개).
 * 새로 걸면 이전 자랑 영상은 포인터가 바뀌어 보호가 풀린다(다음 정리 때 정상 삭제 대상).
 * 프로필 쓰기는 service role — 본인 소유·합격·파일 존재를 확인한 뒤에만 건다.
 */
export async function showcaseSubmission(submissionId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "student") {
    return { ok: false, error: "멤버 계정으로 로그인해 주세요." };
  }

  // RLS로 내 제출만 조회된다 — 남의 영상은 여기서 걸러진다
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, student_id, status, video_deleted_at")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub || sub.student_id !== user.id) {
    return { ok: false, error: "내 영상만 자랑할 수 있어요." };
  }
  if (sub.status !== "approved") {
    return { ok: false, error: "합격한 영상만 자랑할 수 있어요." };
  }
  if (sub.video_deleted_at) {
    return { ok: false, error: "저장 공간을 위해 정리된 영상이라 자랑할 수 없어요." };
  }

  const { error } = await createSupabaseAdmin()
    .from("profiles")
    .update({ showcase_submission_id: submissionId })
    .eq("id", user.id);
  if (error) return { ok: false, error: "자랑 영상 지정에 실패했어요." };

  revalidatePath("/me");
  revalidatePath("/me/wall");
  revalidatePath("/me/cards", "layout");
  return { ok: true, data: undefined };
}

/** 걸어 둔 자랑 영상을 내린다. */
export async function clearShowcase(): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "student") {
    return { ok: false, error: "멤버 계정으로 로그인해 주세요." };
  }

  const { error } = await createSupabaseAdmin()
    .from("profiles")
    .update({ showcase_submission_id: null })
    .eq("id", user.id);
  if (error) return { ok: false, error: "자랑 영상 내리기에 실패했어요." };

  revalidatePath("/me");
  revalidatePath("/me/wall");
  revalidatePath("/me/cards", "layout");
  return { ok: true, data: undefined };
}

/**
 * 자랑 영상 재생 URL. 그룹의 다른 멤버도 볼 수 있으므로,
 * "지금 자랑 중인 영상 + 같은 학원"임을 service role로 재확인한 뒤 짧은 signed URL을 준다.
 */
export async function getShowcasePlaybackUrl(
  submissionId: string
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };
  const academyId = user.app_metadata?.academy_id as string | undefined;
  if (!academyId) return { ok: false, error: "그룹 정보를 확인할 수 없어요." };

  const admin = createSupabaseAdmin();

  // 지금 누군가가 자랑 중인 영상인지 확인 (자랑 중이 아니면 재생 불가)
  const { data: owner } = await admin
    .from("profiles")
    .select("id")
    .eq("showcase_submission_id", submissionId)
    .maybeSingle();
  if (!owner) return { ok: false, error: "지금은 볼 수 없는 영상이에요." };

  // 같은 학원 + 파일이 남아 있는지 확인
  const { data: sub } = await admin
    .from("submissions")
    .select("video_path, academy_id, video_deleted_at")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub || sub.academy_id !== academyId) {
    return { ok: false, error: "지금은 볼 수 없는 영상이에요." };
  }
  if (sub.video_deleted_at) {
    return { ok: false, error: "저장 공간을 위해 정리된 영상이에요." };
  }

  const { data: signed, error } = await admin.storage
    .from("videos")
    .createSignedUrl(sub.video_path, 300);
  if (error || !signed) return { ok: false, error: "영상 재생 준비에 실패했어요." };
  return { ok: true, data: { url: signed.signedUrl } };
}
