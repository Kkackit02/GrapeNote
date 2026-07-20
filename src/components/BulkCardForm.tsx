"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCard } from "@/lib/actions/cards";
import { SongTitleField } from "./SongTitleField";
import type { Profile } from "@/lib/types";

export interface TeamOption {
  id: string;
  name: string;
  memberIds: string[];
}

interface Props {
  students: Profile[];
  teams?: TeamOption[];
  /** 팀 페이지에서 넘어온 경우 최초 선택할 팀 */
  initialTeamId?: string | null;
}

/** 공통 카드 배정: 팀/전체/개별 선택 + 곡 정보. 팀으로 배정하면 팀 숙제가 되어 새 팀원에게도 자동 배정된다. */
export function BulkCardForm({ students, teams = [], initialTeamId = null }: Props) {
  const router = useRouter();
  const initialTeam = teams.find((t) => t.id === initialTeamId) ?? null;
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialTeam ? initialTeam.memberIds : students.map((s) => s.id))
  );
  const [activeTeamId, setActiveTeamId] = useState<string | null>(initialTeam?.id ?? null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalGrapes, setTotalGrapes] = useState(10);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allSelected = selected.size === students.length;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setActiveTeamId(null); // 수동으로 바꾸면 개인 배정 (팀 연결 해제)
  };

  const selectTeam = (team: TeamOption) => {
    setSelected(new Set(team.memberIds));
    setActiveTeamId(team.id);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await createCard({
      studentIds: [...selected],
      title,
      description,
      totalGrapes,
      dueDate: dueDate || null,
      teamId: activeTeamId,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/teacher");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <section className="rounded-2xl bg-white border border-violet-100 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-700">
            누구에게 줄까요? <span className="text-violet-600">({selected.size}명)</span>
          </h2>
          <button
            type="button"
            onClick={() => {
              setSelected(allSelected ? new Set() : new Set(students.map((s) => s.id)));
              setActiveTeamId(null);
            }}
            className="text-sm font-bold text-violet-600"
          >
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
        </div>

        {teams.length > 0 && (
          <div className="mt-3 flex gap-1.5 flex-wrap items-center">
            <span className="text-xs font-bold text-gray-400">팀 숙제로 배정:</span>
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => selectTeam(team)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  activeTeamId === team.id
                    ? "bg-violet-600 text-white"
                    : "bg-violet-50 text-violet-700 active:bg-violet-200"
                }`}
              >
                👥 {team.name} ({team.memberIds.length})
              </button>
            ))}
          </div>
        )}
        {activeTeamId && (
          <p className="mt-2 text-xs text-violet-600 font-medium">
            팀 숙제예요 — 나중에 이 팀에 들어오는 새 팀원에게도 자동으로 배정돼요!
          </p>
        )}
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {students.map((student) => {
            const on = selected.has(student.id);
            return (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => toggle(student.id)}
                  className={`w-full h-12 rounded-xl border-2 font-bold text-sm transition-colors ${
                    on
                      ? "border-violet-500 bg-violet-50 text-violet-800"
                      : "border-gray-200 bg-white text-gray-400"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {student.display_name}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl bg-white border border-violet-100 p-4 flex flex-col gap-3">
        <h2 className="font-bold text-gray-700">어떤 곡인가요?</h2>
        <SongTitleField value={title} onChange={setTitle} />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="지시사항 (예: 손목 힘 빼고 천천히)"
          className="h-12 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <label className="flex items-center justify-between text-sm font-medium text-gray-700">
          포도알 개수 (연습 횟수)
          <select
            value={totalGrapes}
            onChange={(e) => setTotalGrapes(Number(e.target.value))}
            className="h-10 px-3 rounded-lg border border-gray-300 font-bold text-violet-700"
          >
            {[5, 10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>{n}알</option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between text-sm font-medium text-gray-700">
          기한 (선택)
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-10 px-3 rounded-lg border border-gray-300 font-bold text-violet-700"
          />
        </label>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting || selected.size === 0}
        className="h-14 rounded-2xl bg-violet-600 text-white text-lg font-bold disabled:opacity-50 active:bg-violet-800"
      >
        {submitting
          ? "배정 중..."
          : selected.size === 0
            ? "배정할 사람을 선택해 주세요"
            : `${selected.size}명에게 배정하기 🍇`}
      </button>
    </form>
  );
}
