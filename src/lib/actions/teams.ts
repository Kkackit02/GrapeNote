"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

/** 선생님 권한 확인. 정상이면 { userId, academyId }, 아니면 에러 메시지. */
async function verifyTeacher(): Promise<
  { ok: true; academyId: string } | { ok: false; error: string }
> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "선생님 계정으로 로그인해 주세요." };
  }
  return { ok: true, academyId: user.app_metadata.academy_id };
}

/** 팀 만들기 (예: "1팀", "2팀") */
export async function createTeam(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "팀 이름을 입력해 주세요." };

  const auth = await verifyTeacher();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("teams")
    .insert({ academy_id: auth.academyId, name: trimmed });
  if (error) return { ok: false, error: "팀 생성에 실패했습니다." };

  revalidatePath("/teacher/teams");
  return { ok: true, data: undefined };
}

/** 팀 이름 변경 */
export async function renameTeam(teamId: string, name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "팀 이름을 입력해 주세요." };

  const auth = await verifyTeacher();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("teams").update({ name: trimmed }).eq("id", teamId);
  if (error) return { ok: false, error: "팀 이름 변경에 실패했습니다." };

  revalidatePath("/teacher/teams");
  revalidatePath("/teacher");
  return { ok: true, data: undefined };
}

/** 팀 삭제 — 소속 정보(team_members)만 cascade로 정리되고 학생/카드는 그대로다 */
export async function deleteTeam(teamId: string): Promise<ActionResult> {
  const auth = await verifyTeacher();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) return { ok: false, error: "팀 삭제에 실패했습니다." };

  revalidatePath("/teacher/teams");
  revalidatePath("/teacher");
  return { ok: true, data: undefined };
}

/** 팀에 학생 추가 — 이미 다른 팀에 속해 있어도 그대로 두고 추가한다 (다중 소속). */
export async function addTeamMember(
  teamId: string,
  studentId: string
): Promise<ActionResult> {
  const auth = await verifyTeacher();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServer();

  // 우리 학원 학생/팀인지 확인 (RLS 조회는 학원 범위)
  const { data: student } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle();
  if (!student) return { ok: false, error: "학생을 찾을 수 없습니다." };
  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { ok: false, error: "팀을 찾을 수 없습니다." };

  const { error } = await supabase.from("team_members").insert({
    team_id: teamId,
    profile_id: studentId,
    academy_id: auth.academyId,
  });
  if (error && !error.message.includes("duplicate")) {
    return { ok: false, error: "팀원 추가에 실패했습니다." };
  }

  revalidatePath("/teacher/teams");
  revalidatePath("/teacher");
  return { ok: true, data: undefined };
}

/** 팀에서 학생 빼기 — 다른 팀 소속은 그대로 유지된다. */
export async function removeTeamMember(
  teamId: string,
  studentId: string
): Promise<ActionResult> {
  const auth = await verifyTeacher();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("profile_id", studentId);
  if (error) return { ok: false, error: "팀원 제외에 실패했습니다." };

  // 그 팀의 파트장이었다면 파트장 자리를 비운다
  await supabase
    .from("teams")
    .update({ leader_id: null })
    .eq("id", teamId)
    .eq("leader_id", studentId);

  revalidatePath("/teacher/teams");
  revalidatePath("/teacher");
  return { ok: true, data: undefined };
}

/** 파트장 지정/해제. 파트장은 팀원의 연습 영상을 검토(합격/재연습)할 수 있다. */
export async function setTeamLeader(
  teamId: string,
  studentId: string | null
): Promise<ActionResult> {
  const auth = await verifyTeacher();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServer();

  if (studentId) {
    // 파트장은 그 팀 소속 학생이어야 한다
    const { data: member } = await supabase
      .from("team_members")
      .select("profile_id")
      .eq("team_id", teamId)
      .eq("profile_id", studentId)
      .maybeSingle();
    if (!member) return { ok: false, error: "그 팀에 속한 학생만 파트장이 될 수 있어요." };
  }

  const { error } = await supabase
    .from("teams")
    .update({ leader_id: studentId })
    .eq("id", teamId);
  if (error) return { ok: false, error: "파트장 지정에 실패했습니다." };

  revalidatePath("/teacher/teams");
  revalidatePath("/me");
  return { ok: true, data: undefined };
}
