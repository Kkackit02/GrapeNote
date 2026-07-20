import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { exchangeCode, getAccessToken, createArchiveFolder } from "@/lib/google-drive";

/** 구글 OAuth 콜백: refresh token 저장 + 아카이브 폴더 생성 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/teacher?drive_error=${encodeURIComponent(reason)}`, origin));

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "teacher") {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("gdrive_state")?.value;
  if (!code || !state || !savedState || state !== savedState) {
    return fail("인증 정보가 올바르지 않아요");
  }

  const exchanged = await exchangeCode(code, `${origin}/api/google/callback`);
  if (!exchanged) return fail("구글 인증에 실패했어요");

  const accessToken = await getAccessToken(exchanged.refreshToken);
  if (!accessToken) return fail("토큰 발급에 실패했어요");
  const folderId = await createArchiveFolder(accessToken);
  if (!folderId) return fail("아카이브 폴더 생성에 실패했어요");

  // 토큰은 정책 없는 테이블(service role 전용)에만 저장한다
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("drive_connections").upsert({
    academy_id: user.app_metadata.academy_id,
    refresh_token: exchanged.refreshToken,
    folder_id: folderId,
    connected_by: user.id,
    connected_at: new Date().toISOString(),
  });
  if (error) return fail("연결 저장에 실패했어요 (0019 마이그레이션을 확인해 주세요)");

  const response = NextResponse.redirect(new URL("/teacher?drive=connected", origin));
  response.cookies.delete("gdrive_state");
  return response;
}
