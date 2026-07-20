"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createCard } from "@/lib/actions/cards";
import { instrumentEmoji, parseInstruments } from "@/lib/instruments";
import type { ActionResult, Profile, ProgressCard, Team } from "@/lib/types";

/** 선생님 권한 확인. 정상이면 { ok, academyId }, 아니면 에러 메시지. */
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

/**
 * 곡 추가 마법사: 곡 팀 생성 → 편성 멤버 소속 → 카드(미션 포함) 배정까지 한 번에.
 * 순서 중요 — 멤버를 먼저 넣고(카드가 아직 없어 자동 배정 트리거는 조용) 카드를 나중에
 * 만들어야 중복 카드가 생기지 않는다.
 */
export async function createSong(input: {
  title: string;
  /** 이 곡을 어떻게 연습할지 — 미션/연습 가이드 (카드 description으로 저장) */
  mission: string;
  memberIds: string[];
  totalGrapes: number;
  dueDate?: string | null;
}): Promise<ActionResult<{ count: number }>> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "곡 이름을 입력해 주세요." };
  const memberIds = [...new Set(input.memberIds)];
  if (memberIds.length === 0) {
    return { ok: false, error: "편성 멤버를 한 명 이상 골라 주세요." };
  }

  const auth = await verifyTeacher();
  if (!auth.ok) return auth;
  const supabase = await createSupabaseServer();

  // 같은 곡이 이미 있으면 마법사가 아니라 현황판 편성 수정으로
  const { data: existing } = await supabase
    .from("progress_cards")
    .select("id")
    .eq("title", title)
    .limit(1);
  if ((existing ?? []).length > 0) {
    return { ok: false, error: "이미 있는 곡이에요. 현황판에서 곡명을 눌러 편성을 수정해 주세요." };
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({ academy_id: auth.academyId, name: `🎵 ${title}` })
    .select("id")
    .single();
  if (teamError || !team) return { ok: false, error: "곡 팀 생성에 실패했습니다." };

  const { error: memberError } = await supabase.from("team_members").insert(
    memberIds.map((profileId) => ({
      team_id: team.id,
      profile_id: profileId,
      academy_id: auth.academyId,
    }))
  );
  if (memberError) {
    await supabase.from("teams").delete().eq("id", team.id);
    return { ok: false, error: "편성 멤버 추가에 실패했습니다." };
  }

  const created = await createCard({
    studentIds: memberIds,
    title,
    description: input.mission,
    totalGrapes: input.totalGrapes,
    dueDate: input.dueDate,
    teamId: team.id,
  });
  if (!created.ok) {
    await supabase.from("teams").delete().eq("id", team.id);
    return created;
  }

  revalidatePath("/teacher/board");
  revalidatePath("/teacher/teams");
  revalidatePath("/teacher");
  return { ok: true, data: { count: memberIds.length } };
}

/**
 * 현황판 편성 수정: 곡에 멤버를 넣고 뺀다.
 * 빼는 멤버의 카드는 제출 기록이 없을 때만 삭제 — 기록이 있으면 카드는 남긴다(이력 보존).
 */
export async function updateSongLineup(input: {
  title: string;
  addIds: string[];
  removeIds: string[];
}): Promise<ActionResult<{ added: number; removed: number; kept: number }>> {
  const auth = await verifyTeacher();
  if (!auth.ok) return auth;
  const supabase = await createSupabaseServer();
  const title = input.title.trim();

  const { data: templateRow } = await supabase
    .from("progress_cards")
    .select("*")
    .eq("title", title)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!templateRow) return { ok: false, error: "곡을 찾을 수 없습니다." };
  const template = templateRow as ProgressCard;

  const insertCardFrom = async (studentId: string) =>
    supabase.from("progress_cards").insert({
      academy_id: auth.academyId,
      student_id: studentId,
      team_id: template.team_id,
      title: template.title,
      description: template.description,
      total_grapes: template.total_grapes,
      due_date: template.due_date,
      created_by: template.created_by,
    });

  // 추가: 이미 이 곡 카드가 있는 멤버는 건너뛴다 (트리거 중복 생성 방지 포함)
  let added = 0;
  const addIds = [...new Set(input.addIds)];
  if (addIds.length > 0) {
    const { data: haveCards } = await supabase
      .from("progress_cards")
      .select("student_id")
      .eq("title", title)
      .in("student_id", addIds);
    const skip = new Set((haveCards ?? []).map((c) => c.student_id));
    for (const studentId of addIds.filter((id) => !skip.has(id))) {
      if (template.team_id) {
        // 팀 합류 → 트리거가 카드를 만든다
        const { error } = await supabase.from("team_members").insert({
          team_id: template.team_id,
          profile_id: studentId,
          academy_id: auth.academyId,
        });
        if (!error) {
          added++;
          continue;
        }
        if (!error.message.includes("duplicate")) continue;
        // 이미 팀원인데 카드만 없던 경우 → 아래에서 직접 생성
      }
      const { error: cardError } = await insertCardFrom(studentId);
      if (!cardError) added++;
    }
  }

  // 제외: 카드는 제출 기록 없을 때만 삭제, 곡 팀 소속과 파트장 자리는 정리
  let removed = 0;
  let kept = 0;
  for (const studentId of new Set(input.removeIds)) {
    const { data: cards } = await supabase
      .from("progress_cards")
      .select("id")
      .eq("title", title)
      .eq("student_id", studentId);
    for (const card of cards ?? []) {
      const { count } = await supabase
        .from("submissions")
        .select("*", { count: "exact", head: true })
        .eq("card_id", card.id);
      if ((count ?? 0) === 0) {
        const { error } = await supabase.from("progress_cards").delete().eq("id", card.id);
        if (!error) removed++;
      } else {
        kept++;
      }
    }
    if (template.team_id) {
      await supabase
        .from("team_members")
        .delete()
        .eq("team_id", template.team_id)
        .eq("profile_id", studentId);
      await supabase
        .from("teams")
        .update({ leader_id: null })
        .eq("id", template.team_id)
        .eq("leader_id", studentId);
    }
  }

  revalidatePath("/teacher/board");
  revalidatePath("/teacher/teams");
  revalidatePath("/teacher");
  return { ok: true, data: { added, removed, kept } };
}

/**
 * 악기 파트 팀 만들기: 악기가 지정된 멤버들을 "🎸 기타 파트" 같은 팀으로 묶는다.
 * 파트 팀에서 ⭐를 눌러 세션장을 지정하면 세션장이 같은 악기 멤버의 영상을 검토할 수 있다.
 * 파트 팀에는 숙제가 연결되지 않으므로 자동 배정 트리거는 조용하다.
 */
export async function createInstrumentTeams(): Promise<
  ActionResult<{ teams: number; added: number }>
> {
  const auth = await verifyTeacher();
  if (!auth.ok) return auth;
  const supabase = await createSupabaseServer();

  const [{ data: studentRows }, { data: teamRows }, { data: memberRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "student"),
    supabase.from("teams").select("*"),
    supabase.from("team_members").select("team_id, profile_id"),
  ]);
  const withInstrument = ((studentRows ?? []) as Profile[]).filter(
    (s) => parseInstruments(s.instrument).length > 0
  );
  if (withInstrument.length === 0) {
    return { ok: false, error: "악기가 지정된 멤버가 없어요. 학생 상세에서 악기부터 지정해 주세요." };
  }
  const teams = (teamRows ?? []) as Team[];
  const memberships = memberRows ?? [];

  let createdTeams = 0;
  let addedMembers = 0;
  // 겸업 멤버는 맡은 악기 파트마다 들어간다
  for (const instrument of [...new Set(withInstrument.flatMap((s) => parseInstruments(s.instrument)))]) {
    const name = `${instrumentEmoji(instrument)} ${instrument} 파트`;
    let team = teams.find((t) => t.name === name);
    if (!team) {
      const { data: createdTeam, error } = await supabase
        .from("teams")
        .insert({ academy_id: auth.academyId, name })
        .select("*")
        .single();
      if (error || !createdTeam) continue;
      team = createdTeam as Team;
      createdTeams++;
    }
    const existingIds = new Set(
      memberships.filter((m) => m.team_id === team.id).map((m) => m.profile_id)
    );
    const toAdd = withInstrument.filter(
      (s) => parseInstruments(s.instrument).includes(instrument) && !existingIds.has(s.id)
    );
    if (toAdd.length > 0) {
      const { error } = await supabase.from("team_members").insert(
        toAdd.map((s) => ({
          team_id: team.id,
          profile_id: s.id,
          academy_id: auth.academyId,
        }))
      );
      if (!error) addedMembers += toAdd.length;
    }
  }

  revalidatePath("/teacher/teams");
  revalidatePath("/teacher");
  return { ok: true, data: { teams: createdTeams, added: addedMembers } };
}
