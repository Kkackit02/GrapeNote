import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-violet-100">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/teacher" className="font-extrabold text-violet-900 text-lg">
            🍇 GrapeNote
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-gray-600">
            <Link href="/teacher" className="hover:text-violet-700">학생</Link>
            <Link href="/teacher/review" className="hover:text-violet-700">검토함</Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto p-4">{children}</main>
    </>
  );
}
