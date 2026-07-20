/** 드라이브 백업 파일명 — cron 정리와 일괄 백업 액션이 함께 쓴다 */

const safeName = (value: string) => value.replace(/[\\/:*?"<>|]/g, " ").trim();

export function archiveFileName(input: {
  songTitle: string;
  memberName: string;
  grapeIndex: number;
  status: "approved" | "needs_retry";
  createdAt: string;
  reviewedAt: string | null;
  videoPath: string;
}): string {
  // 예: 2026-07-18제출_TOMBOY_정근녕_포도알3_합격(07-19).mp4
  const submitted = input.createdAt.slice(0, 10);
  const reviewed = (input.reviewedAt ?? "").slice(5, 10);
  const verdict = input.status === "approved" ? "합격" : "재연습";
  const ext = input.videoPath.split(".").pop() ?? "mp4";
  return `${submitted}제출_${safeName(input.songTitle)}_${safeName(input.memberName)}_포도알${
    input.grapeIndex
  }_${verdict}${reviewed ? `(${reviewed})` : ""}.${ext}`;
}
