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
 * 포도송이 배치: 위가 넓고 아래로 좁아지는 클러스터. 각 행의 알 개수를 반환한다.
 *
 * 예전에는 완전한 삼각형에서 남는 알을 그냥 잘라 붙여 [4,3,1]·[5,4,2]처럼
 * 줄이 갑자기 확 좁아지는 어색한 모양이 나왔다. 지금은 삼각형에서 시작해
 * "아래 줄보다 좁아지지 않게" 위쪽부터 한 알씩 덜어내, 어느 개수든 단이
 * 1씩만 줄어드는 자연스러운 송이가 된다. (예: 8알 → [3,2,2,1])
 */
export function bunchRows(totalGrapes: number): number[] {
  const n = Math.max(0, Math.floor(totalGrapes));
  if (n === 0) return [];

  // 단이 1씩 줄어드는 삼각형을 담을 수 있는 '최대' 줄 수를 고른다.
  // (최소 줄 수로 잡으면 남는 알을 덜어내느라 2알 폭의 탑처럼 길쭉해진다)
  const m = Math.max(1, Math.floor((Math.sqrt(8 * n + 1) - 1) / 2));

  // 맨 아랫줄 알 수 — 위로 갈수록 1씩 넓어진다
  const bottom = Math.floor((n - (m * (m - 1)) / 2) / m);
  const rows = Array.from({ length: m }, (_, i) => bottom + (m - 1 - i));

  // 남는 알은 아래쪽 줄부터 하나씩 얹는다 (단 차이가 최대 1이라 매끄럽다)
  let rem = n - rows.reduce((sum, count) => sum + count, 0);
  for (let i = m - 1; i >= 0 && rem > 0; i--, rem--) rows[i] += 1;

  return rows.filter((count) => count > 0);
}
