import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { instrumentBadge } from "@/lib/instruments";
import { isDriveConfigured } from "@/lib/google-drive";
import { getTerms } from "@/lib/terms-server";
import { groupLimits, formatBytes } from "@/lib/limits";
import { JoinCodeCard } from "@/components/JoinCodeCard";
import { BoardShareToggle } from "@/components/BoardShareToggle";
import { DriveArchiveCard } from "@/components/DriveArchiveCard";
import type { Academy, Profile, StudentInvite, Team, TeamMember } from "@/lib/types";

export default async function TeacherDashboard() {
  const supabase = await createSupabaseServer();
  const terms = await getTerms();

  const [{ data: students }, { count: pendingCount }, { data: invites }, { data: academyRow }, { data: teams }, { data: memberships }, { data: usageRows }] = await Promise.all([
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
    supabase.from("submissions").select("video_size_bytes").is("video_deleted_at", null),
  ]);
  const storageUsed = (usageRows ?? []).reduce(
    (sum, row) => sum + (row.video_size_bytes ?? 0),
    0
  );

  const studentList = (students ?? []) as Profile[];
  const inviteList = (invites ?? []) as StudentInvite[];
  const academy = academyRow as Academy | null;
  const limits = groupLimits(academy?.is_premium);

  // 드라이브 연결 여부 — 토큰 테이블은 service role 전용이라 여기서만 확인 (boolean만 노출)
  let driveConnected = false;
  if (academy) {
    const { data: conn } = await createSupabaseAdmin()
      .from("drive_connections")
      .select("academy_id")
      .eq("academy_id", academy.id)
      .maybeSingle();
    driveConnected = !!conn;
  }
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

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/teacher/board"
          className="rounded-2xl bg-white border border-violet-100 p-4 font-bold text-violet-800 active:bg-violet-50"
        >
          📊 현황판
          <p className="mt-0.5 text-xs font-medium text-gray-400">곡×멤버 진행 한눈에</p>
        </Link>
        <Link
          href="/teacher/songs"
          className="rounded-2xl bg-white border border-violet-100 p-4 font-bold text-violet-800 active:bg-violet-50"
        >
          🎵 곡 관리
          <p className="mt-0.5 text-xs font-medium text-gray-400">편성·미션·기한 수정</p>
        </Link>
        <Link
          href="/teacher/stats"
          className="rounded-2xl bg-white border border-violet-100 p-4 font-bold text-violet-800 active:bg-violet-50"
        >
          📈 주간 통계
          <p className="mt-0.5 text-xs font-medium text-gray-400">이번 주 누가 열심히?</p>
        </Link>
        <Link
          href="/teacher/cards"
          className="rounded-2xl bg-white border border-violet-100 p-4 font-bold text-violet-800 active:bg-violet-50"
        >
          📋 숙제 관리
          <p className="mt-0.5 text-xs font-medium text-gray-400">배정한 숙제 수정·기한</p>
        </Link>
        <Link
          href="/teacher/teams"
          className="rounded-2xl bg-white border border-violet-100 p-4 font-bold text-violet-800 active:bg-violet-50"
        >
          👥 팀 관리
          <p className="mt-0.5 text-xs font-medium text-gray-400">팀·파트장 지정</p>
        </Link>
        <Link
          href="/teacher/videos"
          className="rounded-2xl bg-white border border-violet-100 p-4 font-bold text-violet-800 active:bg-violet-50"
        >
          🎬 영상 관리
          <p className="mt-0.5 text-xs font-medium text-gray-400">전체 영상 표·다운로드</p>
        </Link>
      </div>

      <div className="rounded-2xl bg-white border border-violet-100 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-gray-700">
            💾 영상 저장 공간
            {academy?.is_premium && (
              <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full align-middle">
                ✨ 프리미엄
              </span>
            )}
          </span>
          <span className={storagePercent >= 90 ? "font-bold text-red-500" : "text-gray-400"}>
            {formatBytes(storageUsed)} / {formatBytes(limits.storageBytes)}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-violet-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${storagePercent >= 90 ? "bg-red-400" : "bg-violet-400"}`}
            style={{ width: `${storagePercent}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          판정 {limits.retentionDays}일 뒤 영상 파일은 자동 정리돼요 (판정 기록·코멘트는 남아요).
        </p>
      </div>

      <BoardShareToggle enabled={!!academy?.show_board} />

      <DriveArchiveCard connected={driveConnected} configured={isDriveConfigured()} />

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
            <span className="font-bold text-violet-700">{terms.member} 등록</span>으로 첫 초대코드를 만들어 보세요!
          </div>
        ) : (
          <ul className="mt-3 grid gap-2">
            {studentList.map((student) => (
              <li key={student.id}>
                <Link
                  href={`/teacher/students/${student.id}`}
                  className="rounded-2xl bg-white border border-violet-100 p-4 flex items-center justify-between active:bg-violet-50"
                >
                  <span className="font-bold text-gray-800">
                    {instrumentBadge(student.instrument) || terms.memberEmoji} {student.display_name}
                    {teamsOf(student.id).map((team) => (
                      <span
                        key={team.id}
                        className="ml-2 text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full"
                      >
                        {team.leader_id === student.id && "⭐ "}
                        {team.name}
                      </span>
                    ))}
                  </span>
                  <span className="text-sm text-gray-400">
                    {student.username && `@${student.username}`} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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
