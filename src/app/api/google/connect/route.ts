import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/google-drive";

/** 그룹장이 구글 드라이브 아카이브를 연결한다 → 구글 동의 화면으로 리다이렉트 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  const redirectUri = `${request.nextUrl.origin}/api/google/callback`;
  const state = crypto.randomUUID();
  const authUrl = buildAuthUrl(redirectUri, state);
  if (!authUrl) {
    return new NextResponse("Google OAuth가 설정되지 않았어요 (GOOGLE_CLIENT_ID/SECRET).", {
      status: 500,
    });
  }

  const response = NextResponse.redirect(authUrl);
  // CSRF 방지용 state — 콜백에서 대조
  response.cookies.set("gdrive_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/google",
  });
  return response;
}
