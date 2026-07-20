export type UserRole = "teacher" | "student";
export type SubmissionStatus = "pending" | "approved" | "needs_retry";

export interface Academy {
  id: string;
  name: string;
  owner_id: string;
  join_code: string | null;
  /** 그룹 유형 — 화면 용어 프리셋의 기준 (0017) */
  group_type?: "academy" | "club" | "other";
  /** 멤버에게 읽기 전용 현황판 공개 (0018) */
  show_board?: boolean;
  /** 그룹 프리미엄 — 저장/보존/화질 상향 (0018, 운영자만 변경) */
  is_premium?: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  academy_id: string;
  role: UserRole;
  display_name: string;
  username: string | null;
  /** 맡은 악기(세션) — 곡 편성 그룹핑과 악기 파트 팀의 기준 */
  instrument: string | null;
  created_at: string;
}

/** 곡별 연습 트랙(MR/반주) — 곡 정체성은 (academy_id, song_title) */
export interface SongTrack {
  id: string;
  academy_id: string;
  song_title: string;
  uploaded_by: string;
  uploader_name: string;
  uploader_role: UserRole;
  label: string | null;
  file_path: string;
  created_at: string;
}

export interface Team {
  id: string;
  academy_id: string;
  name: string;
  leader_id: string | null;
  created_at: string;
}

/** 팀 다중 소속 (M:N) — 학생 1명이 여러 팀에 속할 수 있다 */
export interface TeamMember {
  team_id: string;
  profile_id: string;
  academy_id: string;
  added_at: string;
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
  /** 팀 숙제로 배정된 경우 그 팀. 새 팀원 합류 시 자동 배정의 기준이 된다. */
  team_id: string | null;
  title: string;
  description: string | null;
  total_grapes: number;
  due_date: string | null;
  completed_at: string | null;
  /** 본인이 "자랑하기"를 눌러 그룹에 공개한 시각 (0021) */
  shared_at?: string | null;
  /** 리더가 마감한 시각 — 멤버 화면에서 숨겨지고 제출 불가 (0023) */
  closed_at?: string | null;
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
  /** 정리 삭제 전 드라이브로 백업된 파일 id (0019) */
  drive_file_id?: string | null;
  created_at: string;
}

/** 서버 액션 공통 반환 형태 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
