import { formatAgo, type FeedEvent, type WeeklyStat } from "@/lib/activity";

interface Props {
  events: FeedEvent[];
  /** 이번 주 제출 1위 (0개면 null로 넘길 것) */
  champion: WeeklyStat | null;
  /** 보는 사람 자신 (내 소식 강조) */
  myId: string;
}

/** 그룹 소식 피드: 멤버들의 완성·합격 이벤트 + 이번 주 연습왕 */
export function GroupFeed({ events, champion, myId }: Props) {
  if (!champion && events.length === 0) return null;

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
        <ul className="rounded-2xl bg-white border border-violet-100 divide-y divide-violet-50">
          {events.map((ev, index) => (
            <li
              key={`${ev.event_type}-${ev.happened_at}-${index}`}
              className="px-4 py-2.5 text-sm flex items-center justify-between gap-2"
            >
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
