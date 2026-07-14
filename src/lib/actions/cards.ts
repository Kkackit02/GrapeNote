"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

/**
 * 진도카드 배정. studentIds에 여러 명을 넘기면 같은 카드를 공통 배정한다.
 * (학생별로 독립된 카드 행이 생성되어 각자 포도알을 채운다)
 */
export async function createCard(input: {
  studentIds: string[];
  title: string;
  description: string;
  totalGrapes: number;
}): Promise<ActionResult<{ count: number }>> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "곡 이름을 입력해 주세요." };
  if (!Number.isInteger(input.totalGrapes) || input.totalGrapes < 1 || input.totalGrapes > 60) {
    return { ok: false, error: "포도알 개수는 1~60개 사이여야 합니다." };
  }
  const studentIds = [...new Set(input.studentIds)];
  if (studentIds.length === 0) {
    return { ok: false, error: "학생을 한 명 이상 선택해 주세요." };
  }

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "선생님 계정으로 로그인해 주세요." };
  }
  const academyId = user.app_metadata.academy_id;

  // 선택한 학생이 전부 우리 학원 소속인지 검증 (RLS 조회는 학원 범위로 제한됨)
  const { data: members } = await supabase
    .from("profiles")
    .select("id")
    .in("id", studentIds)
    .eq("role", "student");
  if ((members ?? []).length !== studentIds.length) {
    return { ok: false, error: "우리 학원 학생이 아닌 대상이 포함되어 있습니다." };
  }

  const rows = studentIds.map((studentId) => ({
    academy_id: academyId,
    student_id: studentId,
    title,
    description: input.description.trim() || null,
    total_grapes: input.totalGrapes,
    created_by: user.id,
  }));
  const { error } = await supabase.from("progress_cards").insert(rows);
  if (error) return { ok: false, error: "카드 배정에 실패했습니다." };

  revalidatePath("/teacher");
  for (const id of studentIds) revalidatePath(`/teacher/students/${id}`);
  return { ok: true, data: { count: studentIds.length } };
}
