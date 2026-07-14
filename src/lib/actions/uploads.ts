"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { deriveGrapes } from "@/lib/grapes";
import type { ActionResult, Submission } from "@/lib/types";

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB (버킷 설정과 동일)
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
}): Promise<ActionResult<{ path: string; token: string }>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  if (input.fileSize > MAX_SIZE_BYTES) {
    return { ok: false, error: "영상이 너무 커요 (최대 50MB). 1분 이내로 촬영해 주세요." };
  }
  const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: "영상 파일만 올릴 수 있어요 (mp4, mov, webm)." };
  }

  // 업로드 전에 중복 영상 검사 (대역폭 절약). DB 유니크 인덱스가 최종 방어선.
  if (input.fileHash) {
    const { data: dup } = await supabase
      .from("submissions")
      .select("id")
      .eq("student_id", user.id)
      .eq("video_hash", input.fileHash)
      .limit(1);
    if (dup && dup.length > 0) {
      return { ok: false, error: "이미 올렸던 영상이에요! 새로 연습한 영상을 올려 주세요. 🎹" };
    }
  }

  // 내 카드인지 + 해당 포도알이 제출 가능한 상태인지 검증 (RLS로 내 카드만 조회됨)
  const { data: card } = await supabase
    .from("progress_cards")
    .select("id, total_grapes, academy_id, student_id")
    .eq("id", input.cardId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!card) return { ok: false, error: "카드를 찾을 수 없어요." };
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
    return { ok: false, error: "선생님이 아직 보고 계신 영상이 있어요. 조금만 기다려 주세요." };
  }

  const path = `${card.academy_id}/${user.id}/${card.id}/${input.grapeIndex}-${randomUUID()}.${ext}`;
  const admin = createSupabaseAdmin();
  const { data: signed, error } = await admin.storage
    .from("videos")
    .createSignedUploadUrl(path);
  if (error || !signed) return { ok: false, error: "업로드 준비에 실패했어요. 다시 시도해 주세요." };

  return { ok: true, data: { path: signed.path, token: signed.token } };
}

/** 2단계: 업로드 완료 확인 후 submission(pending) 생성 → 포도알이 "검토 대기"로 */
export async function confirmUpload(input: {
  cardId: string;
  grapeIndex: number;
  path: string;
  fileSize: number;
  fileHash?: string;
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

  // RLS가 student_id = 본인 + status = pending을 강제한다
  const { error } = await supabase.from("submissions").insert({
    card_id: input.cardId,
    student_id: user.id,
    academy_id: academyId,
    grape_index: input.grapeIndex,
    video_path: input.path,
    video_size_bytes: input.fileSize,
    video_hash: input.fileHash ?? null,
  });
  if (error) {
    if (error.message.includes("submissions_unique_video_per_student")) {
      return { ok: false, error: "이미 올렸던 영상이에요! 새로 연습한 영상을 올려 주세요. 🎹" };
    }
    return { ok: false, error: "제출에 실패했어요. 다시 시도해 주세요." };
  }

  revalidatePath(`/me/cards/${input.cardId}`);
  revalidatePath("/teacher/review");
  return { ok: true, data: undefined };
}

/** 재생용 signed URL 발급 (1시간). RLS로 접근 가능한 제출물만 허용. */
export async function getPlaybackUrl(
  submissionId: string
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  // RLS: 학생은 자기 것, 선생님은 같은 학원 것만 조회된다
  const { data: submission } = await supabase
    .from("submissions")
    .select("video_path")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) return { ok: false, error: "영상을 찾을 수 없어요." };

  const admin = createSupabaseAdmin();
  const { data: signed, error } = await admin.storage
    .from("videos")
    .createSignedUrl(submission.video_path, 3600);
  if (error || !signed) return { ok: false, error: "영상 재생 준비에 실패했어요." };

  return { ok: true, data: { url: signed.signedUrl } };
}
