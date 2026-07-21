import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { AccountSwitchButton } from "@/components/AccountSwitchButton";
import { getTerms } from "@/lib/terms-server";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const terms = await getTerms();
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("linked_account_id").eq("id", user.id).maybeSingle()
    : { data: null };
  const hasLinked = !!me?.linked_account_id;
  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-violet-100">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/teacher" className="font-extrabold text-violet-900 text-lg">
            🍇 GrapeNote
          </Link>
          <nav className="flex items-center gap-3 sm:gap-4 text-sm font-medium text-gray-600">
            <Link href="/teacher" className="hover:text-violet-700">{terms.member}</Link>
            <Link href="/teacher/board" className="hover:text-violet-700">현황판</Link>
            <Link href="/teacher/songs" className="hover:text-violet-700">곡</Link>
            <Link href="/teacher/review" className="hover:text-violet-700">검토함</Link>
            {/* 나머지 관리 화면들은 대시보드 타일로 옮겼다 (더보기 제거) */}
            {hasLinked && <AccountSwitchButton label="🔄 멤버로" />}
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto p-4">{children}</main>
    </>
  );
}
