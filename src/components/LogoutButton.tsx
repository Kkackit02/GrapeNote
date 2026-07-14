"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const logout = async () => {
    await createSupabaseBrowser().auth.signOut();
    router.push("/");
    router.refresh();
  };
  return (
    <button type="button" onClick={logout} className={className ?? "text-sm text-gray-500 hover:text-gray-700"}>
      로그아웃
    </button>
  );
}
