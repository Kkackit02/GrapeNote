import { createSupabaseServer } from "@/lib/supabase/server";

export interface FeedEvent {
  event_type: "card_completed" | "grape_approved";
  /** 리액션 앵커 — 0018 이전 RPC 응답에는 없을 수 있다 */
  target_kind?: "card" | "submission";
  target_id?: string;
  student_id: string;
  student_name: string;
  song_title: string;
  happened_at: string;
}

export interface FeedReaction {
  id: string;
  academy_id: string;
  target_kind: "card" | "submission";
  target_id: string;
  reactor_id: string;
  reactor_name: string;
  emoji: string;
  created_at: string;
}

export interface WeeklyStat {
  student_id: string;
  student_name: string;
  submitted_week: number;
  approved_week: number;
  last_submitted_at: string | null;
}

/** 그룹 활동 피드 (최근 완성·합격 소식). RPC 미적용/실패 시 빈 배열 — 화면에서 조용히 숨긴다. */
export async function getGroupFeed(): Promise<FeedEvent[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("get_group_feed", { p_days: 7, p_limit: 30 });
  if (error || !data) return [];
  return data as FeedEvent[];
}

/** 멤버별 이번 주(월요일 시작, KST) 제출/합격 통계. 제출 많은 순 정렬. */
export async function getWeeklyStats(): Promise<WeeklyStat[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("get_weekly_stats");
  if (error || !data) return [];
  return data as WeeklyStat[];
}

