import { createSupabaseServer } from "@/lib/supabase/server";

export interface FeedEvent {
  event_type: "card_completed" | "grape_approved";
  student_id: string;
  student_name: string;
  song_title: string;
  happened_at: string;
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

/** "3분 전", "2시간 전", "5일 전" 식의 상대 시각 (타임존 무관이라 SSR 안전) */
export function formatAgo(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}
