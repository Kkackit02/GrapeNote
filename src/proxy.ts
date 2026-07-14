import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 세션 갱신 + 역할 기반 라우트 가드.
 * role/academy_id는 JWT app_metadata에서 읽으므로 DB 조회가 없다.
 * 여기서의 가드는 UX용이고, 실제 데이터 보안은 RLS가 담당한다.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const meta = (claims?.app_metadata ?? {}) as { role?: string; academy_id?: string };
  const path = request.nextUrl.pathname;

  const redirectTo = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    return NextResponse.redirect(url);
  };

  if (path.startsWith("/teacher")) {
    if (!claims) return redirectTo("/login");
    if (meta.role === "student") return redirectTo("/me");
    if (!meta.academy_id) return redirectTo("/onboarding");
  } else if (path.startsWith("/me")) {
    if (!claims) return redirectTo("/student/login");
    if (meta.role === "teacher") return redirectTo("/teacher");
  } else if (path === "/onboarding") {
    if (!claims) return redirectTo("/login");
    if (meta.role === "teacher" && meta.academy_id) return redirectTo("/teacher");
    if (meta.role === "student") return redirectTo("/me");
  }

  return response;
}

export const config = {
  matcher: ["/teacher/:path*", "/me/:path*", "/onboarding"],
};
