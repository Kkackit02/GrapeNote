import { cache } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { DEFAULT_TERMS, TERMS, type GroupType, type Terms } from "@/lib/terms";

/**
 * 현재 사용자의 그룹 유형에 맞는 용어 세트 (요청당 1회 조회).
 * 0017 마이그레이션 전이거나 조회 실패 시 학원 프리셋으로 폴백한다.
 */
export const getTerms = cache(async (): Promise<Terms> => {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("academies").select("group_type").maybeSingle();
  const type = (data?.group_type as GroupType | undefined) ?? "academy";
  return TERMS[type] ?? DEFAULT_TERMS;
});
