"use server";

import { randomUUID } from "crypto";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

const MAX_TRACK_BYTES = 20 * 1024 * 1024; // 버킷 설정과 동일
const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "ogg", "webm"];

/** 1단계: 곡 트랙(MR) 업로드 signed URL 발급. 버킷은 잠금 — 이 토큰만이 업로드 경로다. */
export async function requestTrackUpload(input: {
  songTitle: string;
  fileName: string;
  fileSize: number;
}): Promise<ActionResult<{ path: string; token: string; signedUrl: string }>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };
  const academyId = user.app_metadata?.academy_id;
  if (!academyId) return { ok: false, error: "그룹 정보를 찾을 수 없어요." };

  if (input.fileSize > MAX_TRACK_BYTES) {
    return { ok: false, error: "음원이 너무 커요 (최대 20MB)." };
  }
  const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!AUDIO_EXTENSIONS.includes(ext)) {
    return { ok: false, error: "오디오 파일만 올릴 수 있어요 (mp3, m4a, wav)." };
  }

  // 실제 있는 곡인지 확인 — RLS로 학생은 자기 곡, 선생님은 학원 전체 곡이 보인다
  const { data: cards } = await supabase
    .from("progress_cards")
    .select("id")
    .eq("title", input.songTitle.trim())
    .limit(1);
  if ((cards ?? []).length === 0) return { ok: false, error: "곡을 찾을 수 없어요." };

  const path = `${academyId}/tracks/${randomUUID()}.${ext}`;
  const admin = createSupabaseAdmin();
  const { data: signed, error } = await admin.storage
    .from("tracks")
    .createSignedUploadUrl(path);
  if (error || !signed) return { ok: false, error: "업로드 준비에 실패했어요. 다시 시도해 주세요." };

  return {
    ok: true,
    data: { path: signed.path, token: signed.token, signedUrl: signed.signedUrl },
  };
}

/** 2단계: 업로드 확인 후 트랙 등록. RLS insert 정책이 명의·학원·경로 접두사를 강제한다. */
export async function confirmTrackUpload(input: {
  songTitle: string;
  path: string;
  label?: string;
}): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };
  const academyId = user.app_metadata?.academy_id;

  if (!input.path.startsWith(`${academyId}/tracks/`)) {
    return { ok: false, error: "업로드 정보가 올바르지 않아요." };
  }

  const admin = createSupabaseAdmin();
  const { error: existsError } = await admin.storage
    .from("tracks")
    .createSignedUrl(input.path, 60);
  if (existsError) return { ok: false, error: "음원 업로드가 완료되지 않았어요. 다시 시도해 주세요." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false, error: "프로필을 찾을 수 없어요." };

  const { error } = await supabase.from("song_tracks").insert({
    academy_id: academyId,
    song_title: input.songTitle.trim(),
    uploaded_by: user.id,
    uploader_name: profile.display_name,
    uploader_role: profile.role,
    label: input.label?.trim().slice(0, 50) || null,
    file_path: input.path,
  });
  if (error) return { ok: false, error: "음원 등록에 실패했어요." };
  return { ok: true, data: undefined };
}

/** 트랙 삭제 — RLS가 (내 것 | 선생님)을 강제. 성공하면 스토리지 파일도 정리. */
export async function deleteTrack(trackId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const { data: deleted, error } = await supabase
    .from("song_tracks")
    .delete()
    .eq("id", trackId)
    .select("file_path");
  if (error || !deleted || deleted.length === 0) {
    return { ok: false, error: "삭제할 수 없어요. 본인이 올린 음원만 지울 수 있어요." };
  }

  const admin = createSupabaseAdmin();
  await admin.storage.from("tracks").remove([deleted[0].file_path]);
  return { ok: true, data: undefined };
}

/** 재생용 signed URL (1시간). RLS로 같은 학원 트랙만 조회된다. */
export async function getTrackUrl(trackId: string): Promise<ActionResult<{ url: string }>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const { data: track } = await supabase
    .from("song_tracks")
    .select("file_path")
    .eq("id", trackId)
    .maybeSingle();
  if (!track) return { ok: false, error: "음원을 찾을 수 없어요." };

  const admin = createSupabaseAdmin();
  const { data: signed, error } = await admin.storage
    .from("tracks")
    .createSignedUrl(track.file_path, 3600);
  if (error || !signed) return { ok: false, error: "음원 재생 준비에 실패했어요." };
  return { ok: true, data: { url: signed.signedUrl } };
}
