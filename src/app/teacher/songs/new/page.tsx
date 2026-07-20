import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SongWizard } from "@/components/SongWizard";
import type { Profile } from "@/lib/types";

/** 곡 추가 마법사: 곡 팀 + 편성 + 미션 + 카드 배정을 한 화면에서 */
export default async function NewSongPage() {
  const supabase = await createSupabaseServer();
  const { data: students } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .order("display_name");

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto w-full">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">🎵 새 곡 만들기</h1>
        <p className="mt-1 text-sm text-gray-500">
          곡을 만들면 편성 멤버에게 진도카드가 배정되고, 곡 팀도 함께 생겨요.
        </p>
      </div>
      <SongWizard students={(students ?? []) as Profile[]} />
    </div>
  );
}
