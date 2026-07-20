import "server-only";
import webpush from "web-push";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * 웹푸시 발송 (service role). 알림은 부가 기능이므로 어떤 실패도 호출자의 흐름을 막지 않는다.
 * 만료된 구독(404/410)은 자동으로 정리한다.
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@grapenote.app",
    publicKey,
    privateKey
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** 클릭 시 열 경로 (예: /me/review) */
  url: string;
  /** 같은 tag는 알림이 겹쳐 쌓이지 않고 대체된다 */
  tag?: string;
}

/** 지정한 멤버들에게 알림을 보낸다 (본인 제외 등 필터링은 호출자 책임) */
export async function sendPushTo(profileIds: string[], payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;
  const ids = [...new Set(profileIds)].filter(Boolean);
  if (ids.length === 0) return 0;

  const admin = createSupabaseAdmin();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("profile_id", ids);
  if (!subs || subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  const expired: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(sub.id);
      }
    })
  );

  if (expired.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expired);
  }
  return sent;
}

/** 이 학생의 제출을 검토할 수 있는 사람들 (같은 학원 선생님 + 소속 팀의 파트장, 본인 제외) */
export async function reviewersOf(studentId: string, academyId: string): Promise<string[]> {
  const admin = createSupabaseAdmin();
  const [{ data: teachers }, { data: memberships }] = await Promise.all([
    admin.from("profiles").select("id").eq("academy_id", academyId).eq("role", "teacher"),
    admin.from("team_members").select("team_id").eq("profile_id", studentId),
  ]);

  const teamIds = (memberships ?? []).map((m) => m.team_id);
  let leaders: string[] = [];
  if (teamIds.length > 0) {
    const { data: teams } = await admin
      .from("teams")
      .select("leader_id")
      .in("id", teamIds)
      .not("leader_id", "is", null);
    leaders = (teams ?? []).map((t) => t.leader_id as string);
  }

  return [...new Set([...(teachers ?? []).map((t) => t.id), ...leaders])].filter(
    (id) => id !== studentId
  );
}

/** 같은 그룹의 다른 멤버들 (완성 축하 알림용) */
export async function groupMembersExcept(
  academyId: string,
  exceptId: string
): Promise<string[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("academy_id", academyId)
    .neq("id", exceptId);
  return (data ?? []).map((p) => p.id);
}
