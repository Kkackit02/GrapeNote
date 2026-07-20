/** KST 기준 날짜 문자열 (YYYY-MM-DD) */
function kstDay(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 연속 연습일 수 (KST 기준). 오늘 제출이 없어도 어제까지 이어졌다면 스트릭은 살아 있다.
 * (오늘 안 올렸다고 아침부터 0으로 보이면 억울하니까)
 */
export function calcStreak(submittedAt: string[], now: Date = new Date()): number {
  const days = new Set(submittedAt.map((iso) => kstDay(new Date(iso))));
  let cursor = now;
  if (!days.has(kstDay(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
    if (!days.has(kstDay(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(kstDay(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

/** 오늘(KST) 제출이 있는지 — 스트릭 배너 문구 분기용 */
export function practicedToday(submittedAt: string[], now: Date = new Date()): boolean {
  const today = kstDay(now);
  return submittedAt.some((iso) => kstDay(new Date(iso)) === today);
}
