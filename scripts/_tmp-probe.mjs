// 0021 컬럼 권한 점검: 학생이 자기 카드의 completed_at/total_grapes/title을 조작할 수 있나?
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ts = Date.now();
const username = `probe${ts}`.slice(0, 12);
const PIN = "123456";

// 기존 학원 하나 빌려 쓴다 (테스트 계정만 새로 만들고 정리)
const { data: academy } = await admin.from("academies").select("id").limit(1).single();
const { data: created } = await admin.auth.admin.createUser({
  email: `${username}@student.grapenote.app`,
  password: PIN,
  email_confirm: true,
  app_metadata: { role: "student", academy_id: academy.id },
});
const uid = created.user.id;
await admin.from("profiles").insert({
  id: uid, academy_id: academy.id, role: "student", display_name: "권한점검", username,
});
const { data: card } = await admin.from("progress_cards").insert({
  academy_id: academy.id, student_id: uid, title: `권한점검-${ts}`,
  total_grapes: 5, created_by: uid,
}).select("id").single();

const student = createClient(url, anon, { auth: { persistSession: false } });
await student.auth.signInWithPassword({
  email: `${username}@student.grapenote.app`, password: PIN,
});

const probe = async (label, patch) => {
  const { data, error } = await student
    .from("progress_cards").update(patch).eq("id", card.id).select("id");
  const changed = (data ?? []).length > 0;
  console.log(`${changed ? "🚨 가능" : "✅ 차단"} — ${label}${error ? ` (${error.message})` : ""}`);
};

await probe("셀프 완성 처리 (completed_at)", { completed_at: new Date().toISOString() });
await probe("포도알 수 변경 (total_grapes)", { total_grapes: 1 });
await probe("곡명 변경 (title)", { title: "해킹된곡" });
await probe("기한 변경 (due_date)", { due_date: "2030-01-01" });
await probe("자랑하기 (shared_at) — 허용되어야 정상", { shared_at: new Date().toISOString() });

const { data: after } = await admin.from("progress_cards")
  .select("title, total_grapes, completed_at, shared_at").eq("id", card.id).single();
console.log("최종 상태:", JSON.stringify(after));

await admin.from("progress_cards").delete().eq("id", card.id);
await admin.from("profiles").delete().eq("id", uid);
await admin.auth.admin.deleteUser(uid);
