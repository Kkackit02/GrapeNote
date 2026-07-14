import { describe, it, expect } from "vitest";
import { deriveGrapes, approvedCount, isCardComplete, bunchRows } from "./grapes";
import type { Submission } from "./types";

let seq = 0;
function sub(grapeIndex: number, status: Submission["status"], createdAt?: string): Submission {
  seq += 1;
  return {
    id: `sub-${seq}`,
    card_id: "card-1",
    student_id: "student-1",
    academy_id: "academy-1",
    grape_index: grapeIndex,
    video_path: `path/${seq}.mp4`,
    video_size_bytes: 1000,
    video_hash: null,
    status,
    student_title: null,
    student_comment: null,
    teacher_comment: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: createdAt ?? new Date(2026, 0, 1, 0, 0, seq).toISOString(),
  };
}

describe("deriveGrapes", () => {
  it("제출이 없으면 전부 empty", () => {
    const grapes = deriveGrapes(5, []);
    expect(grapes).toHaveLength(5);
    expect(grapes.every((g) => g.status === "empty")).toBe(true);
    expect(grapes[0].index).toBe(1);
  });

  it("pending 제출은 검토 대기", () => {
    const grapes = deriveGrapes(3, [sub(2, "pending")]);
    expect(grapes.map((g) => g.status)).toEqual(["empty", "pending", "empty"]);
  });

  it("approved는 종결 상태 — 이후 이력이 있어도 approved 유지", () => {
    const grapes = deriveGrapes(1, [sub(1, "approved"), sub(1, "needs_retry")]);
    expect(grapes[0].status).toBe("approved");
  });

  it("재연습 판정 후 재제출하면 다시 pending", () => {
    const grapes = deriveGrapes(1, [
      sub(1, "needs_retry", "2026-01-01T10:00:00Z"),
      sub(1, "pending", "2026-01-02T10:00:00Z"),
    ]);
    expect(grapes[0].status).toBe("pending");
  });

  it("최신 제출이 needs_retry면 retry (다시 도전 가능)", () => {
    const grapes = deriveGrapes(1, [sub(1, "needs_retry")]);
    expect(grapes[0].status).toBe("retry");
  });

  it("이력은 최신순으로 정렬되고 전부 보존된다", () => {
    const first = sub(1, "needs_retry", "2026-01-01T10:00:00Z");
    const second = sub(1, "approved", "2026-01-03T10:00:00Z");
    const grapes = deriveGrapes(1, [first, second]);
    expect(grapes[0].history.map((s) => s.id)).toEqual([second.id, first.id]);
  });
});

describe("approvedCount / isCardComplete", () => {
  it("합격 개수를 센다", () => {
    const grapes = deriveGrapes(3, [sub(1, "approved"), sub(2, "pending")]);
    expect(approvedCount(grapes)).toBe(1);
    expect(isCardComplete(grapes)).toBe(false);
  });

  it("전부 합격이면 완성", () => {
    const grapes = deriveGrapes(2, [sub(1, "approved"), sub(2, "approved")]);
    expect(isCardComplete(grapes)).toBe(true);
  });

  it("빈 카드는 완성이 아니다", () => {
    expect(isCardComplete([])).toBe(false);
  });
});

describe("bunchRows", () => {
  it("총합이 포도알 개수와 같다", () => {
    for (const n of [1, 5, 10, 30, 60]) {
      const rows = bunchRows(n);
      expect(rows.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  it("위가 넓고 아래로 좁아진다 (비증가)", () => {
    for (const n of [7, 10, 30]) {
      const rows = bunchRows(n);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]).toBeLessThanOrEqual(rows[i - 1]);
      }
    }
  });

  it("10알은 4-3-2-1 형태", () => {
    expect(bunchRows(10)).toEqual([4, 3, 2, 1]);
  });
});
