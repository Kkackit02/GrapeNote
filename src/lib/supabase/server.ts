import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** RSC/서버 액션용 클라이언트. 사용자 세션(RLS) 범위로 동작한다. */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // RSC 렌더 중에는 쿠키를 쓸 수 없다 — proxy.ts가 세션 갱신을 담당
          }
        },
      },
    }
  );
}
