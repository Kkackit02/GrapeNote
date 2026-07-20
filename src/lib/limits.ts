/** 그룹(학원) 단위 자원 한도. 프리미엄 도입 시 그룹별로 상향된다. */

/** 무료 그룹 영상 저장 한도 (판정 후 7일 자동 정리와 함께 무료 티어를 지킨다) */
export const FREE_GROUP_STORAGE_BYTES = 500 * 1024 * 1024; // 500MB

/** 판정(합격/재연습) 후 영상 파일 보존 기간 — 기록/코멘트는 영구 보존 */
export const FREE_RETENTION_DAYS = 7;

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}
