import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { UploadManagerProvider } from "@/components/UploadManager";
import { BottomNav } from "@/components/BottomNav";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: academy } = await supabase.from("academies").select("show_board").maybeSingle();

  return (
    <UploadManagerProvider>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-violet-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/me" className="font-extrabold text-violet-900 text-lg">
            🍇 내 진도카드
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 w-full max-w-lg mx-auto p-4">{children}</main>
      <BottomNav boardShared={!!academy?.show_board} />
    </UploadManagerProvider>
  );
}
