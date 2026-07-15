import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { JoinCodeCard } from "@/components/JoinCodeCard";
import type { Academy, Profile, StudentInvite, Team, TeamMember } from "@/lib/types";

export default async function TeacherDashboard() {
  const supabase = await createSupabaseServer();

  const [{ data: students }, { count: pendingCount }, { data: invites }, { data: academyRow }, { data: teams }, { data: memberships }] = await Promise.all([
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
  ]);

  const studentList = (students ?? []) as Profile[];
  const inviteList = (invites ?? []) as StudentInvite[];
  const academy = academyRow as Academy | null;
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

      <JoinCodeCard code={academy?.join_code ?? null} />

      <div className="grid grid-cols-3 gap-2">
        <Link
          href="/teacher/board"
          className="rounded-2xl bg-white border border-violet-100 p-4 font-bold text-violet-800 active:bg-violet-50"
        >
          📊 현황판
          <p className="mt-0.5 text-xs font-medium text-gray-400">곡×멤버 진행 한눈에</p>
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
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-violet-900">우리 학생들</h2>
          <div className="flex gap-2">
            {studentList.length > 0 && (
              <Link
                href="/teacher/cards/new"
                className="px-4 py-2 rounded-xl bg-white border border-violet-300 text-violet-700 text-sm font-bold active:bg-violet-100"
              >
                🍇 카드 배정
              </Link>
            )}
            <Link
              href="/teacher/students/new"
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold active:bg-violet-800"
            >
              + 학생 등록
            </Link>
          </div>
        </div>

        {studentList.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white border border-violet-100 p-8 text-center text-gray-500">
            아직 학생이 없어요.
            <br />
            <span className="font-bold text-violet-700">학생 등록</span>으로 첫 초대코드를 만들어 보세요!
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
                    🎹 {student.display_name}
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
