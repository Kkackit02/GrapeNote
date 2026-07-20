/**
 * 그룹 유형별 화면 용어 프리셋.
 * DB 스키마(academies, teacher role 등)는 그대로 두고 화면 표기만 바꾼다.
 * 클라이언트에서도 쓸 수 있는 순수 모듈 — 서버 조회는 lib/terms-server.ts.
 */

export type GroupType = "academy" | "club" | "other";

export interface Terms {
  type: GroupType;
  /** 그룹 호칭: 학원 / 동아리 / 그룹 */
  group: string;
  groupEmoji: string;
  /** 검토자 호칭: 선생님 / 운영진 / 리더 */
  leader: string;
  leaderEmoji: string;
  /** 구성원 호칭: 학생 / 멤버 / 멤버 */
  member: string;
  memberEmoji: string;
}

export const TERMS: Record<GroupType, Terms> = {
  academy: {
    type: "academy",
    group: "학원",
    groupEmoji: "🏫",
    leader: "선생님",
    leaderEmoji: "🧑‍🏫",
    member: "학생",
    memberEmoji: "🎹",
  },
  club: {
    type: "club",
    group: "동아리",
    groupEmoji: "🎸",
    leader: "운영진",
    leaderEmoji: "🎩",
    member: "멤버",
    memberEmoji: "🎸",
  },
  other: {
    type: "other",
    group: "그룹",
    groupEmoji: "🎵",
    leader: "리더",
    leaderEmoji: "⭐",
    member: "멤버",
    memberEmoji: "🎵",
  },
};

export const DEFAULT_TERMS = TERMS.academy;
