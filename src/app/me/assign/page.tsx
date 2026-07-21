import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { LeaderAssignForm, type AssignMember } from "@/components/LeaderAssignForm";
import type { Profile } from "@/lib/types";

/** 파트장 숙제 내기 — 리더가 허용했고 내가 파트장일 때만 접근 가능 */
export default async function LeaderAssignPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "student") redirect("/me");
  const academyId = user.app_metadata.academy_id as string;

  const admin = createSupabaseAdmin();
  const [{ data: meProfile }, { data: myTeams }] = await Promise.all([
    admin.from("profiles").select("can_assign_homework").eq("id", user.id).maybeSingle(),
    admin.from("teams").select("id").eq("academy_id", academyId).eq("leader_id", user.id),
  ]);
  const teamIds = (myTeams ?? []).map((t) => t.id);
  // 권한이 없거나 파트장이 아니면 접근 불가
  if (!meProfile?.can_assign_homework || teamIds.length === 0) redirect("/me");

  // 내 팀원 (나 제외)
  const { data: memberRows } = await admin
    .from("team_members")
    .select("profile_id")
    .in("team_id", teamIds);
  const memberIds = [...new Set((memberRows ?? []).map((m) => m.profile_id as string))].filter(
    (id) => id !== user.id
  );
  const { data: profiles } = memberIds.length
    ? await admin.from("profiles").select("id, display_name, instrument").in("id", memberIds)
    : { data: [] };
  const members: AssignMember[] = ((profiles ?? []) as Profile[])
    .map((p) => ({ id: p.id, name: p.display_name, instrument: p.instrument }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/me" className="text-sm text-gray-400">← 내 카드 목록</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">🎯 팀원에게 숙제 내기</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          내 팀원에게 연습 숙제를 배정해요. 배정한 영상은 검토함에서 확인할 수 있어요.
        </p>
      </div>
      <LeaderAssignForm members={members} />
    </div>
  );
}
