import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { TeamPanel } from "@/components/TeamPanel";
import type { Profile, Team, TeamMember } from "@/lib/types";

/** 팀(그룹) 관리: 학생을 팀으로 묶고 파트장을 지정한다. 한 학생이 여러 팀에 속할 수 있다. */
export default async function TeamsPage() {
  const supabase = await createSupabaseServer();

  const [{ data: teams }, { data: students }, { data: memberships }] = await Promise.all([
    supabase.from("teams").select("*").order("created_at"),
    supabase.from("profiles").select("*").eq("role", "student").order("display_name"),
    supabase.from("team_members").select("*"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">👥 팀 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          학생을 팀으로 묶고 파트장을 정해 보세요. 파트장은 팀원의 연습 영상을 대신 검토할 수 있고,
          한 학생이 여러 팀에 동시에 속할 수 있어요.
        </p>
      </div>

      <TeamPanel
        teams={(teams ?? []) as Team[]}
        students={(students ?? []) as Profile[]}
        memberships={(memberships ?? []) as TeamMember[]}
      />
    </div>
  );
}
