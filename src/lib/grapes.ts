import type { Submission, SubmissionStatus } from "./types";

export type GrapeStatus = "empty" | "pending" | "approved" | "retry";

export interface GrapeState {
  index: number; // 1-based
  status: GrapeStatus;
  /** 이 포도알의 제출 이력 (최신순) */
  history: Submission[];
}

type SubLite = Pick<Submission, "grape_index" | "status" | "created_at">;

/**
 * submissions 행들로부터 포도알 상태를 유도한다.
 * - approved가 존재하면 approved (종결 상태)
 * - 아니면 최신 제출이 pending → pending, needs_retry → retry
 * - 제출이 없으면 empty
 */
export function deriveGrapes(totalGrapes: number, submissions: Submission[]): GrapeState[] {
  const byIndex = new Map<number, Submission[]>();
  for (const sub of submissions) {
    const list = byIndex.get(sub.grape_index) ?? [];
    list.push(sub);
    byIndex.set(sub.grape_index, list);
  }

  const grapes: GrapeState[] = [];
  for (let i = 1; i <= totalGrapes; i++) {
    const history = (byIndex.get(i) ?? []).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    grapes.push({ index: i, status: statusOf(history), history });
  }
  return grapes;
}

function statusOf(historyDesc: SubLite[]): GrapeStatus {
  if (historyDesc.length === 0) return "empty";
  if (historyDesc.some((s) => s.status === "approved")) return "approved";
  const latest: SubmissionStatus = historyDesc[0].status;
  return latest === "pending" ? "pending" : "retry";
}

export function approvedCount(grapes: GrapeState[]): number {
  return grapes.filter((g) => g.status === "approved").length;
}

export function isCardComplete(grapes: GrapeState[]): boolean {
  return grapes.length > 0 && grapes.every((g) => g.status === "approved");
}

/**
 * 포도송이 배치: 위가 넓고 아래로 좁아지는 역삼각형 클러스터.
 * 각 행의 알 개수를 반환한다. 예: 10알 → [4, 3, 2, 1]
 */
export function bunchRows(totalGrapes: number): number[] {
  // k(k+1)/2 >= N 을 만족하는 최소 k에서 시작해 1까지 감소
  const k = Math.ceil((Math.sqrt(8 * totalGrapes + 1) - 1) / 2);
  const rows: number[] = [];
  let remaining = totalGrapes;
  for (let w = k; w >= 1 && remaining > 0; w--) {
    const take = Math.min(w, remaining);
    rows.push(take);
    remaining -= take;
  }
  return rows;
}
