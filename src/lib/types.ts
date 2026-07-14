export type UserRole = "teacher" | "student";
export type SubmissionStatus = "pending" | "approved" | "needs_retry";

export interface Academy {
  id: string;
  name: string;
  owner_id: string;
  join_code: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  academy_id: string;
  role: UserRole;
  display_name: string;
  username: string | null;
  created_at: string;
}

export interface StudentInvite {
  id: string;
  academy_id: string;
  code: string;
  student_name: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface ProgressCard {
  id: string;
  academy_id: string;
  student_id: string;
  title: string;
  description: string | null;
  total_grapes: number;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

export interface Submission {
  id: string;
  card_id: string;
  student_id: string;
  academy_id: string;
  grape_index: number;
  video_path: string;
  video_size_bytes: number | null;
  video_hash: string | null;
  status: SubmissionStatus;
  student_title: string | null;
  student_comment: string | null;
  teacher_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  video_deleted_at: string | null;
  created_at: string;
}

/** 서버 액션 공통 반환 형태 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
