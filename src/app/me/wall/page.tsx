import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getTitle } from "@/lib/titles";
import { RANDOM_SKIN_ID } from "@/lib/skins";
import { getSkinPools } from "@/lib/skin-pool";
import { getGroupWall, getGroupShowcases } from "@/lib/wall";
import { GrapeBunch } from "@/components/GrapeBunch";
import { ShowcasePlayer } from "@/components/ShowcasePlayer";
import { ReactionBar } from "@/components/ReactionBar";
import { ClearShowcaseButton } from "@/components/ClearShowcaseButton";
import type { GrapeState } from "@/lib/grapes";
import type { FeedReaction } from "@/lib/activity";
import type { Profile } from "@/lib/types";

/** 완성 포도송이는 전부 합격 상태이므로 그림용 포도알 배열을 합성한다 */
function allApproved(n: number): GrapeState[] {
  return Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    status: "approved" as const,
    history: [],
  }));
}

/** 자랑 벽: 그룹의 자랑 영상 + 공유된 완성 포도송이 */
export default async function WallPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/student/login");

  const [completions, showcases, { data: profileRow }] = await Promise.all([
    getGroupWall(),
    getGroupShowcases(),
    supabase.from("profiles").select("showcase_submission_id").eq("id", user.id).maybeSingle(),
  ]);
  const myShowcaseId =
    (profileRow as Pick<Profile, "showcase_submission_id"> | null)?.showcase_submission_id ?? null;

  // 벽에 뜬 멤버들의 칭호 (남의 profile은 RLS로 못 읽어 service role로 모아 온다)
  const memberIds = [
    ...new Set([...completions.map((c) => c.student_id), ...showcases.map((s) => s.student_id)]),
  ];
  const titleOf = new Map<string, string | null>();
  if (memberIds.length > 0) {
    const { data: titleRows } = await createSupabaseAdmin()
      .from("profiles")
      .select("id, title")
      .in("id", memberIds);
    for (const row of titleRows ?? []) titleOf.set(row.id as string, (row.title as string) ?? null);
  }

  // 랜덤 포도를 쓰는 멤버가 있으면 그 사람들의 '가진 스킨' 목록을 구한다
  const randomIds = [
    ...completions.filter((c) => c.grape_skin === RANDOM_SKIN_ID).map((c) => c.student_id),
    ...showcases.filter((s) => s.grape_skin === RANDOM_SKIN_ID).map((s) => s.student_id),
  ];
  const skinPools = randomIds.length > 0 ? await getSkinPools(randomIds) : new Map<string, string[]>();

  // 완성작 리액션 (같은 학원 것만 조회됨)
  const cardIds = completions.map((c) => c.card_id);
  let reactions: FeedReaction[] = [];
  if (cardIds.length > 0) {
    const { data } = await supabase.from("feed_reactions").select("*").in("target_id", cardIds);
    reactions = (data ?? []) as FeedReaction[];
  }

  const empty = completions.length === 0 && showcases.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/me" className="text-sm text-gray-400">← 내 카드 목록</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">🏆 자랑 벽</h1>
        <p className="mt-0.5 text-sm text-gray-500">우리 그룹의 완성작과 자랑 영상을 모아 봐요.</p>
      </div>

      {empty && (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          아직 자랑거리가 없어요.
          <br />
          포도송이를 완성해 자랑하거나, 자신 있는 합격 영상을 걸어 보세요! 🍇
        </div>
      )}

      {showcases.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold text-violet-900">🎬 자랑 영상</h2>
          {myShowcaseId && <ClearShowcaseButton />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {showcases.map((s) => (
              <ShowcasePlayer
                key={s.submission_id}
                submissionId={s.submission_id}
                memberName={s.student_id === user.id ? "나" : s.student_name}
                songTitle={s.song_title}
                grapeIndex={s.grape_index}
                skinId={s.grape_skin}
                randomPool={skinPools.get(s.student_id)}
                mine={s.submission_id === myShowcaseId}
              />
            ))}
          </div>
        </section>
      )}

      {completions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold text-violet-900">🍇 완성 포도송이</h2>
          <ul className="grid grid-cols-2 gap-3">
            {completions.map((c) => (
              <li
                key={c.card_id}
                className={`rounded-2xl bg-white border-2 p-3 text-center ${
                  c.student_id === user.id ? "border-violet-300" : "border-violet-100"
                }`}
              >
                <GrapeBunch
                  grapes={allApproved(c.total_grapes)}
                  skinId={c.grape_skin}
                  randomPool={skinPools.get(c.student_id)}
                  className="max-h-28 mx-auto"
                />
                <p className="mt-1.5 text-sm font-extrabold text-gray-800 truncate">
                  🏆 {c.song_title}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {c.student_id === user.id ? "나" : c.student_name}
                </p>
                {(() => {
                  const t = getTitle(titleOf.get(c.student_id));
                  return t ? (
                    <p className="text-[11px] font-bold text-violet-600 truncate">
                      {t.emoji} {t.name}
                    </p>
                  ) : null;
                })()}
                <div className="mt-1.5 flex justify-center">
                  <ReactionBar
                    targetKind="card"
                    targetId={c.card_id}
                    reactions={reactions}
                    myId={user.id}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
