"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { sendPushTo } from "@/lib/push";
import type { ActionResult } from "@/lib/types";

/** 브라우저 푸시 구독 저장 (같은 endpoint면 갱신) */
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      academy_id: user.app_metadata?.academy_id,
      profile_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) return { ok: false, error: "알림 설정 저장에 실패했어요." };
  return { ok: true, data: undefined };
}

/** 이 기기의 구독 해제 */
export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) return { ok: false, error: "알림 해제에 실패했어요." };
  return { ok: true, data: undefined };
}

/** 설정이 잘 됐는지 본인에게 테스트 알림 */
export async function sendTestPush(): Promise<ActionResult> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const sent = await sendPushTo([user.id], {
    title: "GrapeNote 🍇",
    body: "알림이 잘 도착했어요! 이제 소식을 놓치지 않아요.",
    url: user.app_metadata?.role === "teacher" ? "/teacher" : "/me",
    tag: "test",
  });
  if (sent === 0) {
    return { ok: false, error: "알림을 보내지 못했어요. 알림을 켠 뒤 다시 시도해 주세요." };
  }
  return { ok: true, data: undefined };
}
