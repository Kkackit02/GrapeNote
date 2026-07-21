"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSong } from "@/lib/actions/songs";
import { instrumentEmoji, parseInstruments } from "@/lib/instruments";
import { MissionPresets } from "./MissionPresets";
import type { Profile } from "@/lib/types";

interface Props {
  students: Profile[];
}

/** 곡 추가 마법사: 곡명 + 미션 + 편성(악기별) + 포도알/기한을 한 화면에서 */
export function SongWizard({ students }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [mission, setMission] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [totalGrapes, setTotalGrapes] = useState(5);
  const [dueDate, setDueDate] = useState("");
  const [autoAssign, setAutoAssign] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 악기별 그룹 (겸업 멤버는 여러 그룹에 등장, 미지정은 맨 뒤)
  const groups = new Map<string, Profile[]>();
  for (const s of students) {
    const list = parseInstruments(s.instrument);
    for (const key of list.length > 0 ? list : [""]) {
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
  }
  const groupKeys = [...groups.keys()].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b, "ko");
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await createSong({
      title,
      mission,
      memberIds: [...selected],
      totalGrapes,
      dueDate: dueDate || null,
      autoAssign,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/teacher/board");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="font-bold text-gray-700">🎵 곡 이름</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 혁오 - TOMBOY"
          className="h-12 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-bold text-gray-700">🎯 미션 (어떻게 연습할까요?)</span>
        <textarea
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          rows={3}
          placeholder={"예: 1절은 악보 안 보고 치기\n원곡 템포의 90%로 정확하게"}
          className="px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <span className="text-xs text-gray-400">멤버 카드 상단에 크게 표시돼요.</span>
        <MissionPresets onPick={(t) => setMission((m) => (m.trim() ? `${m}
${t}` : t))} />
      </label>

      <div className="flex flex-col gap-2">
        <span className="font-bold text-gray-700">
          👥 편성 멤버 <span className="text-violet-600">{selected.size}명</span>
        </span>
        {students.length === 0 ? (
          <p className="text-sm text-gray-500">
            아직 등록된 멤버가 없어요. 곡은 멤버에게 배정되니{" "}
            <Link href="/teacher/students/new" className="font-bold text-violet-600 underline">
              멤버부터 초대
            </Link>
            해 주세요!
          </p>
        ) : (
          groupKeys.map((key) => (
            <div key={key || "none"}>
              <p className="text-xs font-bold text-gray-400 mb-1.5">
                {key ? `${instrumentEmoji(key)} ${key}` : "🎵 악기 미지정"}
              </p>
              <div className="flex flex-wrap gap-2">
                {groups.get(key)!.map((s) => {
                  const on = selected.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={`px-3.5 py-2 rounded-full text-sm font-bold border-2 ${
                        on
                          ? "bg-violet-600 border-violet-600 text-white"
                          : "bg-white border-violet-200 text-gray-700"
                      }`}
                    >
                      {on ? "✓ " : ""}
                      {s.display_name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-bold text-gray-700">🍇 포도알 (연습 횟수)</span>
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

      <label className="flex items-start gap-2.5 rounded-xl bg-violet-50 border border-violet-100 p-3 cursor-pointer">
        <input
          type="checkbox"
          checked={autoAssign}
          onChange={(e) => setAutoAssign(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-violet-600"
        />
        <span className="text-sm">
          <span className="font-bold text-gray-700">🔁 나중에 합류하는 멤버에게도 자동 배정</span>
          <span className="block text-xs text-gray-400 mt-0.5">
            {autoAssign
              ? "곡 팀이 함께 만들어져, 이후 합류하는 멤버에게 이 곡이 자동으로 배정돼요."
              : "지금 고른 멤버에게만 배정해요. (합류자에게 줄 땐 나중에 직접 배정)"}
          </span>
        </span>
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={busy || selected.size === 0}
        className="h-13 py-3.5 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
      >
        {busy ? "만드는 중..." : `🎵 곡 만들기 (${selected.size}명에게 배정)`}
      </button>
    </form>
  );
}
