/** 그룹(학원) 단위 자원 한도. 그룹장이 프리미엄이면 상향된다. */

export interface GroupLimits {
  /** 그룹 전체 영상 저장 한도 */
  storageBytes: number;
  /** 판정(합격/재연습) 후 영상 파일 보존 일수 — 기록/코멘트는 영구 보존 */
  retentionDays: number;
  /** 영상 1개 최대 크기 */
  maxUploadBytes: number;
  /** 인앱 녹화 720p 허용 */
  hd: boolean;
}

export const FREE_LIMITS: GroupLimits = {
  // Supabase 무료 티어(스토리지 1GB)에 맞춘 그룹 한도.
  // 판정 후 1일 보존 + 인앱 촬영 전용으로 하루치(~500MB)만 상시 유지되는 구조.
  storageBytes: 1024 * 1024 * 1024, // 1GB
  // 판정 기록·코멘트는 영구 보존, 파일만 판정 후 1일 뒤 정리 (2026-07-20 결정)
  retentionDays: 1,
  maxUploadBytes: 50 * 1024 * 1024,
  hd: false,
};

export const PREMIUM_LIMITS: GroupLimits = {
  storageBytes: 5 * 1024 * 1024 * 1024, // 5GB
  retentionDays: 30,
  maxUploadBytes: 200 * 1024 * 1024, // 버킷 상한(0018)과 동일
  hd: true,
};

export function groupLimits(isPremium: boolean | null | undefined): GroupLimits {
  return isPremium ? PREMIUM_LIMITS : FREE_LIMITS;
}

/** 요금제 (결제 연동 전에는 안내용) */
export const PREMIUM_MONTHLY_PRICE = 6900;

/**
 * 프리미엄이 실제로 유효한지 — 구독 만료일(premium_until)이 지나면 자동으로 무료가 된다.
 * 만료일이 없으면 운영자가 수동으로 켠 것으로 보고 무기한 유지한다.
 */
export function isPremiumActive(academy: {
  is_premium?: boolean | null;
  premium_until?: string | null;
} | null | undefined): boolean {
  if (!academy?.is_premium) return false;
  if (!academy.premium_until) return true;
  return new Date(academy.premium_until).getTime() > Date.now();
}

/** 무료 보존 일수 — cron 정리의 기본값 */
export const FREE_RETENTION_DAYS = FREE_LIMITS.retentionDays;

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}
