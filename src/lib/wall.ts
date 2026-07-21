import { createSupabaseServer } from "@/lib/supabase/server";

/** 자랑 벽에 걸린 완성 포도송이 (get_group_wall) */
export interface WallCompletion {
  card_id: string;
  student_id: string;
  student_name: string;
  grape_skin: string;
  song_title: string;
  total_grapes: number;
  completed_at: string;
  shared_at: string;
}

/** 그룹이 걸어 둔 자랑 영상 (get_group_showcases) */
export interface Showcase {
  submission_id: string;
  student_id: string;
  student_name: string;
  grape_skin: string;
  song_title: string;
  grape_index: number;
  created_at: string;
}

/** 공유된 완성 포도송이 벽. RPC 미적용/실패 시 빈 배열. */
export async function getGroupWall(limit = 60): Promise<WallCompletion[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("get_group_wall", { p_limit: limit });
  if (error || !data) return [];
  return data as WallCompletion[];
}

/** 멤버들이 지금 걸어 둔 자랑 영상 목록. RPC 미적용/실패 시 빈 배열. */
export async function getGroupShowcases(): Promise<Showcase[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("get_group_showcases");
  if (error || !data) return [];
  return data as Showcase[];
}
