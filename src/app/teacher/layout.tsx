import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { getTerms } from "@/lib/terms-server";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const terms = await getTerms();
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
            {/* 나머지 화면들: 헤더가 좁아지지 않게 더보기로 묶는다 */}
            <details className="relative">
              <summary className="list-none cursor-pointer hover:text-violet-700 select-none">
                더보기 ▾
              </summary>
              <div className="absolute right-0 top-7 z-50 w-40 rounded-xl bg-white border border-violet-100 shadow-lg py-1 flex flex-col">
                <Link href="/teacher/cards" className="px-3 py-2 hover:bg-violet-50">📋 숙제 관리</Link>
                <Link href="/teacher/videos" className="px-3 py-2 hover:bg-violet-50">🎬 영상 관리</Link>
                <Link href="/teacher/teams" className="px-3 py-2 hover:bg-violet-50">👥 팀 관리</Link>
                <Link href="/teacher/stats" className="px-3 py-2 hover:bg-violet-50">📈 주간 통계</Link>
                <Link
                  href="/teacher/settings"
                  className="px-3 py-2 hover:bg-violet-50 border-t border-violet-50"
                >
                  ⚙️ 그룹 설정
                </Link>
              </div>
            </details>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto p-4">{children}</main>
    </>
  );
}
