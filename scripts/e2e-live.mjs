// GrapeNote 골든 시나리오 통합 테스트 (실 Supabase 대상)
// 서버 액션이 수행하는 것과 동일한 순서의 작업을 API 레벨에서 검증한다.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const newAnon = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};

const ts = Date.now();
const teacherEmail = `teacher-${ts}@grapenote-e2e.test`;
const studentUsername = `podo${ts % 100000}`;
const studentEmail = `${studentUsername}@student.grapenote.app`;
const PIN = "123456";
const cleanup = { userIds: [], academyId: null, paths: [] };

try {
  console.log("\n[1] 선생님 가입 (이메일 autoconfirm 확인)");
  const teacher = newAnon();
  const { data: signUp, error: signUpErr } = await teacher.auth.signUp({
    email: teacherEmail, password: "grape-pass-1!",
  });
  ok("가입 성공", !signUpErr, signUpErr?.message);
  ok("세션 즉시 발급 (Confirm email 꺼짐)", !!signUp?.session,
    "→ 대시보드에서 Auth > Providers > Email > Confirm email을 꺼야 함");
  const teacherId = signUp.user.id;
  cleanup.userIds.push(teacherId);

  console.log("\n[2] 온보딩: 학원 생성 + app_metadata");
  const { data: academy } = await admin.from("academies")
    .insert({ name: "포도피아노 (E2E)", owner_id: teacherId }).select("id").single();
  cleanup.academyId = academy.id;
  await admin.from("profiles").insert({ id: teacherId, academy_id: academy.id, role: "teacher", display_name: "김포도 선생님" });
  await admin.auth.admin.updateUserById(teacherId, { app_metadata: { role: "teacher", academy_id: academy.id } });
  const { data: refreshed, error: refErr } = await teacher.auth.refreshSession();
  ok("refreshSession으로 새 JWT 수령", !refErr && refreshed.session.user.app_metadata.academy_id === academy.id);

  console.log("\n[3] 초대코드 발급 (선생님 세션, RLS insert)");
  const code = `GRAPE-E2E${ts % 10}`;
  const { error: invErr } = await teacher.from("student_invites")
    .insert({ academy_id: academy.id, code, student_name: "김포도", created_by: teacherId });
  ok("초대코드 insert 성공", !invErr, invErr?.message);

  console.log("\n[4] 학생 가입 (가짜 이메일 + PIN)");
  const { data: studentCreated, error: stuErr } = await admin.auth.admin.createUser({
    email: studentEmail, password: PIN, email_confirm: true,
    app_metadata: { role: "student", academy_id: academy.id },
  });
  ok("학생 계정 생성", !stuErr, stuErr?.message);
  const studentId = studentCreated.user.id;
  cleanup.userIds.push(studentId);
  await admin.from("profiles").insert({ id: studentId, academy_id: academy.id, role: "student", display_name: "김포도", username: studentUsername });
  await admin.from("student_invites").update({ used_by: studentId, used_at: new Date().toISOString() }).eq("code", code);

  const student = newAnon();
  const { data: stuLogin, error: loginErr } = await student.auth.signInWithPassword({ email: studentEmail, password: PIN });
  ok("학생 아이디+PIN 로그인", !loginErr && !!stuLogin.session, loginErr?.message);

  console.log("\n[5] 진도카드 배정 (선생님 세션)");
  const { data: card, error: cardErr } = await teacher.from("progress_cards")
    .insert({ academy_id: academy.id, student_id: studentId, title: "체르니 100 - 45번", total_grapes: 3, created_by: teacherId })
    .select("id").single();
  ok("카드 배정 성공", !cardErr, cardErr?.message);

  console.log("\n[6] RLS 격리 검증 (학생 세션)");
  const { data: myCards } = await student.from("progress_cards").select("id");
  ok("학생이 자기 카드 조회 가능", myCards?.length === 1);
  const { data: stolenInvites } = await student.from("student_invites").select("id");
  ok("학생은 초대코드 접근 불가", (stolenInvites ?? []).length === 0);

  console.log("\n[7] 영상 업로드 (signed upload URL → 직접 업로드 → pending)");
  const fakeVideo = new Blob([new Uint8Array(1024).fill(7)], { type: "video/mp4" });
  const path1 = `${academy.id}/${studentId}/${card.id}/1-${crypto.randomUUID()}.mp4`;
  cleanup.paths.push(path1);
  const { data: signed1 } = await admin.storage.from("videos").createSignedUploadUrl(path1);
  const { error: upErr } = await student.storage.from("videos").uploadToSignedUrl(signed1.path, signed1.token, fakeVideo);
  ok("signed URL로 업로드 성공", !upErr, upErr?.message);
  const { data: subId, error: subErr } = await student.rpc("create_submission", {
    p_card_id: card.id, p_grape_index: 1, p_video_path: path1,
    p_video_size: 1024, p_video_hash: "", p_title: "", p_comment: "",
  });
  ok("submission(pending) 생성 (RPC)", !subErr && !!subId, subErr?.message);

  console.log("\n[8] 보안: 직접 insert / 셀프 합격 / 무단 수정 차단");
  const { error: directInsert } = await student.from("submissions")
    .insert({ card_id: card.id, student_id: studentId, academy_id: academy.id, grape_index: 2, video_path: path1 });
  ok("학생 직접 insert → 거부 (정책 없음)", !!directInsert);
  const { data: hacked } = await student.from("submissions")
    .update({ status: "approved" }).eq("card_id", card.id).select("id");
  ok("학생이 status update → 0건", (hacked ?? []).length === 0);
  const { error: badPath } = await student.rpc("create_submission", {
    p_card_id: card.id, p_grape_index: 4, p_video_path: "evil/path.mp4",
    p_video_size: 1024, p_video_hash: "", p_title: "", p_comment: "",
  });
  ok("RPC 경로 접두사 위조 → 거부", !!badPath);
  const { error: badIndex } = await student.rpc("create_submission", {
    p_card_id: card.id, p_grape_index: 999, p_video_path: `${academy.id}/${studentId}/${card.id}/999-x.mp4`,
    p_video_size: 1024, p_video_hash: "", p_title: "", p_comment: "",
  });
  ok("RPC 포도알 인덱스 상한 초과 → 거부", !!badIndex);
  const { error: dupPending } = await student.rpc("create_submission", {
    p_card_id: card.id, p_grape_index: 1, p_video_path: path1,
    p_video_size: 1024, p_video_hash: "", p_title: "", p_comment: "",
  });
  ok("같은 포도알 pending 중복 → 거부", !!dupPending);

  console.log("\n[9] 스토리지 보안");
  const pub = await fetch(`${URL_}/storage/v1/object/public/videos/${path1}`);
  ok("public URL 직접 접근 → 거부", pub.status >= 400, `status=${pub.status}`);
  const { data: playUrl } = await admin.storage.from("videos").createSignedUrl(path1, 60);
  const play = await fetch(playUrl.signedUrl);
  ok("signed URL 재생 → 200", play.status === 200, `status=${play.status}`);

  console.log("\n[10] 판정 루프: 재연습 → 재제출 → 합격 → 카드 완성");
  const { data: pendingList } = await teacher.from("submissions").select("id").eq("status", "pending");
  ok("선생님 검토함에 1건", pendingList?.length === 1);
  const { data: retried } = await teacher.from("submissions")
    .update({ status: "needs_retry", teacher_comment: "박자 다시!", reviewed_by: teacherId, reviewed_at: new Date().toISOString() })
    .eq("id", pendingList[0].id).select("id");
  ok("재연습 판정 성공", retried?.length === 1);

  // 재제출 + 나머지 포도알 채우기 → 전부 합격
  for (const idx of [1, 2, 3]) {
    const p = `${academy.id}/${studentId}/${card.id}/${idx}-${crypto.randomUUID()}.mp4`;
    cleanup.paths.push(p);
    const { data: s } = await admin.storage.from("videos").createSignedUploadUrl(p);
    await student.storage.from("videos").uploadToSignedUrl(s.path, s.token, fakeVideo);
    const { data: insId } = await student.rpc("create_submission", {
      p_card_id: card.id, p_grape_index: idx, p_video_path: p,
      p_video_size: 1024, p_video_hash: "", p_title: "", p_comment: "",
    });
    await teacher.from("submissions")
      .update({ status: "approved", reviewed_by: teacherId, reviewed_at: new Date().toISOString() })
      .eq("id", insId);
  }
  const { data: allSubs } = await teacher.from("submissions").select("grape_index, status").eq("card_id", card.id);
  const approvedIdx = new Set(allSubs.filter((s) => s.status === "approved").map((s) => s.grape_index));
  ok("포도알 3개 전부 합격", approvedIdx.size === 3);
  ok("재연습 이력 보존 (총 제출 4건)", allSubs.length === 4);
  const { error: resubmitApproved } = await admin.from("submissions")
    .insert({ card_id: card.id, student_id: studentId, academy_id: academy.id, grape_index: 1, video_path: path1, status: "approved" });
  ok("합격 포도알에 재합격 → DB가 거부", !!resubmitApproved);

  console.log("\n[11] 그룹(학원 공용) 초대코드");
  const groupCode = `CLASS-E2E${ts % 10}`;
  const { data: codeSet } = await teacher.from("academies")
    .update({ join_code: groupCode }).eq("id", academy.id).select("join_code").maybeSingle();
  ok("선생님이 공용 코드 발급(update 정책)", codeSet?.join_code === groupCode);
  const { data: foundAcademy } = await admin.from("academies")
    .select("id, name").eq("join_code", groupCode).maybeSingle();
  ok("공용 코드로 학원 조회", foundAcademy?.id === academy.id);
  // 그룹 코드로 두 번째 학생 가입 (이름은 학생이 직접 입력)
  const student2Username = `berry${ts % 100000}`;
  const { data: stu2 } = await admin.auth.admin.createUser({
    email: `${student2Username}@student.grapenote.app`, password: PIN, email_confirm: true,
    app_metadata: { role: "student", academy_id: academy.id },
  });
  cleanup.userIds.push(stu2.user.id);
  const { error: prof2Err } = await admin.from("profiles").insert({
    id: stu2.user.id, academy_id: academy.id, role: "student", display_name: "이베리", username: student2Username,
  });
  ok("그룹 코드 학생 가입 (이름 직접 입력)", !prof2Err, prof2Err?.message);

  console.log("\n[12] 공통 카드 배정 (2명에게 같은 곡)");
  const { data: bulkCards, error: bulkErr } = await teacher.from("progress_cards")
    .insert([studentId, stu2.user.id].map((sid) => ({
      academy_id: academy.id, student_id: sid, title: "하농 1번 (공통)", total_grapes: 5, created_by: teacherId,
    })))
    .select("id, student_id");
  ok("2명 일괄 배정 성공", !bulkErr && bulkCards?.length === 2, bulkErr?.message);

  console.log("\n[13] 같은 영상 재탕 방지 (video_hash)");
  const dupHash = "a".repeat(64);
  const { error: hash1Err } = await admin.from("submissions").insert({
    card_id: bulkCards[0].id, student_id: studentId, academy_id: academy.id,
    grape_index: 1, video_path: path1, video_hash: dupHash,
  });
  ok("첫 제출(해시 포함) 성공", !hash1Err, hash1Err?.message);
  const { error: hash2Err } = await admin.from("submissions").insert({
    card_id: bulkCards[0].id, student_id: studentId, academy_id: academy.id,
    grape_index: 2, video_path: path1, video_hash: dupHash,
  });
  ok("같은 학생이 같은 해시 재제출 → DB가 거부", !!hash2Err &&
    hash2Err.message.includes("submissions_unique_video_per_student"), hash2Err?.message);
  const { error: hash3Err } = await admin.from("submissions").insert({
    card_id: bulkCards[1].id, student_id: stu2.user.id, academy_id: academy.id,
    grape_index: 1, video_path: path1, video_hash: dupHash,
  });
  ok("다른 학생은 같은 해시 제출 가능", !hash3Err, hash3Err?.message);

  console.log("\n[14] 학생 제목/코멘트 + 검토 대기 영상 삭제");
  const notePath = `${academy.id}/${studentId}/${bulkCards[0].id}/3-${crypto.randomUUID()}.mp4`;
  const { data: notedId, error: noteErr } = await student.rpc("create_submission", {
    p_card_id: bulkCards[0].id, p_grape_index: 3, p_video_path: notePath,
    p_video_size: 1024, p_video_hash: "", p_title: "오른손만 연습!", p_comment: "셋째 마디가 어려워요",
  });
  ok("제목/코멘트와 함께 제출 (RPC)", !noteErr && !!notedId, noteErr?.message);
  const { data: teacherView } = await teacher.from("submissions")
    .select("student_title, student_comment").eq("id", notedId).single();
  ok("선생님이 학생 코멘트 확인 가능", teacherView?.student_title === "오른손만 연습!" && !!teacherView?.student_comment);

  // 학생이 자기 pending 삭제 (RLS delete 정책)
  const { data: delOk } = await student.from("submissions")
    .delete().eq("id", notedId).select("id");
  ok("학생이 자기 검토 대기 영상 삭제 가능", delOk?.length === 1);
  // 판정된 제출은 삭제 불가
  const { data: anyApproved } = await student.from("submissions")
    .select("id").eq("status", "approved").limit(1).single();
  const { data: delBlocked } = await student.from("submissions")
    .delete().eq("id", anyApproved.id).select("id");
  ok("판정된 영상 삭제 → 0건 (차단)", (delBlocked ?? []).length === 0);
  // 남의 pending도 삭제 불가
  const { data: stu2Pending } = await admin.from("submissions")
    .select("id").eq("student_id", stu2.user.id).eq("status", "pending").limit(1).single();
  const { data: delOthers } = await student.from("submissions")
    .delete().eq("id", stu2Pending.id).select("id");
  ok("남의 영상 삭제 → 0건 (차단)", (delOthers ?? []).length === 0);

  console.log("\n[14b] Finding 1: 남의 카드에 제출 주입 차단");
  // 학생1이 학생2의 카드(bulkCards[1])에 RPC로 제출 시도 → 소유권 검증에 막혀야 한다
  const victimCard = bulkCards.find((c) => c.student_id === stu2.user.id);
  const { error: injectErr } = await student.rpc("create_submission", {
    p_card_id: victimCard.id, p_grape_index: 1,
    p_video_path: `${academy.id}/${studentId}/${victimCard.id}/1-x.mp4`,
    p_video_size: 1024, p_video_hash: "", p_title: "", p_comment: "",
  });
  ok("학생이 남의 카드에 RPC 제출 → 거부", !!injectErr, injectErr?.message);
  // 직접 insert로도 (정책 제거되어) 막힌다
  const { error: injectDirect } = await student.from("submissions").insert({
    card_id: victimCard.id, student_id: studentId, academy_id: academy.id,
    grape_index: 2, video_path: "x.mp4",
  });
  ok("학생이 남의 카드에 직접 insert → 거부", !!injectDirect);

  console.log("\n[15] 팀 다중 소속 (M:N) + 파트장 검토");
  const { data: teamA } = await teacher.from("teams")
    .insert({ academy_id: academy.id, name: "Tomboy 합주팀" }).select("id").single();
  const { data: teamB } = await teacher.from("teams")
    .insert({ academy_id: academy.id, name: "월수반" }).select("id").single();
  // 학생1을 팀 2개에 동시 배정 + 학생2는 팀B만
  const { error: memErr } = await teacher.from("team_members").insert([
    { team_id: teamA.id, profile_id: studentId, academy_id: academy.id },
    { team_id: teamB.id, profile_id: studentId, academy_id: academy.id },
    { team_id: teamB.id, profile_id: stu2.user.id, academy_id: academy.id },
  ]);
  ok("학생1이 팀 2개에 동시 소속", !memErr, memErr?.message);
  const { data: stu1Memberships } = await student.from("team_members")
    .select("team_id").eq("profile_id", studentId);
  ok("학생1 소속 2건 조회", stu1Memberships?.length === 2);

  // 학생1을 팀B 파트장으로 → 팀B 팀원(학생2)의 제출을 검토할 수 있어야 한다
  const { error: leaderErr } = await teacher.from("teams")
    .update({ leader_id: studentId }).eq("id", teamB.id);
  ok("파트장 지정", !leaderErr, leaderErr?.message);
  const { data: visibleSubs } = await student.from("submissions")
    .select("id, student_id").eq("student_id", stu2.user.id);
  ok("파트장이 팀원 제출 조회 가능", (visibleSubs ?? []).length >= 1);
  const { data: reviewedCard, error: rpcErr } = await student
    .rpc("review_submission", { sub_id: stu2Pending.id, verdict: "approved", comment: "파트장 합격!" });
  ok("파트장이 RPC로 팀원 제출 판정", !rpcErr && !!reviewedCard, rpcErr?.message);
  // 파트장이 아닌 팀(다른 팀 소속) 학생 제출은 판정 불가 — 학생2가 학생1 것 판정 시도
  const student2b = newAnon();
  await student2b.auth.signInWithPassword({ email: `${student2Username}@student.grapenote.app`, password: PIN });
  const { data: stu1Pending } = await admin.from("submissions")
    .select("id").eq("student_id", studentId).eq("status", "pending").limit(1).maybeSingle();
  if (stu1Pending) {
    const { error: notLeaderErr } = await student2b
      .rpc("review_submission", { sub_id: stu1Pending.id, verdict: "approved", comment: "해킹" });
    ok("파트장 아닌 학생의 판정 → 거부", !!notLeaderErr);
  } else {
    ok("파트장 아닌 학생의 판정 → 거부 (대상 없음, 스킵)", true);
  }
  // 팀에서 빼면 여전히 다른 팀 소속은 유지
  await teacher.from("team_members").delete()
    .eq("team_id", teamA.id).eq("profile_id", studentId);
  const { data: afterRemove } = await student.from("team_members")
    .select("team_id").eq("profile_id", studentId);
  ok("팀A에서 빼도 팀B 소속 유지", afterRemove?.length === 1 && afterRemove[0].team_id === teamB.id);

  console.log("\n[16] 팀 숙제: 새 팀원 자동 배정 (트리거)");
  // 팀A에 팀 숙제 배정 (현재 팀A는 비어 있음 → 학생2에게 직접 + team_id 링크)
  const { error: teamCardErr } = await teacher.from("progress_cards").insert({
    academy_id: academy.id, student_id: stu2.user.id, team_id: teamA.id,
    title: "혁오 - Tomboy", total_grapes: 5, created_by: teacherId,
  });
  await teacher.from("team_members").insert(
    { team_id: teamA.id, profile_id: stu2.user.id, academy_id: academy.id });
  ok("팀 숙제 배정 (team_id 링크)", !teamCardErr, teamCardErr?.message);
  // 학생1이 팀A에 늦게 합류 → 트리거가 같은 숙제를 자동 생성해야 한다
  const { error: joinErr } = await teacher.from("team_members").insert(
    { team_id: teamA.id, profile_id: studentId, academy_id: academy.id });
  ok("새 팀원 합류", !joinErr, joinErr?.message);
  const { data: autoCards } = await student.from("progress_cards")
    .select("id, title, team_id").eq("student_id", studentId).eq("team_id", teamA.id);
  ok("늦게 합류한 팀원에게 팀 숙제 자동 배정", autoCards?.length === 1 && autoCards[0].title === "혁오 - Tomboy");
  // 같은 팀에 다시 넣었다 빼도 중복 배정되지 않는지 (재합류)
  await teacher.from("team_members").delete()
    .eq("team_id", teamA.id).eq("profile_id", studentId);
  await teacher.from("team_members").insert(
    { team_id: teamA.id, profile_id: studentId, academy_id: academy.id });
  const { data: rejoinCards } = await student.from("progress_cards")
    .select("id").eq("student_id", studentId).eq("team_id", teamA.id);
  ok("재합류해도 같은 곡 중복 배정 없음", rejoinCards?.length === 1);

  console.log("\n[17] Rate limit 함수 (Finding 2)");
  const rlKey = `e2e-test:${ts}`;
  cleanup.rlKey = rlKey;
  let allowed = 0, blocked = 0;
  for (let i = 0; i < 5; i++) {
    const { data } = await admin.rpc("hit_rate_limit", { p_key: rlKey, p_limit: 3, p_window_seconds: 60 });
    if (data) allowed++; else blocked++;
  }
  ok("한도 3회 후 초과 요청 차단", allowed === 3 && blocked === 2, `허용 ${allowed} 차단 ${blocked}`);

  console.log("\n[18] 동기부여 RPC: 그룹 피드 + 주간 통계 (0015)");
  // 포도송이 완성 이벤트를 만들기 위해 학생2의 팀 숙제 카드를 완성 처리
  await teacher.from("progress_cards")
    .update({ completed_at: new Date().toISOString() })
    .eq("academy_id", academy.id).eq("student_id", stu2.user.id).eq("title", "혁오 - Tomboy");
  const { data: feed, error: feedErr } = await student
    .rpc("get_group_feed", { p_days: 7, p_limit: 30 });
  ok("학생이 그룹 피드 조회", !feedErr && Array.isArray(feed), feedErr?.message);
  ok("피드에 합격 이벤트 포함", (feed ?? []).some((e) => e.event_type === "grape_approved"));
  ok("자랑 전 완성은 피드에 미노출",
    !(feed ?? []).some((e) => e.event_type === "card_completed"));
  ok("피드에 영상 경로/코멘트 미노출",
    (feed ?? []).every((e) => !("video_path" in e) && !("teacher_comment" in e)));
  const { data: weekly, error: weeklyErr } = await student.rpc("get_weekly_stats");
  ok("학생이 주간 통계 조회", !weeklyErr && Array.isArray(weekly), weeklyErr?.message);
  const myWeekly = (weekly ?? []).find((r) => r.student_id === studentId);
  ok("내 이번 주 제출 수 집계", !!myWeekly && myWeekly.submitted_week >= 1,
    JSON.stringify(myWeekly ?? null));
  const { error: anonFeedErr } = await newAnon().rpc("get_group_feed", {});
  ok("비로그인 피드 접근 → 거부", !!anonFeedErr);

  console.log("\n[19] 악기 + 곡 트랙(MR) RLS (0016)");
  await admin.from("profiles").update({ instrument: "기타" }).eq("id", studentId);
  const { data: instRow } = await student.from("profiles")
    .select("instrument").eq("id", studentId).single();
  ok("악기 지정/조회", instRow?.instrument === "기타");
  const trackPath = `${academy.id}/tracks/${crypto.randomUUID()}.mp3`;
  const { error: trackErr } = await student.from("song_tracks").insert({
    academy_id: academy.id, song_title: "MR테스트곡", uploaded_by: studentId,
    uploader_name: "김포도", uploader_role: "student", file_path: trackPath, label: "느린 연습용",
  });
  ok("학생이 MR 등록", !trackErr, trackErr?.message);
  const { error: badPathErr } = await student.from("song_tracks").insert({
    academy_id: academy.id, song_title: "MR테스트곡", uploaded_by: studentId,
    uploader_name: "김포도", uploader_role: "student", file_path: "other-academy/tracks/x.mp3",
  });
  ok("경로 접두사 위조 → 거부", !!badPathErr);
  const { error: forgedErr } = await student.from("song_tracks").insert({
    academy_id: academy.id, song_title: "MR테스트곡", uploaded_by: stu2.user.id,
    uploader_name: "위조", uploader_role: "student", file_path: `${academy.id}/tracks/y.mp3`,
  });
  ok("남 명의 MR 등록 → 거부", !!forgedErr);
  const { data: sharedTracks } = await student2b.from("song_tracks")
    .select("id").eq("file_path", trackPath);
  ok("같은 그룹 멤버가 MR 조회", (sharedTracks ?? []).length === 1);
  const { data: delOther } = await student2b.from("song_tracks")
    .delete().eq("file_path", trackPath).select("id");
  ok("남의 MR 삭제 → 차단", (delOther ?? []).length === 0);
  const { data: delTeacher } = await teacher.from("song_tracks")
    .delete().eq("file_path", trackPath).select("id");
  ok("선생님이 MR 정리 가능", (delTeacher ?? []).length === 1);

  console.log("\n[20] 리액션 + 멤버 현황판 + 프리미엄 보호 (0018)");
  const { data: feedV2 } = await student.rpc("get_group_feed", { p_days: 7, p_limit: 30 });
  const approvedEvent = (feedV2 ?? []).find((e) => e.event_type === "grape_approved" && e.target_id);
  ok("피드 v2에 target_id 포함", !!approvedEvent);
  if (approvedEvent) {
    const { error: reactErr } = await student2b.from("feed_reactions").insert({
      academy_id: academy.id, target_kind: approvedEvent.target_kind,
      target_id: approvedEvent.target_id, reactor_id: stu2.user.id,
      reactor_name: "김포도2", emoji: "🔥",
    });
    ok("멤버가 응원 리액션 등록", !reactErr, reactErr?.message);
    const { data: seenReactions } = await student.from("feed_reactions")
      .select("emoji").eq("target_id", approvedEvent.target_id);
    ok("다른 멤버가 리액션 조회", (seenReactions ?? []).length === 1);
    const { error: forgedReact } = await student.from("feed_reactions").insert({
      academy_id: academy.id, target_kind: approvedEvent.target_kind,
      target_id: approvedEvent.target_id, reactor_id: stu2.user.id,
      reactor_name: "위조", emoji: "👏",
    });
    ok("남 명의 리액션 → 거부", !!forgedReact);
  }
  // 현황판: 비공개면 빈 결과 → 선생님이 공개하면 보인다
  const { data: boardHidden } = await student.rpc("get_group_board");
  ok("현황판 비공개 시 빈 결과", (boardHidden ?? []).length === 0);
  const { error: shareErr } = await teacher.from("academies")
    .update({ show_board: true }).eq("id", academy.id);
  ok("선생님이 현황 공개 켬", !shareErr, shareErr?.message);
  const { data: boardShown } = await student.rpc("get_group_board");
  ok("공개 후 멤버가 현황판 조회", (boardShown ?? []).length > 0);
  ok("현황판에 영상 경로 미노출",
    (boardShown ?? []).every((r) => !("video_path" in r)));
  // is_premium은 API로 수정 불가 (컬럼 권한)
  const { error: premiumErr } = await teacher.from("academies")
    .update({ is_premium: true }).eq("id", academy.id);
  ok("선생님이 is_premium 수정 → 거부", !!premiumErr);

  console.log("\n[21] 드라이브 토큰 보호 (0019)");
  // drive_connections는 정책 없는 RLS — API로는 아무도 못 읽어야 한다
  const { data: connLeak, error: connError } = await teacher.from("drive_connections").select("*");
  ok("선생님도 드라이브 토큰 조회 불가", !!connError || (connLeak ?? []).length === 0);
  const { error: connInsertErr } = await student.from("drive_connections").insert({
    academy_id: academy.id, refresh_token: "x", folder_id: "y", connected_by: studentId,
  });
  ok("드라이브 연결 직접 insert → 거부", !!connInsertErr);

  console.log("\n[22] 웹푸시 구독 RLS (0020)");
  const { error: pushErr } = await student.from("push_subscriptions").insert({
    academy_id: academy.id, profile_id: studentId,
    endpoint: `https://push.example.com/${ts}`, p256dh: "key", auth: "auth",
  });
  ok("본인 푸시 구독 등록", !pushErr, pushErr?.message);
  const { error: pushForgeErr } = await student.from("push_subscriptions").insert({
    academy_id: academy.id, profile_id: stu2.user.id,
    endpoint: `https://push.example.com/forged-${ts}`, p256dh: "key", auth: "auth",
  });
  ok("남 명의 푸시 구독 → 거부", !!pushForgeErr);
  const { data: othersPush } = await student2b.from("push_subscriptions")
    .select("endpoint").eq("profile_id", studentId);
  ok("남의 푸시 엔드포인트 조회 → 차단", (othersPush ?? []).length === 0);
  const { data: myPush } = await student.from("push_subscriptions")
    .select("endpoint").eq("profile_id", studentId);
  ok("내 푸시 구독은 조회 가능", (myPush ?? []).length === 1);

  console.log("\n[23] 완성 자랑하기 공개 제어 (0021)");
  const { data: doneCard } = await admin.from("progress_cards")
    .select("id, student_id").eq("academy_id", academy.id)
    .not("completed_at", "is", null).limit(1).maybeSingle();
  if (!doneCard) {
    ok("완성 카드 없음 (스킵)", true);
  } else {
    // 남의 카드는 자랑할 수 없다
    const other = doneCard.student_id === studentId ? student2b : student;
    const { data: forged } = await other.from("progress_cards")
      .update({ shared_at: new Date().toISOString() }).eq("id", doneCard.id).select("id");
    ok("남의 완성 자랑 → 차단", (forged ?? []).length === 0);
    // 본인은 공개 가능
    const owner = doneCard.student_id === studentId ? student : student2b;
    const { data: sharedRow } = await owner.from("progress_cards")
      .update({ shared_at: new Date().toISOString() }).eq("id", doneCard.id).select("id");
    ok("본인이 완성 자랑 가능", (sharedRow ?? []).length === 1);
    const { data: feedAfter } = await student.rpc("get_group_feed", { p_days: 7, p_limit: 30 });
    ok("자랑 후 피드에 완성 노출",
      (feedAfter ?? []).some((e) => e.event_type === "card_completed"));
    // 학생이 포도알 개수 같은 다른 컬럼은 못 바꾼다 (컬럼 권한)
    const { error: colErr } = await owner.from("progress_cards")
      .update({ total_grapes: 99 }).eq("id", doneCard.id);
    ok("학생이 포도알 수 변경 → 거부", !!colErr);
  }
} catch (e) {
  fail++;
  console.error("💥 예기치 못한 오류:", e);
} finally {
  console.log("\n[정리] 테스트 데이터 삭제");
  if (cleanup.paths.length) await admin.storage.from("videos").remove(cleanup.paths);
  if (cleanup.academyId) {
    await admin.from("push_subscriptions").delete().eq("academy_id", cleanup.academyId);
    await admin.from("feed_reactions").delete().eq("academy_id", cleanup.academyId);
    await admin.from("song_tracks").delete().eq("academy_id", cleanup.academyId);
    await admin.from("team_members").delete().eq("academy_id", cleanup.academyId);
    await admin.from("teams").delete().eq("academy_id", cleanup.academyId);
    await admin.from("submissions").delete().eq("academy_id", cleanup.academyId);
    await admin.from("progress_cards").delete().eq("academy_id", cleanup.academyId);
    await admin.from("student_invites").delete().eq("academy_id", cleanup.academyId);
    await admin.from("profiles").delete().eq("academy_id", cleanup.academyId);
  }
  for (const id of cleanup.userIds) await admin.auth.admin.deleteUser(id);
  if (cleanup.academyId) await admin.from("academies").delete().eq("id", cleanup.academyId);
  if (cleanup.rlKey) await admin.from("auth_rate_limits").delete().eq("key", cleanup.rlKey);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
