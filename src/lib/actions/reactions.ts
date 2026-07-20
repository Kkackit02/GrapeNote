"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const EMOJIS = ["🔥", "👏", "🎉", "💜"];

/** 피드 이벤트에 응원 이모지를 달거나 뗀다 (토글). RLS가 그룹·명의를 강제한다. */
export async function toggleReaction(input: {
  targetKind: "card" | "submission";
  targetId: string;
  emoji: string;
}): Promise<ActionResult<{ on: boolean }>> {
  if (!EMOJIS.includes(input.emoji)) return { ok: false, error: "지원하지 않는 이모지예요." };

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const { data: existing } = await supabase
    .from("feed_reactions")
    .select("id")
    .eq("target_kind", input.targetKind)
    .eq("target_id", input.targetId)
    .eq("reactor_id", user.id)
    .eq("emoji", input.emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("feed_reactions").delete().eq("id", existing.id);
    if (error) return { ok: false, error: "응원 취소에 실패했어요." };
    revalidatePath("/me");
    return { ok: true, data: { on: false } };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, academy_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false, error: "프로필을 찾을 수 없어요." };

  const { error } = await supabase.from("feed_reactions").insert({
    academy_id: profile.academy_id,
    target_kind: input.targetKind,
    target_id: input.targetId,
    reactor_id: user.id,
    reactor_name: profile.display_name,
    emoji: input.emoji,
  });
  if (error) return { ok: false, error: "응원에 실패했어요." };

  revalidatePath("/me");
  return { ok: true, data: { on: true } };
}
