"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

const STUDENT_EMAIL_DOMAIN = "@student.grapenote.app";

/**
 * 계정 연결 시도 제한 — 로그인한 사용자 기준.
 * 멤버 PIN이 숫자 6자리라, 제한이 없으면 연결 폼이 대입 공격 창구가 된다.
 * DB 오류 시엔 fail-open (소규모 서비스 가용성 우선).
 */
async function withinLinkRateLimit(userId: string): Promise<boolean> {
  try {
    const { data, error } = await createSupabaseAdmin().rpc("hit_rate_limit", {
      p_key: `link-account:${userId}`,
      p_limit: 5,
      p_window_seconds: 600,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}

/**
 * 같은 사람의 다른 역할 계정을 연결한다 (리더↔멤버).
 * 상대 계정의 로그인 자격을 증명해야만 연결된다 — 쿠키를 건드리지 않는 별도 클라이언트로 검증.
 * 리더가 걸면 아이디/PIN(멤버 계정), 멤버가 걸면 이메일/비밀번호(리더 계정)를 받는다.
 */
export async function linkAccount(input: {
  loginId: string;
  password: string;
}): Promise<ActionResult<{ name: string }>> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };
  const myRole = user.app_metadata?.role;
  const academyId = user.app_metadata?.academy_id as string | undefined;

  const loginId = input.loginId.trim().toLowerCase();
  if (!loginId || !input.password) {
    return { ok: false, error: "상대 계정 정보를 입력해 주세요." };
  }

  if (!(await withinLinkRateLimit(user.id))) {
    return { ok: false, error: "시도가 너무 많아요. 10분 뒤에 다시 시도해 주세요." };
  }

  // 리더가 연결하는 상대는 멤버(아이디), 멤버가 연결하는 상대는 리더(이메일)
  const email = myRole === "teacher" ? `${loginId}${STUDENT_EMAIL_DOMAIN}` : loginId;

  // 리더→멤버 경로는 비밀번호를 확인하기 전에 '우리 그룹 멤버인지'부터 본다.
  // (남의 그룹 계정으로 비밀번호가 맞는지 떠보는 걸 막는다)
  if (myRole === "teacher") {
    const { data: candidate } = await createSupabaseAdmin()
      .from("profiles")
      .select("id")
      .eq("username", loginId)
      .eq("academy_id", academyId ?? "")
      .maybeSingle();
    if (!candidate) {
      return { ok: false, error: "우리 그룹에 그런 아이디의 멤버가 없어요." };
    }
  }

  // 자격 검증 — 현재 세션 쿠키를 바꾸지 않는 임시 클라이언트로 로그인 시도
  const probe = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: signin, error: signErr } = await probe.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (signErr || !signin.user) {
    return { ok: false, error: "상대 계정의 아이디/비밀번호가 맞지 않아요." };
  }
  const targetId = signin.user.id;
  await probe.auth.signOut();

  if (targetId === user.id) return { ok: false, error: "지금 로그인한 계정과 같아요." };

  const admin = createSupabaseAdmin();
  const { data: target } = await admin
    .from("profiles")
    .select("id, display_name, academy_id")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return { ok: false, error: "상대 계정을 찾을 수 없어요." };
  if (target.academy_id !== academyId) {
    return { ok: false, error: "같은 그룹의 계정만 연결할 수 있어요." };
  }

  // 기존 연결을 양쪽 다 끊고 새로 잇는다.
  // 한쪽만 덮어쓰면 옛 상대의 포인터가 남아, 자격 증명 없이도 이쪽 계정으로
  // 전환할 수 있는 구멍이 된다 (권한 상승).
  await admin
    .from("profiles")
    .update({ linked_account_id: null })
    .in("linked_account_id", [user.id, targetId]);
  await admin
    .from("profiles")
    .update({ linked_account_id: null })
    .in("id", [user.id, targetId]);

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    admin.from("profiles").update({ linked_account_id: targetId }).eq("id", user.id),
    admin.from("profiles").update({ linked_account_id: user.id }).eq("id", targetId),
  ]);
  if (e1 || e2) return { ok: false, error: "계정 연결에 실패했어요." };

  revalidatePath("/teacher/settings");
  revalidatePath("/me");
  return { ok: true, data: { name: target.display_name } };
}

/** 계정 연결 해제 (양쪽 모두) */
export async function unlinkAccount(): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const admin = createSupabaseAdmin();
  const { data: me } = await admin
    .from("profiles")
    .select("linked_account_id")
    .eq("id", user.id)
    .maybeSingle();
  const otherId = me?.linked_account_id;

  await admin.from("profiles").update({ linked_account_id: null }).eq("id", user.id);
  if (otherId) {
    await admin.from("profiles").update({ linked_account_id: null }).eq("id", otherId);
  }

  revalidatePath("/teacher/settings");
  revalidatePath("/me");
  return { ok: true, data: undefined };
}

/**
 * 연결된 계정으로 전환할 준비 — 매직링크 토큰을 발급한다 (클라이언트가 세션을 교체).
 * 연결된 계정으로만 가능하므로(연결 시 자격 증명 완료) 안전하다.
 */
export async function switchAccount(): Promise<
  ActionResult<{ tokenHash: string; redirectTo: string }>
> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const admin = createSupabaseAdmin();
  const { data: me } = await admin
    .from("profiles")
    .select("linked_account_id")
    .eq("id", user.id)
    .maybeSingle();
  const targetId = me?.linked_account_id;
  if (!targetId) return { ok: false, error: "연결된 계정이 없어요." };

  const { data: target } = await admin
    .from("profiles")
    .select("id, role, academy_id, linked_account_id")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return { ok: false, error: "연결된 계정을 찾을 수 없어요." };
  // 상호 연결이어야 한다 — 한쪽만 가리키는 상태로는 전환할 수 없다
  if (target.linked_account_id !== user.id) {
    return { ok: false, error: "연결이 해제된 계정이에요. 다시 연결해 주세요." };
  }
  if (target.academy_id !== user.app_metadata?.academy_id) {
    return { ok: false, error: "같은 그룹의 계정만 전환할 수 있어요." };
  }

  const { data: targetUser } = await admin.auth.admin.getUserById(targetId);
  const email = targetUser.user?.email;
  if (!email) return { ok: false, error: "연결 계정 정보를 확인할 수 없어요." };

  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !link.properties?.hashed_token) {
    return { ok: false, error: "전환 준비에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }

  return {
    ok: true,
    data: {
      tokenHash: link.properties.hashed_token,
      redirectTo: target.role === "teacher" ? "/teacher" : "/me",
    },
  };
}
