import Link from "next/link";
import { getWeeklyStats } from "@/lib/activity";
import { getTerms } from "@/lib/terms-server";
import { formatAgo } from "@/lib/time";

const QUIET_DAYS = 7;

/** 주간 통계: 멤버별 이번 주 제출/합격 + 오래 조용한 멤버 표시 */
export default async function WeeklyStatsPage() {
  const stats = await getWeeklyStats();
  const terms = await getTerms();
  const now = new Date();
  const isQuiet = (last: string | null) =>
    !last || now.getTime() - new Date(last).getTime() > QUIET_DAYS * 24 * 60 * 60 * 1000;
  const champion = stats.length > 0 && stats[0].submitted_week > 0 ? stats[0] : null;
  const quietCount = stats.filter((s) => isQuiet(s.last_submitted_at)).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">📈 주간 통계</h1>
        <p className="mt-1 text-sm text-gray-500">
          이번 주(월요일 시작) {terms.member}별 연습 현황이에요.
          {quietCount > 0 && ` ${QUIET_DAYS}일 넘게 조용한 ${terms.member}가 ${quietCount}명 있어요.`}
        </p>
      </div>

      {champion && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          👑 이번 주 연습왕: <b>{champion.student_name}</b> — 연습 영상 {champion.submitted_week}개
        </div>
      )}

      {stats.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          아직 통계를 보여줄 수 없어요.
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-violet-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-violet-50">
                <th className="px-4 py-2.5 font-bold">{terms.member}</th>
                <th className="px-2 py-2.5 font-bold text-center">이번 주 영상</th>
                <th className="px-2 py-2.5 font-bold text-center">이번 주 합격</th>
                <th className="px-4 py-2.5 font-bold text-right">마지막 제출</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row, index) => {
                const quiet = isQuiet(row.last_submitted_at);
                return (
                  <tr
                    key={row.student_id}
                    className={`border-b border-violet-50 last:border-0 ${quiet ? "bg-orange-50/60" : ""}`}
                  >
                    <td className="px-4 py-2.5 font-bold text-gray-800">
                      {index === 0 && row.submitted_week > 0 && "👑 "}
                      {row.student_name}
                    </td>
                    <td className="px-2 py-2.5 text-center font-bold text-violet-700">
                      {row.submitted_week}
                    </td>
                    <td className="px-2 py-2.5 text-center text-gray-600">{row.approved_week}</td>
                    <td className={`px-4 py-2.5 text-right text-xs ${quiet ? "font-bold text-orange-600" : "text-gray-400"}`}>
                      {row.last_submitted_at ? formatAgo(row.last_submitted_at, now) : "제출 없음"}
                      {quiet && " 💤"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
