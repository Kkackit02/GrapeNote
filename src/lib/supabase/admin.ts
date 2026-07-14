import "server-only";
import { createClient } from "@supabase/supabase-js";

/** service role 클라이언트 — RLS를 우회한다. 서버에서만 import 가능. */
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
