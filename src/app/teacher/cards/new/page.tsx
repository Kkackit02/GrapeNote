import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { BulkCardForm, type TeamOption } from "@/components/BulkCardForm";
import type { Profile, Team, TeamMember } from "@/lib/types";

export default async function NewCardPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  const supabase = await createSupabaseServer();
  const [{ data: students }, { data: teams }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "student").order("display_name"),
    supabase.from("teams").select("*").order("created_at"),
    supabase.from("team_members").select("*"),
  ]);
  const studentList = (students ?? []) as Profile[];
  const memberList = (memberships ?? []) as TeamMember[];
  const teamOptions: TeamOption[] = ((teams ?? []) as Team[]).map((t) => ({
    id: t.id,
    name: t.name,
    memberIds: memberList.filter((m) => m.team_id === t.id).map((m) => m.profile_id),
  }));

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-4">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">진도카드 배정</h1>
        <p className="mt-1 text-sm text-gray-500">
          여러 학생을 선택하면 같은 카드를 한 번에 배정할 수 있어요.
          팀으로 배정하면 나중에 합류한 팀원도 자동으로 받아요.
        </p>
      </div>

      {studentList.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-8 text-center text-gray-500">
          아직 가입한 학생이 없어요.
          <br />
          먼저{" "}
          <Link href="/teacher/students/new" className="font-bold text-violet-700 underline">
            학생을 초대
          </Link>
          해 주세요!
        </div>
      ) : (
        <BulkCardForm
          students={studentList}
          teams={teamOptions}
          initialTeamId={teamParam ?? null}
        />
      )}
    </div>
  );
}
