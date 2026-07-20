"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/lib/actions/reactions";
import { formatAgo } from "@/lib/time";
import type { FeedEvent, FeedReaction, WeeklyStat } from "@/lib/activity";

const EMOJIS = ["🔥", "👏", "🎉"] as const;

interface Props {
  events: FeedEvent[];
  /** 피드 이벤트들에 달린 응원 리액션 (0018 이전엔 빈 배열) */
  reactions: FeedReaction[];
  /** 이번 주 제출 1위 (0개면 null로 넘길 것) */
  champion: WeeklyStat | null;
  /** 보는 사람 자신 (내 소식 강조 + 내 리액션 표시) */
  myId: string;
}

/** 그룹 소식 피드: 완성·합격 이벤트 + 이번 주 연습왕 + 응원 리액션 */
export function GroupFeed({ events, reactions, champion, myId }: Props) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  if (!champion && events.length === 0) return null;

  const react = async (ev: FeedEvent, emoji: string) => {
    if (!ev.target_kind || !ev.target_id) return;
    const key = `${ev.target_id}:${emoji}`;
    setBusyKey(key);
    const result = await toggleReaction({
      targetKind: ev.target_kind,
      targetId: ev.target_id,
      emoji,
    });
    setBusyKey(null);
    if (result.ok) router.refresh();
  };

  const reactionsOf = (targetId: string | undefined, emoji: string) =>
    targetId
      ? reactions.filter((r) => r.target_id === targetId && r.emoji === emoji)
      : [];

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-extrabold text-violet-900">📣 우리 그룹 소식</h2>

      {champion && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          👑 이번 주 연습왕: <b>{champion.student_name}</b>
          {champion.student_id === myId && " (나!)"} — 연습 영상 {champion.submitted_week}개
        </div>
      )}

      {events.length > 0 && (
        <details className="rounded-2xl bg-white border border-violet-100 overflow-hidden" open={events.length <= 4}>
          <summary className="px-4 py-2.5 text-sm font-bold text-violet-700 cursor-pointer select-none list-none flex items-center justify-between">
            최근 소식 {events.length}개
            <span className="text-xs text-gray-400">펼치기/접기</span>
          </summary>
          <ul className="divide-y divide-violet-50 border-t border-violet-50">
            {events.map((ev, index) => (
              <li
                key={`${ev.event_type}-${ev.happened_at}-${index}`}
                className="px-4 py-2.5 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`min-w-0 truncate ${ev.student_id === myId ? "text-violet-800" : "text-gray-700"}`}>
                    {ev.event_type === "card_completed" ? (
                      <>
                        <b>{ev.student_name}</b> 님이 「{ev.song_title}」 포도송이를 완성했어요! 🎉
                      </>
                    ) : (
                      <>
                        <b>{ev.student_name}</b> 님이 「{ev.song_title}」 포도알을 채웠어요 🍇
                      </>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">{formatAgo(ev.happened_at)}</span>
                </div>

                {ev.target_id && (
                  <div className="mt-1.5 flex gap-1.5">
                    {EMOJIS.map((emoji) => {
                      const list = reactionsOf(ev.target_id, emoji);
                      const mine = list.some((r) => r.reactor_id === myId);
                      return (
                        <button
                          key={emoji}
                          type="button"
                          disabled={busyKey === `${ev.target_id}:${emoji}`}
                          onClick={() => react(ev, emoji)}
                          title={list.map((r) => r.reactor_name).join(", ") || "응원하기"}
                          className={`px-2 py-0.5 rounded-full text-xs border disabled:opacity-50 ${
                            mine
                              ? "bg-violet-100 border-violet-300 font-bold text-violet-700"
                              : "bg-gray-50 border-gray-200 text-gray-500"
                          }`}
                        >
                          {emoji}
                          {list.length > 0 && ` ${list.length}`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
