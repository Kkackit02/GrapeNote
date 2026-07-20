"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

const PIN_RE = /^\d{6}$/;

/** 선생님 권한 + 학생이 우리 학원 소속인지 검증. 문제 있으면 에러 메시지, 정상이면 null. */
async function verifyStudent(studentId: string): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return "선생님 계정으로 로그인해 주세요.";
  }
  const { data: student } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle();
  if (!student) return "학생을 찾을 수 없습니다.";
  return null;
}

/** 학생 PIN(비밀번호) 재설정 — 아이들이 까먹었을 때 */
export async function resetStudentPin(
  studentId: string,
  newPin: string
): Promise<ActionResult> {
  if (!PIN_RE.test(newPin)) return { ok: false, error: "PIN은 숫자 6자리여야 합니다." };

  const verifyError = await verifyStudent(studentId);
  if (verifyError) return { ok: false, error: verifyError };

  const admin = createSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(studentId, { password: newPin });
  if (error) return { ok: false, error: "PIN 재설정에 실패했습니다." };
  return { ok: true, data: undefined };
}

/** 학생 이름 수정 */
export async function renameStudent(
  studentId: string,
  name: string
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "이름을 입력해 주세요." };

  const verifyError = await verifyStudent(studentId);
  if (verifyError) return { ok: false, error: verifyError };

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ display_name: trimmed })
    .eq("id", studentId);
  if (error) return { ok: false, error: "이름 수정에 실패했습니다." };

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/teacher");
  return { ok: true, data: undefined };
}

/** 학생 악기(세션) 지정 — 쉼표 구분 다중 지정("기타, 드럼"), 첫 번째가 주 세션 */
export async function setStudentInstrument(
  studentId: string,
  instrument: string | null
): Promise<ActionResult> {
  const trimmed = instrument?.trim() || null;
  if (trimmed && trimmed.length > 80) {
    return { ok: false, error: "악기 목록이 너무 길어요." };
  }

  const verifyError = await verifyStudent(studentId);
  if (verifyError) return { ok: false, error: verifyError };

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ instrument: trimmed })
    .eq("id", studentId);
  if (error) return { ok: false, error: "악기 지정에 실패했습니다." };

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath("/teacher/teams");
  revalidatePath("/teacher");
  return { ok: true, data: undefined };
}

/** 학생 삭제 — 카드/영상/계정까지 전부 정리 (되돌릴 수 없음) */
export async function deleteStudent(studentId: string): Promise<ActionResult> {
  const verifyError = await verifyStudent(studentId);
  if (verifyError) return { ok: false, error: verifyError };

  const admin = createSupabaseAdmin();

  // 1) 스토리지 영상 정리 (경로는 submissions에 기록되어 있음)
  const { data: subs } = await admin
    .from("submissions")
    .select("video_path")
    .eq("student_id", studentId);
  const paths = (subs ?? []).map((s) => s.video_path).filter(Boolean);
  if (paths.length > 0) {
    await admin.storage.from("videos").remove(paths);
  }

  // 2) DB 정리 (FK 순서: submissions → cards → invite 참조 해제 → auth 유저)
  await admin.from("submissions").delete().eq("student_id", studentId);
  await admin.from("progress_cards").delete().eq("student_id", studentId);
  await admin.from("student_invites").update({ used_by: null }).eq("used_by", studentId);

  // 3) auth 유저 삭제 → profiles는 cascade로 함께 삭제
  const { error } = await admin.auth.admin.deleteUser(studentId);
  if (error) return { ok: false, error: "계정 삭제에 실패했습니다." };

  revalidatePath("/teacher");
  return { ok: true, data: undefined };
}
