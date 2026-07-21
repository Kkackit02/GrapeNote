"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { assignHomeworkAsLeader } from "@/lib/actions/cards";
import { instrumentEmoji, parseInstruments } from "@/lib/instruments";

export interface AssignMember {
  id: string;
  name: string;
  instrument: string | null;
}

interface Props {
  members: AssignMember[];
}

/** 파트장이 자기 팀원에게 숙제를 내는 폼 */
export function LeaderAssignForm({ members }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [mission, setMission] = useState("");
  const [totalGrapes, setTotalGrapes] = useState(5);
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await assignHomeworkAsLeader({
      studentIds: [...selected],
      title,
      description: mission,
      totalGrapes,
      dueDate: dueDate || null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // 검토함으로 보내면 아직 제출이 없어 '빈 화면'이라 실패처럼 보인다.
    // 이 자리에서 결과를 알리고 폼을 비워 이어서 내기 쉽게 한다.
    setDone(`「${title}」 숙제를 ${result.data.count}명에게 냈어요!`);
    setSelected(new Set());
    setTitle("");
    setMission("");
    setDueDate("");
    router.refresh();
  };

  if (members.length === 0) {
    return (
      <p className="rounded-2xl bg-white border border-violet-100 p-6 text-center text-gray-500">
        아직 내 팀에 팀원이 없어요.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {done && (
        <div className="rounded-2xl bg-lime-50 border border-lime-300 p-3 text-sm">
          <p className="font-bold text-lime-900">✅ {done}</p>
          <Link href="/me/review" className="mt-1 inline-block font-bold text-lime-700 underline underline-offset-2">
            검토함에서 확인하기 →
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span className="font-bold text-gray-700">
          👥 누구에게 낼까요? <span className="text-violet-600">{selected.size}명</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const on = selected.has(m.id);
            const inst = parseInstruments(m.instrument)[0];
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className={`px-3.5 py-2 rounded-full text-sm font-bold border-2 ${
                  on ? "bg-violet-600 border-violet-600 text-white" : "bg-white border-violet-200 text-gray-700"
                }`}
              >
                {on ? "✓ " : ""}
                {inst ? `${instrumentEmoji(inst)} ` : ""}
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-bold text-gray-700">🎵 곡/숙제 이름</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 혁오 - TOMBOY"
          className="h-12 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-bold text-gray-700">🎯 미션 (선택)</span>
        <textarea
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          rows={3}
          placeholder={"예: 1절은 악보 안 보고 치기"}
          className="px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-bold text-gray-700">🍇 포도알</span>
          <input
            type="number"
            min={1}
            max={60}
            value={totalGrapes}
            onChange={(e) => setTotalGrapes(Number(e.target.value))}
            className="h-12 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-bold text-gray-700">📅 기한 (선택)</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-12 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={busy || selected.size === 0 || !title.trim()}
        className="h-13 py-3.5 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
      >
        {busy ? "배정 중..." : `🎯 숙제 내기 (${selected.size}명)`}
      </button>
    </form>
  );
}
