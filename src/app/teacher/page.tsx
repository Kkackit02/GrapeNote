import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getTerms } from "@/lib/terms-server";
import { getWeeklyStats } from "@/lib/activity";
import { groupLimits, formatBytes, isPremiumActive } from "@/lib/limits";
import { MembersTable, type MemberRow } from "@/components/MembersTable";
import { JoinCodeCard } from "@/components/JoinCodeCard";
import type {
  Academy,
  Profile,
  ProgressCard,
  StudentInvite,
  Submission,
  Team,
  TeamMember,
} from "@/lib/types";

export default async function TeacherDashboard() {
  const supabase = await createSupabaseServer();
  const terms = await getTerms();

  const [
    { data: students },
    { count: pendingCount },
    { data: invites },
    { data: academyRow },
    { data: teams },
    { data: memberships },
    { data: subRows },
    { data: cardRows },
    weeklyStats,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "student")
      .order("display_name"),
    supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("student_invites")
      .select("*")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase.from("academies").select("*").maybeSingle(),
    supabase.from("teams").select("*"),
    supabase.from("team_members").select("*"),
    supabase.from("submissions").select("student_id, status, video_size_bytes, video_deleted_at"),
    supabase.from("progress_cards").select("student_id, completed_at"),
    getWeeklyStats(),
  ]);
  const subList = (subRows ?? []) as Submission[];
  const storageUsed = subList
    .filter((sub) => !sub.video_deleted_at)
    .reduce((sum, sub) => sum + (sub.video_size_bytes ?? 0), 0);

  const studentList = (students ?? []) as Profile[];
  const inviteList = (invites ?? []) as StudentInvite[];
  const academy = academyRow as Academy | null;
  const limits = groupLimits(isPremiumActive(academy));

  const storagePercent = Math.min(
    100,
    Math.round((storageUsed / limits.storageBytes) * 100)
  );
  const teamList = (teams ?? []) as Team[];
  const teamById = new Map(teamList.map((t) => [t.id, t]));
  const memberList = (memberships ?? []) as TeamMember[];
  const teamsOf = (studentId: string) =>
    memberList
      .filter((m) => m.profile_id === studentId)
      .map((m) => teamById.get(m.team_id))
      .filter((t): t is Team => !!t);

  const cardList = (cardRows ?? []) as ProgressCard[];
  const weeklyById = new Map(weeklyStats.map((stat) => [stat.student_id, stat]));
  const memberRows: MemberRow[] = studentList.map((student) => {
    const myCards = cardList.filter((card) => card.student_id === student.id);
    const weekly = weeklyById.get(student.id);
    return {
      id: student.id,
      name: student.display_name,
      username: student.username,
      instrument: student.instrument,
      teams: teamsOf(student.id).map(
        (team) => `${team.leader_id === student.id ? "⭐" : ""}${team.name}`
      ),
      ongoing: myCards.filter((card) => !card.completed_at).length,
      completed: myCards.filter((card) => card.completed_at).length,
      weekSubmitted: weekly?.submitted_week ?? 0,
      pending: subList.filter(
        (sub) => sub.student_id === student.id && sub.status === "pending"
      ).length,
      lastSubmittedAt: weekly?.last_submitted_at ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      {(pendingCount ?? 0) > 0 && (
        <Link
          href="/teacher/review"
          className="rounded-2xl bg-lime-100 border border-lime-300 p-4 flex items-center justify-between active:bg-lime-200"
        >
          <span className="font-bold text-lime-900">
            👀 검토를 기다리는 영상이 {pendingCount}개 있어요
          </span>
          <span className="text-lime-700 font-bold">보러 가기 →</span>
        </Link>
      )}

      <JoinCodeCard code={academy?.join_code ?? null} groupLabel={terms.group} />

      {/* 관리 화면 바로가기 — 대시보드를 허브로 (헤더 더보기는 없앴다) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          { href: "/teacher/review", emoji: "👀", label: "검토함", desc: "올라온 영상 판정" },
          { href: "/teacher/board", emoji: "📊", label: "현황판", desc: "곡×멤버 진행 한눈에" },
          { href: "/teacher/songs", emoji: "🎵", label: "곡 관리", desc: "편성·미션·기한" },
          { href: "/teacher/cards", emoji: "📋", label: "숙제 관리", desc: "배정한 숙제 수정" },
          { href: "/teacher/teams", emoji: "👥", label: "팀 관리", desc: "팀·파트장 지정" },
          { href: "/teacher/stats", emoji: "📈", label: "주간 통계", desc: "이번 주 누가 열심히?" },
          { href: "/teacher/videos", emoji: "🎬", label: "영상 관리", desc: "전체 영상·백업" },
          { href: "/teacher/settings", emoji: "⚙️", label: "그룹 설정", desc: "알림·저장·계정 전환" },
          { href: "/teacher/premium", emoji: "✨", label: "프리미엄", desc: "저장 공간 늘리기" },
          { href: "/teacher/help", emoji: "❓", label: "도움말", desc: "사용법·FAQ" },
        ].map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="rounded-2xl bg-white border border-violet-100 p-3.5 active:bg-violet-50"
          >
            <p className="font-bold text-violet-800">
              {tile.emoji} {tile.label}
            </p>
            <p className="mt-0.5 text-xs font-medium text-gray-400">{tile.desc}</p>
          </Link>
        ))}
      </div>

      {/* 저장 공간 경고 — 여유가 없을 때만 강조 (설정 타일에도 있음) */}
      {storagePercent >= 80 && (
        <Link
          href="/teacher/settings"
          className="rounded-2xl bg-orange-50 border border-orange-300 px-4 py-3 flex items-center justify-between text-sm active:bg-orange-100"
        >
          <span className="font-bold text-orange-800">
            💾 저장 공간 {storagePercent}% 사용 중 ({formatBytes(storageUsed)} /{" "}
            {formatBytes(limits.storageBytes)})
          </span>
          <span className="shrink-0 font-bold text-orange-600">설정 →</span>
        </Link>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-violet-900">우리 {terms.member}들</h2>
          <div className="flex gap-2">
            {studentList.length > 0 && (
              <>
                <Link
                  href="/teacher/songs/new"
                  className="px-4 py-2 rounded-xl bg-white border border-violet-300 text-violet-700 text-sm font-bold active:bg-violet-100"
                >
                  🎵 곡 만들기
                </Link>
                <Link
                  href="/teacher/cards/new"
                  className="px-4 py-2 rounded-xl bg-white border border-violet-300 text-violet-700 text-sm font-bold active:bg-violet-100"
                >
                  🍇 카드 배정
                </Link>
              </>
            )}
            <Link
              href="/teacher/students/new"
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold active:bg-violet-800"
            >
              + {terms.member} 등록
            </Link>
          </div>
        </div>

        {studentList.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white border border-violet-100 p-8 text-center text-gray-500">
            아직 {terms.member}이 없어요.
            <br />
            위의 <span className="font-bold text-violet-700">공용 초대코드</span>를 단톡방에 공유하거나{" "}
            <span className="font-bold text-violet-700">{terms.member} 등록</span>으로 개인 코드를 만들어 보세요!
            <br />
            <span className="text-sm">{terms.member}가 가입하면 🎵 곡 만들기가 열려요.</span>
            <br />
            <Link href="/teacher/help" className="mt-3 inline-block font-bold text-violet-600 underline underline-offset-4">
              ❓ 처음이라면 도움말부터 보기
            </Link>
          </div>
        ) : (
          <div className="mt-3">
            <MembersTable rows={memberRows} memberLabel={terms.member} />
            <p className="mt-1.5 text-xs text-gray-400">
              이름을 누르면 상세로 가요 · 👀 검토 대기 · 💤 7일 넘게 조용한 {terms.member}
            </p>
          </div>
        )}
      </section>

      {inviteList.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-700">가입 대기 중인 초대코드</h2>
          <ul className="mt-2 grid gap-2">
            {inviteList.map((invite) => (
              <li
                key={invite.id}
                className="rounded-xl bg-white border border-dashed border-violet-200 px-4 py-3 flex items-center justify-between text-sm"
              >
                <span className="text-gray-700">{invite.student_name}</span>
                <code className="font-bold text-violet-700">{invite.code}</code>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
