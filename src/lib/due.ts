/** 숙제 기한(YYYY-MM-DD) 표시용 유틸 */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** KST 기준 오늘 날짜를 YYYY-MM-DD로 (서버가 UTC여도 한국 날짜로 계산) */
export function todayString(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 기한까지 남은 일수. 오늘이 기한이면 0, 지났으면 음수. */
export function daysLeft(dueDate: string): number {
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const [ty, tm, td] = todayString().split("-").map(Number);
  const today = new Date(ty, tm - 1, td);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export interface DueBadge {
  text: string;
  className: string;
}

/** D-day 배지 문구/색상. 기한이 없으면 null. */
export function dueBadge(dueDate: string | null): DueBadge | null {
  if (!dueDate) return null;
  const left = daysLeft(dueDate);
  if (left < 0) return { text: "⏰ 기한 지남", className: "bg-red-100 text-red-600" };
  if (left === 0) return { text: "📅 오늘까지!", className: "bg-orange-100 text-orange-700" };
  if (left <= 3) return { text: `📅 D-${left}`, className: "bg-orange-100 text-orange-700" };
  return { text: `📅 D-${left}`, className: "bg-violet-100 text-violet-700" };
}

/** 기한을 "7월 20일 (월)"처럼 표시 */
export function formatDue(dueDate: string): string {
  const [y, m, d] = dueDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}
