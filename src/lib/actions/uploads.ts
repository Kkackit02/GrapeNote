"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { deriveGrapes } from "@/lib/grapes";
import { groupLimits, formatBytes, isPremiumActive } from "@/lib/limits";
import { sendPushTo, reviewersOf } from "@/lib/push";
import type { ActionResult, Submission } from "@/lib/types";

const ALLOWED_EXTENSIONS = ["mp4", "mov", "webm", "m4v", "3gp"];

/**
 * 1단계: 업로드 권한 검증 후 signed upload URL 발급.
 * 버킷은 전부 잠금 상태 — 이 토큰만이 업로드 경로다.
 */
export async function requestUpload(input: {
  cardId: string;
  grapeIndex: number;
  fileName: string;
  fileSize: number;
  /** 클라이언트에서 계산한 파일 SHA-256 (hex) — 같은 영상 재탕 방지 */
  fileHash?: string;
}): Promise<ActionResult<{ path: string; token: string; signedUrl: string }>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  // 그룹 프리미엄 여부에 따라 한도가 달라진다 (0018 이전엔 무료 기준)
  const { data: academyRow } = await supabase
    .from("academies")
    .select("is_premium, premium_until")
    .maybeSingle();
  const limits = groupLimits(isPremiumActive(academyRow));

  if (input.fileSize > limits.maxUploadBytes) {
    return {
      ok: false,
      error: `영상이 너무 커요 (최대 ${formatBytes(limits.maxUploadBytes)}). 앱의 촬영 버튼으로 찍으면 5분까지 올릴 수 있어요.`,
    };
  }
  const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: "영상 파일만 올릴 수 있어요 (mp4, mov, webm)." };
  }

  // 업로드 전에 중복 영상 검사 (대역폭 절약). DB 유니크 인덱스가 최종 방어선.
  if (input.fileHash) {
    const { data: dup } = await supabase
      .from("submissions")
      .select("id, card_id, grape_index, status")
      .eq("student_id", user.id)
      .eq("video_hash", input.fileHash)
      .limit(1);
    const existing = dup?.[0];
    if (existing) {
      // 확인 응답만 유실된 재시도라면 이미 제출된 것 — 중복이라고 나무라지 않는다
      const sameGrapePending =
        existing.card_id === input.cardId &&
        existing.grape_index === input.grapeIndex &&
        existing.status === "pending";
      if (sameGrapePending) {
        return { ok: false, error: "이미 제출됐어요! 검토를 기다리는 중이에요. 👀" };
      }
      return { ok: false, error: "이미 올렸던 영상이에요! 새로 연습한 영상을 올려 주세요. 🎵" };
    }
  }

  // 내 카드인지 + 해당 포도알이 제출 가능한 상태인지 검증 (RLS로 내 카드만 조회됨)
  const { data: card } = await supabase
    .from("progress_cards")
    .select("id, total_grapes, academy_id, student_id, closed_at")
    .eq("id", input.cardId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!card) return { ok: false, error: "카드를 찾을 수 없어요." };
  // 업로드를 시작하기 전에 막는다 (create_submission도 막지만 그땐 이미 다 올린 뒤)
  if (card.closed_at) {
    return { ok: false, error: "마감된 숙제예요. 더 이상 영상을 올릴 수 없어요. 🔒" };
  }
  if (input.grapeIndex < 1 || input.grapeIndex > card.total_grapes) {
    return { ok: false, error: "잘못된 포도알이에요." };
  }

  const { data: subs } = await supabase
    .from("submissions")
    .select("*")
    .eq("card_id", card.id)
    .eq("grape_index", input.grapeIndex);
  const grape = deriveGrapes(card.total_grapes, (subs ?? []) as Submission[])[input.grapeIndex - 1];
  if (grape.status === "approved") return { ok: false, error: "이미 합격한 포도알이에요! 🍇" };
  if (grape.status === "pending") {
    return { ok: false, error: "아직 검토 중인 영상이 있어요. 조금만 기다려 주세요." };
  }

  // 그룹 저장 한도 검사 — 판정 후 자동 정리로 공간이 다시 생긴다
  const admin = createSupabaseAdmin();
  const { data: usageRows } = await admin
    .from("submissions")
    .select("video_size_bytes")
    .eq("academy_id", card.academy_id)
    .is("video_deleted_at", null);
  const used = (usageRows ?? []).reduce((sum, row) => sum + (row.video_size_bytes ?? 0), 0);
  if (used + input.fileSize > limits.storageBytes) {
    return {
      ok: false,
      error: `그룹 저장 공간(${formatBytes(limits.storageBytes)})이 가득 찼어요. 판정된 영상은 ${limits.retentionDays}일 후 자동 정리되니 잠시 후 다시 시도해 주세요.`,
    };
  }

  const path = `${card.academy_id}/${user.id}/${card.id}/${input.grapeIndex}-${randomUUID()}.${ext}`;
  const { data: signed, error } = await admin.storage
    .from("videos")
    .createSignedUploadUrl(path);
  if (error || !signed) return { ok: false, error: "업로드 준비에 실패했어요. 다시 시도해 주세요." };

  return {
    ok: true,
    data: { path: signed.path, token: signed.token, signedUrl: signed.signedUrl },
  };
}

/** 2단계: 업로드 완료 확인 후 submission(pending) 생성 → 포도알이 "검토 대기"로 */
export async function confirmUpload(input: {
  cardId: string;
  grapeIndex: number;
  path: string;
  fileSize: number;
  fileHash?: string;
  /** 학생이 다는 제목 / 선생님께 보내는 코멘트 (선택) */
  title?: string;
  comment?: string;
}): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const academyId = user.app_metadata?.academy_id;
  // path가 requestUpload에서 발급한 형식인지 검증 (임의 경로 등록 차단)
  const expectedPrefix = `${academyId}/${user.id}/${input.cardId}/${input.grapeIndex}-`;
  if (!input.path.startsWith(expectedPrefix)) {
    return { ok: false, error: "업로드 정보가 올바르지 않아요." };
  }

  // 객체가 실제로 업로드됐는지 확인
  const admin = createSupabaseAdmin();
  const { error: existsError } = await admin.storage
    .from("videos")
    .createSignedUrl(input.path, 60);
  if (existsError) return { ok: false, error: "영상 업로드가 완료되지 않았어요. 다시 시도해 주세요." };

  // 제출 생성은 create_submission RPC로만 처리한다. 함수(security definer)가 카드 소유권·
  // 포도알 상태·인덱스 범위·경로 접두사를 DB 레벨에서 강제하므로, 클라이언트가 anon 키로
  // submissions에 직접 insert(남의 카드 주입 등)할 수 없다.
  const { error } = await supabase.rpc("create_submission", {
    p_card_id: input.cardId,
    p_grape_index: input.grapeIndex,
    p_video_path: input.path,
    p_video_size: input.fileSize,
    p_video_hash: input.fileHash ?? "",
    p_title: input.title?.slice(0, 100) ?? "",
    p_comment: input.comment?.slice(0, 500) ?? "",
  });
  if (error) {
    if (error.message.includes("submissions_unique_video_per_student")) {
      return { ok: false, error: "이미 올렸던 영상이에요! 새로 연습한 영상을 올려 주세요. 🎵" };
    }
    if (error.message.includes("already approved")) {
      return { ok: false, error: "이미 합격한 포도알이에요! 🍇" };
    }
    if (error.message.includes("already pending")) {
      return { ok: false, error: "아직 검토 중인 영상이 있어요. 조금만 기다려 주세요." };
    }
    if (error.message.includes("card closed")) {
      return { ok: false, error: "마감된 숙제예요. 더 이상 영상을 올릴 수 없어요. 🔒" };
    }
    return { ok: false, error: "제출에 실패했어요. 다시 시도해 주세요." };
  }

  // 검토자에게 알림 (실패해도 제출 자체는 성공 — 알림은 부가 기능)
  try {
    const [{ data: profile }, { data: card }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).single(),
      supabase.from("progress_cards").select("title").eq("id", input.cardId).single(),
    ]);
    const reviewers = await reviewersOf(user.id, academyId);
    const payload = {
      title: "👀 새 연습 영상이 올라왔어요",
      body: `${profile?.display_name ?? "멤버"} · ${card?.title ?? "곡"} 포도알 ${input.grapeIndex}`,
      // 사람마다 알림이 쌓이도록 제출 단위 태그 (같은 태그면 서로를 덮어쓴다)
      tag: `submission-${input.cardId}-${input.grapeIndex}`,
    };
    await Promise.all([
      sendPushTo(reviewers.teachers, { ...payload, url: "/teacher/review" }),
      // 파트장은 학생 계정이라 /teacher/*로 보내면 가드에 막힌다
      sendPushTo(reviewers.leaders, { ...payload, url: "/me/review" }),
    ]);
  } catch {
    // 무시
  }

  revalidatePath(`/me/cards/${input.cardId}`);
  revalidatePath("/teacher/review");
  return { ok: true, data: undefined };
}

/** 학생이 자기 "검토 대기" 영상을 삭제한다 (다시 찍기용). 판정된 제출은 삭제 불가. */
export async function deleteSubmission(submissionId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  // RLS delete 정책이 (내 것 + pending)을 강제하지만, 스토리지 정리를 위해 먼저 조회
  const { data: submission } = await supabase
    .from("submissions")
    .select("id, card_id, video_path, status, student_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission || submission.student_id !== user.id) {
    return { ok: false, error: "영상을 찾을 수 없어요." };
  }
  if (submission.status !== "pending") {
    return { ok: false, error: "이미 판정된 영상은 지울 수 없어요." };
  }

  const { data: deleted, error } = await supabase
    .from("submissions")
    .delete()
    .eq("id", submissionId)
    .select("id");
  if (error || !deleted || deleted.length === 0) {
    return { ok: false, error: "삭제에 실패했어요. 방금 판정됐을 수 있어요." };
  }

  // 스토리지 정리 (실패해도 치명적이지 않음 — 고아 파일만 남음)
  const admin = createSupabaseAdmin();
  await admin.storage.from("videos").remove([submission.video_path]);

  revalidatePath(`/me/cards/${submission.card_id}`);
  revalidatePath("/teacher/review");
  return { ok: true, data: undefined };
}

/**
 * 재생/다운로드용 signed URL 발급 (1시간). RLS로 접근 가능한 제출물만 허용.
 * downloadName을 주면 Content-Disposition attachment로 내려가 파일로 저장된다.
 */
export async function getPlaybackUrl(
  submissionId: string,
  downloadName?: string
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  // RLS: 학생은 자기 것, 선생님은 같은 학원 것만 조회된다
  const { data: submission } = await supabase
    .from("submissions")
    .select("video_path, video_deleted_at, drive_file_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) return { ok: false, error: "영상을 찾을 수 없어요." };
  if (submission.video_deleted_at) {
    return {
      ok: false,
      error: submission.drive_file_id
        ? "저장 공간을 위해 정리된 영상이에요. 리더의 구글 드라이브 'GrapeNote 아카이브'에 보관되어 있어요."
        : "오래된 영상이라 저장 공간을 위해 정리됐어요. (판정 기록은 남아 있어요)",
    };
  }

  const admin = createSupabaseAdmin();
  const { data: signed, error } = await admin.storage
    .from("videos")
    .createSignedUrl(
      submission.video_path,
      3600,
      downloadName ? { download: downloadName } : undefined
    );
  if (error || !signed) return { ok: false, error: "영상 재생 준비에 실패했어요." };

  return { ok: true, data: { url: signed.signedUrl } };
}
