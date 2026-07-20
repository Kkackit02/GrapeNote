"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { deriveGrapes, isCardComplete } from "@/lib/grapes";
import { sendPushTo, groupMembersExcept } from "@/lib/push";
import { DATE_RE } from "@/lib/due";
import type { ActionResult, Submission } from "@/lib/types";

/** 카드 공통 입력 검증. 통과하면 정규화된 값, 실패하면 에러 메시지. */
function validateCardInput(input: {
  title: string;
  totalGrapes: number;
  dueDate?: string | null;
}):
  | { ok: true; title: string; dueDate: string | null }
  | { ok: false; error: string } {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "곡 이름을 입력해 주세요." };
  if (!Number.isInteger(input.totalGrapes) || input.totalGrapes < 1 || input.totalGrapes > 60) {
    return { ok: false, error: "포도알 개수는 1~60개 사이여야 합니다." };
  }
  const dueDate = input.dueDate?.trim() || null;
  if (dueDate && !DATE_RE.test(dueDate)) {
    return { ok: false, error: "기한 날짜 형식이 올바르지 않습니다." };
  }
  return { ok: true, title, dueDate };
}

/**
 * 진도카드 배정. studentIds에 여러 명을 넘기면 같은 카드를 공통 배정한다.
 * (학생별로 독립된 카드 행이 생성되어 각자 포도알을 채운다)
 */
export async function createCard(input: {
  studentIds: string[];
  title: string;
  description: string;
  totalGrapes: number;
  dueDate?: string | null;
  /** 팀 숙제로 배정 — 이후 이 팀에 새 멤버가 들어오면 자동으로 같은 카드를 받는다 */
  teamId?: string | null;
}): Promise<ActionResult<{ count: number }>> {
  const valid = validateCardInput(input);
  if (!valid.ok) return valid;
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

  // 팀 숙제라면 우리 학원 팀인지 검증
  let teamId: string | null = null;
  if (input.teamId) {
    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("id", input.teamId)
      .maybeSingle();
    if (!team) return { ok: false, error: "팀을 찾을 수 없습니다." };
    teamId = team.id;
  }

  const rows = studentIds.map((studentId) => ({
    academy_id: academyId,
    student_id: studentId,
    team_id: teamId,
    title: valid.title,
    description: input.description.trim() || null,
    total_grapes: input.totalGrapes,
    due_date: valid.dueDate,
    created_by: user.id,
  }));
  const { error } = await supabase.from("progress_cards").insert(rows);
  if (error) return { ok: false, error: "카드 배정에 실패했습니다." };

  revalidatePath("/teacher");
  revalidatePath("/teacher/cards");
  for (const id of studentIds) revalidatePath(`/teacher/students/${id}`);
  return { ok: true, data: { count: studentIds.length } };
}

/**
 * 현황판 빈칸 배정: 기존 곡을 학생 1명에게 배정한다.
 * 곡이 팀에 연결되어 있으면 팀 합류로 처리 (트리거가 카드 생성 + 팀 명단도 일치).
 */
export async function assignSongToStudent(input: {
  title: string;
  studentId: string;
}): Promise<ActionResult<{ viaTeam: boolean }>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "선생님 계정으로 로그인해 주세요." };
  }
  const academyId = user.app_metadata.academy_id;

  // 곡 템플릿 = 그 제목의 최신 카드 (RLS로 우리 학원 것만 조회됨)
  const { data: template } = await supabase
    .from("progress_cards")
    .select("*")
    .eq("title", input.title)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!template) return { ok: false, error: "곡을 찾을 수 없습니다." };

  const { data: student } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", input.studentId)
    .eq("role", "student")
    .maybeSingle();
  if (!student) return { ok: false, error: "학생을 찾을 수 없습니다." };

  const { data: existing } = await supabase
    .from("progress_cards")
    .select("id")
    .eq("student_id", input.studentId)
    .eq("title", input.title)
    .limit(1);
  if ((existing ?? []).length > 0) {
    return { ok: false, error: "이미 이 곡이 배정되어 있어요." };
  }

  const finish = (viaTeam: boolean): ActionResult<{ viaTeam: boolean }> => {
    revalidatePath("/teacher/board");
    revalidatePath("/teacher/teams");
    revalidatePath(`/teacher/students/${input.studentId}`);
    return { ok: true, data: { viaTeam } };
  };

  // 팀 곡이면 팀 합류 → 트리거가 카드를 만든다
  if (template.team_id) {
    const { error } = await supabase.from("team_members").insert({
      team_id: template.team_id,
      profile_id: input.studentId,
      academy_id: academyId,
    });
    if (!error) return finish(true);
    if (!error.message.includes("duplicate")) {
      return { ok: false, error: "배정에 실패했습니다." };
    }
    // 이미 팀원인데 카드만 없는 경우 → 아래에서 직접 생성
  }

  const { error: insertError } = await supabase.from("progress_cards").insert({
    academy_id: academyId,
    student_id: input.studentId,
    team_id: template.team_id,
    title: template.title,
    description: template.description,
    total_grapes: template.total_grapes,
    due_date: template.due_date,
    created_by: user.id,
  });
  if (insertError) return { ok: false, error: "배정에 실패했습니다." };
  return finish(false);
}

/** 현황판/관리 화면에서 카드의 횟수(포도알)·조언(지시사항)을 수정한다. */
export async function updateCardSettings(input: {
  cardId: string;
  totalGrapes: number;
  description: string;
}): Promise<ActionResult> {
  if (!Number.isInteger(input.totalGrapes) || input.totalGrapes < 1 || input.totalGrapes > 60) {
    return { ok: false, error: "포도알 개수는 1~60개 사이여야 합니다." };
  }

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "선생님 계정으로 로그인해 주세요." };
  }

  const { data: card } = await supabase
    .from("progress_cards")
    .select("id, student_id, total_grapes, completed_at")
    .eq("id", input.cardId)
    .maybeSingle();
  if (!card) return { ok: false, error: "카드를 찾을 수 없습니다." };

  // 이미 제출 기록이 있는 포도알보다 작게 줄일 수 없다 (기록 은닉 방지)
  const { data: subs } = await supabase
    .from("submissions")
    .select("*")
    .eq("card_id", input.cardId);
  const subList = (subs ?? []) as Submission[];
  const maxIndex = subList.reduce((max, s) => Math.max(max, s.grape_index), 0);
  if (input.totalGrapes < maxIndex) {
    return {
      ok: false,
      error: `${maxIndex}번 포도알까지 제출 기록이 있어서 ${maxIndex}개 밑으로 줄일 수 없어요.`,
    };
  }

  // 횟수가 바뀌면 완성 상태도 다시 계산 (늘리면 완성 해제, 딱 맞으면 완성)
  const grapes = deriveGrapes(input.totalGrapes, subList);
  const nowComplete = isCardComplete(grapes);
  const { error } = await supabase
    .from("progress_cards")
    .update({
      total_grapes: input.totalGrapes,
      description: input.description.trim() || null,
      completed_at: nowComplete
        ? (card.completed_at ?? new Date().toISOString())
        : null,
    })
    .eq("id", input.cardId);
  if (error) return { ok: false, error: "수정에 실패했습니다." };

  revalidatePath("/teacher/board");
  revalidatePath("/teacher/cards");
  revalidatePath(`/teacher/cards/${input.cardId}`);
  revalidatePath(`/teacher/students/${card.student_id}`);
  revalidatePath("/me");
  revalidatePath(`/me/cards/${input.cardId}`);
  return { ok: true, data: undefined };
}

/**
 * 완성한 포도송이를 그룹에 자랑한다 (본인만, 완성한 카드만, 한 번만).
 * 이걸 누르기 전까지 완성 사실은 그룹 피드·알림에 올라가지 않는다.
 */
export async function shareCompletion(cardId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const { data: card } = await supabase
    .from("progress_cards")
    .select("id, title, student_id, academy_id, completed_at, shared_at")
    .eq("id", cardId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!card) return { ok: false, error: "카드를 찾을 수 없어요." };

  // 공개는 share_completion RPC로만 처리한다. 함수(security definer)가 소유권·완성 여부·
  // 중복 공개를 DB 레벨에서 강제하므로, 학생이 카드의 다른 컬럼(완성 여부 등)을 조작할 수 없다.
  const { error } = await supabase.rpc("share_completion", { p_card_id: cardId });
  if (error) {
    if (error.message.includes("not completed")) {
      return { ok: false, error: "아직 완성하지 않은 포도송이예요." };
    }
    if (error.message.includes("already shared")) {
      return { ok: false, error: "이미 자랑했어요! 🎉" };
    }
    return { ok: false, error: "자랑하기에 실패했어요." };
  }

  // 그룹에 알림 (실패해도 공개 자체는 성공)
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    const others = await groupMembersExcept(card.academy_id, user.id);
    await sendPushTo(others, {
      title: "🎉 포도송이 완성!",
      body: `${profile?.display_name ?? "멤버"} 님이 「${card.title}」를 완성했어요!`,
      url: "/me",
      tag: `completed-${cardId}`,
    });
  } catch {
    // 무시
  }

  revalidatePath("/me");
  revalidatePath(`/me/cards/${cardId}`);
  revalidatePath("/me/vineyard");
  return { ok: true, data: undefined };
}

/** 학생이 자기 숙제(진도카드)를 직접 추가. RLS가 본인 카드 insert만 허용한다. */
export async function createMyCard(input: {
  title: string;
  description: string;
  totalGrapes: number;
  dueDate?: string | null;
}): Promise<ActionResult> {
  const valid = validateCardInput(input);
  if (!valid.ok) return valid;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "student") {
    return { ok: false, error: "학생 계정으로 로그인해 주세요." };
  }

  const { error } = await supabase.from("progress_cards").insert({
    academy_id: user.app_metadata.academy_id,
    student_id: user.id,
    title: valid.title,
    description: input.description.trim() || null,
    total_grapes: input.totalGrapes,
    due_date: valid.dueDate,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "숙제 추가에 실패했습니다." };

  revalidatePath("/me");
  revalidatePath("/teacher/cards");
  return { ok: true, data: undefined };
}

/** 숙제(진도카드) 수정 — 선생님 전용. 제목/지시사항/포도알 개수/기한을 바꾼다. */
export async function updateCard(input: {
  cardId: string;
  title: string;
  description: string;
  totalGrapes: number;
  dueDate?: string | null;
}): Promise<ActionResult> {
  const valid = validateCardInput(input);
  if (!valid.ok) return valid;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "선생님 계정으로 로그인해 주세요." };
  }

  // RLS: 같은 학원 카드만 조회/수정 가능
  const { data: card } = await supabase
    .from("progress_cards")
    .select("id, student_id, completed_at")
    .eq("id", input.cardId)
    .maybeSingle();
  if (!card) return { ok: false, error: "카드를 찾을 수 없습니다." };

  const { data: subs } = await supabase
    .from("submissions")
    .select("*")
    .eq("card_id", input.cardId);
  const subList = (subs ?? []) as Submission[];

  // 이미 제출(합격/검토 대기)이 붙은 포도알보다 작게 줄이면 이력이 사라져 보이므로 막는다
  const maxUsed = Math.max(
    0,
    ...subList
      .filter((s) => s.status === "approved" || s.status === "pending")
      .map((s) => s.grape_index)
  );
  if (input.totalGrapes < maxUsed) {
    return {
      ok: false,
      error: `이미 ${maxUsed}번 포도알까지 영상이 있어요. 포도알은 ${maxUsed}개보다 적게 줄일 수 없습니다.`,
    };
  }

  // 포도알 개수가 바뀌면 완성 여부를 다시 계산한다 (완성작을 늘리면 다시 진행 중으로)
  const grapes = deriveGrapes(input.totalGrapes, subList);
  const completedAt = isCardComplete(grapes)
    ? card.completed_at ?? new Date().toISOString()
    : null;

  const { error } = await supabase
    .from("progress_cards")
    .update({
      title: valid.title,
      description: input.description.trim() || null,
      total_grapes: input.totalGrapes,
      due_date: valid.dueDate,
      completed_at: completedAt,
    })
    .eq("id", input.cardId);
  if (error) return { ok: false, error: "카드 수정에 실패했습니다." };

  revalidatePath("/teacher/cards");
  revalidatePath(`/teacher/cards/${input.cardId}`);
  revalidatePath(`/teacher/students/${card.student_id}`);
  revalidatePath("/me");
  revalidatePath(`/me/cards/${input.cardId}`);
  return { ok: true, data: undefined };
}

/** 숙제(진도카드) 삭제 — 선생님 전용. 제출 이력과 영상 파일까지 함께 정리한다. */
export async function deleteCard(cardId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return { ok: false, error: "선생님 계정으로 로그인해 주세요." };
  }

  // RLS: 같은 학원 카드만 보인다 → 다른 학원 카드는 여기서 걸러짐
  const { data: card } = await supabase
    .from("progress_cards")
    .select("id, student_id")
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return { ok: false, error: "카드를 찾을 수 없습니다." };

  // 스토리지 영상 정리 (submissions 행은 카드 삭제 시 cascade로 함께 삭제됨)
  const admin = createSupabaseAdmin();
  const { data: subs } = await admin
    .from("submissions")
    .select("video_path")
    .eq("card_id", cardId)
    .is("video_deleted_at", null);
  const paths = (subs ?? []).map((s) => s.video_path).filter(Boolean);
  if (paths.length > 0) {
    await admin.storage.from("videos").remove(paths);
  }

  const { error } = await supabase.from("progress_cards").delete().eq("id", cardId);
  if (error) return { ok: false, error: "카드 삭제에 실패했습니다." };

  revalidatePath("/teacher/cards");
  revalidatePath(`/teacher/students/${card.student_id}`);
  revalidatePath("/me");
  return { ok: true, data: undefined };
}
