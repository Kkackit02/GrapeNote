"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

const USERNAME_RE = /^[a-z0-9]{3,12}$/;
const PIN_RE = /^\d{6}$/;

/** 학생 가짜 이메일 도메인 — 실제 발송 없음, Supabase Auth 형식 요건용 */
const toEmail = (username: string) => `${username}@student.grapenote.app`;

export interface InviteInfo {
  /** personal: 선생님이 이름을 정해둔 개인 초대 / group: 학원 공용 코드 (이름 직접 입력) */
  type: "personal" | "group";
  studentName: string | null;
  academyName: string;
}

/** 개인 초대코드(GRAPE-)와 학원 공용 코드(CLASS-) 모두 확인한다. */
export async function checkInvite(code: string): Promise<ActionResult<InviteInfo>> {
  const normalized = code.trim().toUpperCase();
  const admin = createSupabaseAdmin();

  // 1) 개인 초대코드
  const { data: invite } = await admin
    .from("student_invites")
    .select("student_name, expires_at, used_at, academies(name)")
    .eq("code", normalized)
    .maybeSingle();
  if (invite) {
    if (invite.used_at) return { ok: false, error: "이미 사용된 초대코드예요." };
    if (new Date(invite.expires_at) < new Date()) {
      return { ok: false, error: "초대코드 기한이 지났어요. 선생님께 새 코드를 받아 주세요." };
    }
    const academy = invite.academies as unknown as { name: string } | null;
    return {
      ok: true,
      data: { type: "personal", studentName: invite.student_name, academyName: academy?.name ?? "" },
    };
  }

  // 2) 학원 공용(그룹) 코드
  const { data: academy } = await admin
    .from("academies")
    .select("name")
    .eq("join_code", normalized)
    .maybeSingle();
  if (academy) {
    return { ok: true, data: { type: "group", studentName: null, academyName: academy.name } };
  }

  return { ok: false, error: "초대코드를 찾을 수 없어요. 다시 확인해 주세요." };
}

/** 초대코드 검증 → 학생 계정 생성(가짜 이메일 + PIN) → 자동 로그인 */
export async function registerStudent(input: {
  code: string;
  username: string;
  pin: string;
  /** 그룹 코드로 가입할 때 학생이 직접 입력하는 이름 */
  studentName?: string;
}): Promise<ActionResult> {
  const code = input.code.trim().toUpperCase();
  const username = input.username.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: "아이디는 영어 소문자와 숫자로 3~12자여야 해요." };
  }
  if (!PIN_RE.test(input.pin)) {
    return { ok: false, error: "비밀번호는 숫자 6자리예요." };
  }

  const admin = createSupabaseAdmin();

  // 코드 해석: 개인 초대 우선, 없으면 그룹 코드
  const { data: invite } = await admin
    .from("student_invites")
    .select("id, academy_id, student_name, expires_at, used_at")
    .eq("code", code)
    .maybeSingle();

  let academyId: string;
  let displayName: string;
  if (invite) {
    if (invite.used_at || new Date(invite.expires_at) < new Date()) {
      return { ok: false, error: "초대코드가 유효하지 않아요." };
    }
    academyId = invite.academy_id;
    displayName = invite.student_name;
  } else {
    const { data: academy } = await admin
      .from("academies")
      .select("id")
      .eq("join_code", code)
      .maybeSingle();
    if (!academy) return { ok: false, error: "초대코드가 유효하지 않아요." };
    const name = input.studentName?.trim() ?? "";
    if (!name) return { ok: false, error: "이름을 입력해 주세요." };
    academyId = academy.id;
    displayName = name;
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) return { ok: false, error: "이미 사용 중인 아이디예요. 다른 아이디를 골라 주세요." };

  const email = toEmail(username);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: input.pin,
    email_confirm: true, // 확인 메일 발송 안 함
    app_metadata: { role: "student", academy_id: academyId },
  });
  if (createError || !created.user) {
    return { ok: false, error: "계정을 만들지 못했어요. 다른 아이디로 시도해 주세요." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    academy_id: academyId,
    role: "student",
    display_name: displayName,
    username,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id); // 보상: 반쪽 계정 제거
    return { ok: false, error: "가입에 실패했어요. 다시 시도해 주세요." };
  }

  if (invite) {
    await admin
      .from("student_invites")
      .update({ used_by: created.user.id, used_at: new Date().toISOString() })
      .eq("id", invite.id);
  }

  // 서버에서 바로 로그인 → 세션 쿠키 세팅
  const supabase = await createSupabaseServer();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: input.pin,
  });
  if (signInError) return { ok: false, error: "가입은 됐어요! 로그인 화면에서 로그인해 주세요." };

  return { ok: true, data: undefined };
}
