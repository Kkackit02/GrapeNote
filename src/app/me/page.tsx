import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deriveGrapes, approvedCount } from "@/lib/grapes";
import { dueBadge, daysLeft } from "@/lib/due";
import { calcStreak, practicedToday } from "@/lib/streaks";
import { getGroupFeed, getWeeklyStats, type FeedReaction } from "@/lib/activity";
import { getInstrumentRanks, rankTitle } from "@/lib/instrument-ranks";
import { getTitle } from "@/lib/titles";
import { instrumentEmoji } from "@/lib/instruments";
import { getTerms } from "@/lib/terms-server";
import { AddMyCardForm } from "@/components/AddMyCardForm";
import { GroupFeed } from "@/components/GroupFeed";
import { PushToggle } from "@/components/PushToggle";
import { InstallPrompt } from "@/components/InstallPrompt";
import type { ProgressCard, Profile, Submission, Team } from "@/lib/types";

export default async function MyCardsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/student/login");

  const [{ data: profileRow }, { data: cards }, { data: subs }, { data: leadingTeams }, feed, weeklyStats] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
    // 파트장은 팀원 카드/제출도 RLS를 통과하므로 내 것만 가져온다 (불필요한 전송 방지)
    supabase
      .from("progress_cards")
      .select("*")
      .eq("student_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase.from("submissions").select("*").eq("student_id", user!.id),
    supabase.from("teams").select("*").eq("leader_id", user!.id),
    getGroupFeed(),
    getWeeklyStats(),
  ]);

  // 피드 리액션 + 현황판 공개 여부 (0018 이전엔 조용히 빈 값)
  const targetIds = feed.map((e) => e.target_id).filter(Boolean) as string[];
  const [{ data: reactionRows }, { data: academyRow }] = await Promise.all([
    targetIds.length > 0
      ? supabase.from("feed_reactions").select("*").in("target_id", targetIds)
      : Promise.resolve({ data: [] }),
    supabase.from("academies").select("show_board").maybeSingle(),
  ]);
  const reactions = (reactionRows ?? []) as FeedReaction[];
  const boardShared = !!academyRow?.show_board;

  // 프로필이 없는 계정(가입 중 실패 등)은 무한 리다이렉트 대신 로그인으로 돌려보낸다
  if (!profileRow) redirect("/student/login");
  const profile = profileRow as Profile;
  const leaderCanAssign = !!profile.can_assign_homework;

  // 칭호: 내가 고른 것 + 악기별 순위(자동, 상위 3위)
  const wornTitle = getTitle(profile.title);
  const instrumentRanks = await getInstrumentRanks(user!.app_metadata.academy_id as string);
  let myRankTitle: { emoji: string; name: string } | null = null;
  let bestRank = 99;
  for (const ir of instrumentRanks) {
    const mine = ir.members.find((m) => m.studentId === user!.id);
    if (mine && mine.rank <= 3 && mine.rank < bestRank) {
      myRankTitle = rankTitle(ir.instrument, mine.rank);
      bestRank = mine.rank;
    }
  }
  const myCards = ((cards ?? []) as ProgressCard[]).filter((c) => !c.closed_at); // 마감 숙제는 숨김 (0023)
  const subList = (subs ?? []) as Submission[];
  const cardList = myCards.filter((c) => !c.completed_at); // 진행 중만 (완성작은 포도밭에)
  const completedCount = myCards.length - cardList.length;
  const totalApproved = subList.filter((s) => s.status === "approved").length;

  // 파트장이면 팀원들의 검토 대기 수 (내 제출은 제외 — 본인 것은 검토할 수 없다)
  const isLeader = ((leadingTeams ?? []) as Team[]).length > 0;
  let teamPending = 0;
  if (isLeader) {
    const { count } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .neq("student_id", user!.id);
    teamPending = count ?? 0;
  }

  // 스트릭 (내 제출 기준, KST) + 이번 주 연습왕
  const myDates = subList.map((s) => s.created_at);
  const streak = calcStreak(myDates);
  const doneToday = practicedToday(myDates);
  const champion =
    weeklyStats.length > 0 && weeklyStats[0].submitted_week > 0 ? weeklyStats[0] : null;

  // 카드 우선순위: ↺재연습 → 마감 임박(3일) → 👀검토 중 → 나머지 (기한 빠른 순)
  const cardsWithMeta = cardList.map((card) => {
    const grapes = deriveGrapes(
      card.total_grapes,
      subList.filter((s) => s.card_id === card.id)
    );
    const done = approvedCount(grapes);
    const waiting = grapes.some((g) => g.status === "pending");
    const retry = grapes.some((g) => g.status === "retry");
    const left = card.due_date ? daysLeft(card.due_date) : null;
    const priority = retry ? 0 : left !== null && left <= 3 ? 1 : waiting ? 2 : 3;
    return { card, grapes, done, waiting, retry, priority };
  });
  cardsWithMeta.sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.card.due_date ?? "9999").localeCompare(b.card.due_date ?? "9999") ||
      a.card.title.localeCompare(b.card.title, "ko")
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-violet-900">
          {profile.display_name} 님, 안녕하세요! 👋
        </h1>
        {(wornTitle || myRankTitle) && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {myRankTitle && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                {myRankTitle.emoji} {myRankTitle.name}
              </span>
            )}
            {wornTitle && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                {wornTitle.emoji} {wornTitle.name}
              </span>
            )}
          </div>
        )}
      </div>

      {isLeader && (
        <Link
          href="/me/review"
          className="rounded-2xl bg-amber-50 border border-amber-300 p-4 flex items-center justify-between active:bg-amber-100"
        >
          <span className="font-bold text-amber-900">
            ⭐ 파트장이에요!{" "}
            {teamPending > 0
              ? `팀원 영상 ${teamPending}개가 검토를 기다려요`
              : "검토할 팀원 영상이 없어요"}
          </span>
          <span className="text-amber-700 font-bold text-sm shrink-0">검토함 →</span>
        </Link>
      )}

      {isLeader && leaderCanAssign && (
        <Link
          href="/me/assign"
          className="rounded-2xl bg-violet-50 border border-violet-200 p-4 flex items-center justify-between active:bg-violet-100"
        >
          <span className="font-bold text-violet-900">
            🎯 팀원에게 숙제 내기
            <span className="ml-1.5 text-[11px] font-bold text-violet-500">권한 있음 ✓</span>
          </span>
          <span className="text-violet-600 font-bold text-sm shrink-0">숙제 내기 →</span>
        </Link>
      )}

      {isLeader && !leaderCanAssign && (
        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3 text-xs text-gray-500">
          🎯 아직 <b>숙제 배정 권한</b>이 없어요. 리더가 권한을 주면 여기서 팀원에게 숙제를 낼 수 있어요.
        </div>
      )}

      <Link
        href="/me/vineyard"
        className="rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white p-4 active:opacity-90"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-5">
            <span>
              <span className="block text-lg font-extrabold leading-tight">🍇 {totalApproved}</span>
              <span className="text-[11px] text-violet-200 font-medium">포도알</span>
            </span>
            <span>
              <span className="block text-lg font-extrabold leading-tight">🏆 {completedCount}</span>
              <span className="text-[11px] text-violet-200 font-medium">포도송이</span>
            </span>
            <span>
              <span className="block text-lg font-extrabold leading-tight">🔥 {streak}</span>
              <span className="text-[11px] text-violet-200 font-medium">연속일</span>
            </span>
          </div>
          <span className="shrink-0 font-bold text-sm">내 포도밭 →</span>
        </div>
        {streak > 0 && !doneToday && (
          <p className="mt-2 text-xs font-bold text-amber-200">
            오늘 올리면 🔥 {streak + 1}일 연속이 돼요!
          </p>
        )}
      </Link>

      {cardList.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-10 text-center text-gray-500">
          {completedCount > 0 ? (
            <>
              진행 중인 카드를 전부 끝냈어요! 🎉
              <br />
              곧 새 카드가 배정될 거예요.
            </>
          ) : (
            <>
              아직 진도카드가 없어요.
              <br />
              곧 연습할 곡이 배정될 거예요! 🎵
            </>
          )}
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {cardsWithMeta.map(({ card, done, waiting, retry }) => {
            const percent = Math.round((done / card.total_grapes) * 100);
            const due = dueBadge(card.due_date);
            return (
              <li key={card.id}>
                <Link
                  href={`/me/cards/${card.id}`}
                  className="block h-full rounded-2xl bg-white border-2 border-violet-100 p-3 active:bg-violet-50"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <p className="font-extrabold text-gray-800 truncate">
                      {card.completed_at ? "🏆 " : "🎵 "}
                      {card.title}
                    </p>
                    {retry && (
                      <span className="shrink-0 text-[11px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                        ↺ 다시!
                      </span>
                    )}
                    {!retry && waiting && (
                      <span className="shrink-0 text-[11px] font-bold text-lime-700 bg-lime-100 px-2 py-0.5 rounded-full">
                        👀 검토 중
                      </span>
                    )}
                  </div>
                  {(due || card.created_by === card.student_id) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {card.created_by === card.student_id && (
                        <span className="text-[11px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-full">
                          🙋 내가 고른 곡
                        </span>
                      )}
                      {due && (
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${due.className}`}>
                          {due.text}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-violet-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-600 transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="shrink-0 text-xs font-bold text-violet-600">
                      {done}/{card.total_grapes}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {boardShared && (
        <Link
          href="/me/board"
          className="rounded-2xl bg-white border border-violet-100 p-4 flex items-center justify-between active:bg-violet-50"
        >
          <span className="font-bold text-violet-800">📊 우리 그룹 현황판</span>
          <span className="text-sm text-gray-400">누가 어디까지 했나 →</span>
        </Link>
      )}

      {instrumentRanks.length > 0 && (
        <section>
          <h2 className="text-lg font-extrabold text-violet-900">🏅 악기별 포도송이 순위</h2>
          <p className="mt-0.5 text-xs text-gray-400">악기별로 포도송이가 많은 순 · 상위 3명에게 칭호가 붙어요</p>
          <div className="mt-2 grid gap-2">
            {instrumentRanks.map((ir) => (
              <div key={ir.instrument} className="rounded-2xl bg-white border border-violet-100 p-3">
                <p className="text-sm font-bold text-gray-700">
                  {instrumentEmoji(ir.instrument)} {ir.instrument}
                </p>
                <ol className="mt-1.5 flex flex-col gap-1">
                  {ir.members.slice(0, 3).map((m) => {
                    const t = rankTitle(ir.instrument, m.rank);
                    const isMe = m.studentId === user!.id;
                    return (
                      <li
                        key={m.studentId}
                        className={`flex items-center justify-between text-sm ${
                          isMe ? "font-extrabold text-violet-700" : "text-gray-600"
                        }`}
                      >
                        <span>
                          {t?.emoji} {m.name}
                          {isMe && " (나)"}
                        </span>
                        <span className="text-xs text-gray-400">🏆 {m.bunches}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      <GroupFeed
        events={feed.slice(0, 10)}
        reactions={reactions}
        champion={champion}
        myId={user!.id}
      />

      <InstallPrompt />

      <PushToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />

      <AddMyCardForm leaderLabel={(await getTerms()).leader} />
    </div>
  );
}
