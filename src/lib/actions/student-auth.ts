"use server";

import { headers } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

const USERNAME_RE = /^[a-z0-9]{3,12}$/;
const PIN_RE = /^\d{6}$/;

/** 학생 가짜 이메일 도메인 — 실제 발송 없음, Supabase Auth 형식 요건용 */
const toEmail = (username: string) => `${username}@student.grapenote.app`;

/** 이름 마스킹: 김포도 → 김*도 (미인증 코드 검증에서 실명 원문 노출 방지) */
function maskName(name: string): string {
  const chars = [...name.trim()];
  if (chars.length <= 1) return name;
  if (chars.length === 2) return chars[0] + "*";
  return chars[0] + "*".repeat(chars.length - 2) + chars[chars.length - 1];
}

/**
 * IP 기반 rate limit. 한도 초과면 false.
 * DB 오류 시 fail-open (소규모 서비스 가용성 우선, 6자 코드+마스킹이 1차 방어).
 */
async function withinRateLimit(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.rpc("hit_rate_limit", {
      p_key: `${bucket}:${ip}`,
      p_limit: limit,
      p_window_seconds: windowSec,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}

export interface InviteInfo {
  /** personal: 선생님이 이름을 정해둔 개인 초대 / group: 학원 공용 코드 (이름 직접 입력) */
  type: "personal" | "group";
  /** 개인 초대는 마스킹된 이름 (예: 김*도), 그룹은 null */
  studentName: string | null;
  academyName: string;
}

/** 개인 초대코드(GRAPE-)와 학원 공용 코드(CLASS-) 모두 확인한다. */
export async function checkInvite(code: string): Promise<ActionResult<InviteInfo>> {
  if (!(await withinRateLimit("invite-check", 20, 60))) {
    return { ok: false, error: "잠시 후 다시 시도해 주세요." };
  }
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
      data: {
        type: "personal",
        studentName: maskName(invite.student_name),
        academyName: academy?.name ?? "",
      },
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
  if (!(await withinRateLimit("invite-register", 10, 60))) {
    return { ok: false, error: "잠시 후 다시 시도해 주세요." };
  }
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

  // 개인 초대는 계정 생성 후 원자적으로 소진한다 (used_at is null 조건).
  // 동시 요청이 같은 코드를 써도 한 명만 성공한다 (Finding 5).
  if (invite) {
    const { data: claimed } = await admin
      .from("student_invites")
      .update({ used_by: created.user.id, used_at: new Date().toISOString() })
      .eq("id", invite.id)
      .is("used_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) {
      await admin.auth.admin.deleteUser(created.user.id); // 보상: 경쟁에서 진 계정 제거
      return { ok: false, error: "방금 다른 사람이 사용한 초대코드예요. 선생님께 새 코드를 받아 주세요." };
    }
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    academy_id: academyId,
    role: "student",
    display_name: displayName,
    username,
  });
  if (profileError) {
    // 보상: 반쪽 계정 제거 + 소진했던 초대 되돌리기
    await admin.auth.admin.deleteUser(created.user.id);
    if (invite) {
      await admin
        .from("student_invites")
        .update({ used_by: null, used_at: null })
        .eq("id", invite.id);
    }
    return { ok: false, error: "가입에 실패했어요. 다시 시도해 주세요." };
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
