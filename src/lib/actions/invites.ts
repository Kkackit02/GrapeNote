"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { randomCode } from "@/lib/codes";
import type { ActionResult } from "@/lib/types";

/** 선생님이 학생 1명을 등록하고 개인 초대코드를 발급한다. */
export async function createInvite(
  studentName: string
): Promise<ActionResult<{ code: string }>> {
  const name = studentName.trim();
  if (!name) return { ok: false, error: "학생 이름을 입력해 주세요." };

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "선생님 계정으로 로그인해 주세요." };
  }

  // 코드 충돌 시 재시도 (RLS 하에서 insert — 학원 범위 자동 적용)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode("GRAPE");
    const { error } = await supabase.from("student_invites").insert({
      academy_id: user.app_metadata.academy_id,
      code,
      student_name: name,
      created_by: user.id,
    });
    if (!error) {
      revalidatePath("/teacher");
      return { ok: true, data: { code } };
    }
    if (!error.message.includes("duplicate")) {
      return { ok: false, error: "초대코드 발급에 실패했습니다." };
    }
  }
  return { ok: false, error: "초대코드 발급에 실패했습니다. 다시 시도해 주세요." };
}

/** 학원 공용(그룹) 초대코드 재발급 — 기존 코드는 즉시 무효화된다. */
export async function regenerateJoinCode(): Promise<ActionResult<{ code: string }>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "선생님 계정으로 로그인해 주세요." };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode("CLASS");
    const { data, error } = await supabase
      .from("academies")
      .update({ join_code: code })
      .eq("id", user.app_metadata.academy_id)
      .select("join_code")
      .maybeSingle();
    if (!error && data) {
      revalidatePath("/teacher");
      return { ok: true, data: { code } };
    }
    if (error && !error.message.includes("duplicate")) {
      return { ok: false, error: "코드 재발급에 실패했습니다." };
    }
  }
  return { ok: false, error: "코드 재발급에 실패했습니다. 다시 시도해 주세요." };
}
