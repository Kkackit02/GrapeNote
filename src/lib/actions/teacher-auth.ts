"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { randomCode } from "@/lib/codes";
import type { ActionResult } from "@/lib/types";

/**
 * 온보딩: 학원 생성 + 선생님 프로필 생성 + app_metadata(role/academy_id) 세팅.
 * 호출 후 클라이언트에서 refreshSession()으로 새 JWT를 받아야 한다.
 */
export async function createAcademy(formData: {
  academyName: string;
  displayName: string;
  /** 그룹 유형 — 화면 용어 프리셋의 기준 (academy/club/other) */
  groupType?: string;
}): Promise<ActionResult> {
  const academyName = formData.academyName.trim();
  const displayName = formData.displayName.trim();
  if (!academyName || !displayName) {
    return { ok: false, error: "그룹 이름과 내 이름을 입력해 주세요." };
  }
  const groupType = ["academy", "club", "other"].includes(formData.groupType ?? "")
    ? formData.groupType
    : "academy";

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (user.app_metadata?.academy_id) {
    return { ok: false, error: "이미 학원이 등록되어 있습니다." };
  }

  const admin = createSupabaseAdmin();
  const { data: academy, error: academyError } = await admin
    .from("academies")
    .insert({ name: academyName, owner_id: user.id, join_code: randomCode("CLASS") })
    .select("id")
    .single();
  if (academyError) return { ok: false, error: "그룹 생성에 실패했습니다." };

  // 그룹 유형 저장 — 0017 마이그레이션 전이면 조용히 실패해도 무방 (기본값 academy)
  await admin.from("academies").update({ group_type: groupType }).eq("id", academy.id);

  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    academy_id: academy.id,
    role: "teacher",
    display_name: displayName,
  });
  if (profileError) {
    await admin.from("academies").delete().eq("id", academy.id);
    return { ok: false, error: "프로필 생성에 실패했습니다." };
  }

  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { role: "teacher", academy_id: academy.id },
  });
  if (metaError) {
    await admin.from("profiles").delete().eq("id", user.id);
    await admin.from("academies").delete().eq("id", academy.id);
    return { ok: false, error: "계정 설정에 실패했습니다." };
  }

  return { ok: true, data: undefined };
}
