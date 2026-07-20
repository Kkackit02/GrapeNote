import Link from "next/link";
import { getWeeklyStats } from "@/lib/activity";
import { getTerms } from "@/lib/terms-server";
import { StatsTable, type StatsRow } from "@/components/StatsTable";

const QUIET_DAYS = 7;

/** 주간 통계: 멤버별 이번 주 제출/합격 + 오래 조용한 멤버 표시 */
export default async function WeeklyStatsPage() {
  const stats = await getWeeklyStats();
  const terms = await getTerms();
  const champion = stats.length > 0 && stats[0].submitted_week > 0 ? stats[0] : null;

  const rows: StatsRow[] = stats.map((stat) => ({
    studentId: stat.student_id,
    name: stat.student_name,
    submitted: stat.submitted_week,
    approved: stat.approved_week,
    lastSubmittedAt: stat.last_submitted_at,
    champion: champion?.student_id === stat.student_id,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">📈 주간 통계</h1>
        <p className="mt-1 text-sm text-gray-500">
          이번 주(월요일 시작) {terms.member}별 연습 현황이에요. {QUIET_DAYS}일 넘게 조용하면 💤로
          표시돼요.
        </p>
      </div>

      {champion && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          👑 이번 주 연습왕: <b>{champion.student_name}</b> — 연습 영상 {champion.submitted_week}개
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          아직 통계를 보여줄 수 없어요.
        </div>
      ) : (
        <StatsTable rows={rows} memberLabel={terms.member} quietDays={QUIET_DAYS} />
      )}
    </div>
  );
}
