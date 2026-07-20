import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isDriveConfigured } from "@/lib/google-drive";
import { getTerms } from "@/lib/terms-server";
import { groupLimits, formatBytes, isPremiumActive } from "@/lib/limits";
import { BoardShareToggle } from "@/components/BoardShareToggle";
import { DriveArchiveCard } from "@/components/DriveArchiveCard";
import { PushToggle } from "@/components/PushToggle";
import { InstallPrompt } from "@/components/InstallPrompt";
import type { Academy, Submission } from "@/lib/types";

/** 그룹 설정: 저장 공간·알림·현황 공개·드라이브 백업 (한 번 정하고 잘 안 바꾸는 것들) */
export default async function SettingsPage() {
  const supabase = await createSupabaseServer();
  const terms = await getTerms();

  const [{ data: academyRow }, { data: subRows }] = await Promise.all([
    supabase.from("academies").select("*").maybeSingle(),
    supabase.from("submissions").select("video_size_bytes").is("video_deleted_at", null),
  ]);
  const academy = academyRow as Academy | null;
  const premium = isPremiumActive(academy);
  const limits = groupLimits(premium);
  const storageUsed = ((subRows ?? []) as Submission[]).reduce(
    (sum, sub) => sum + (sub.video_size_bytes ?? 0),
    0
  );
  const storagePercent = Math.min(
    100,
    Math.round((storageUsed / limits.storageBytes) * 100)
  );

  let driveConnected = false;
  if (academy) {
    const { data: conn } = await createSupabaseAdmin()
      .from("drive_connections")
      .select("academy_id")
      .eq("academy_id", academy.id)
      .maybeSingle();
    driveConnected = !!conn;
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto w-full">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">⚙️ 그룹 설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          {academy?.name} · {terms.group}
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-violet-100 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-gray-700">
            💾 영상 저장 공간
            {premium && (
              <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full align-middle">
                ✨ 프리미엄
              </span>
            )}
          </span>
          <span className={storagePercent >= 90 ? "font-bold text-red-500" : "text-gray-400"}>
            {formatBytes(storageUsed)} / {formatBytes(limits.storageBytes)}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-violet-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${storagePercent >= 90 ? "bg-red-400" : "bg-violet-400"}`}
            style={{ width: `${storagePercent}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          판정 {limits.retentionDays}일 뒤 영상 파일은 자동 정리돼요 (판정 기록·코멘트는 남아요).
        </p>
        <Link
          href="/teacher/premium"
          className="mt-2 inline-block text-sm font-bold text-violet-600"
        >
          {premium ? "✨ 프리미엄 정보 보기 →" : "✨ 저장 공간이 부족하다면? 프리미엄 보기 →"}
        </Link>
      </div>

      <InstallPrompt />
      <PushToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      <BoardShareToggle enabled={!!academy?.show_board} />
      <DriveArchiveCard connected={driveConnected} configured={isDriveConfigured()} />
    </div>
  );
}
