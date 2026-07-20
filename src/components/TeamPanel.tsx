"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createTeam,
  deleteTeam,
  renameTeam,
  addTeamMember,
  removeTeamMember,
  setTeamLeader,
} from "@/lib/actions/teams";
import { createInstrumentTeams } from "@/lib/actions/songs";
import { instrumentBadge } from "@/lib/instruments";
import type { ActionResult, Profile, Team, TeamMember } from "@/lib/types";

interface Props {
  teams: Team[];
  students: Profile[];
  memberships: TeamMember[];
}

/** 팀 목록 + 팀원/파트장 관리 패널. 한 학생이 여러 팀에 동시 소속될 수 있다. */
export function TeamPanel({ teams, students, memberships }: Props) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasInstruments = students.some((s) => s.instrument);

  const teamIdsOf = (studentId: string) =>
    memberships.filter((m) => m.profile_id === studentId).map((m) => m.team_id);
  const unassigned = students.filter((s) => teamIdsOf(s.id).length === 0);

  const run = async (action: () => Promise<ActionResult>) => {
    setError(null);
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  };

  const addTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run(() => createTeam(newName))) setNewName("");
  };

  const makeInstrumentTeams = async () => {
    setNotice(null);
    setError(null);
    setBusy(true);
    const result = await createInstrumentTeams();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(
      `악기 파트 팀 정리 완료 — 새 팀 ${result.data.teams}개, 멤버 ${result.data.added}명 추가. 이름 옆 ☆을 눌러 세션장을 지정해 보세요!`
    );
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={addTeam} className="flex gap-2">
        <input
          required
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="새 팀 이름 (예: 1팀, Tomboy 합주팀)"
          className="flex-1 h-12 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-5 h-12 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
        >
          + 팀 추가
        </button>
      </form>

      <button
        type="button"
        disabled={busy}
        onClick={makeInstrumentTeams}
        className="self-start px-4 py-2 rounded-xl bg-white border border-violet-300 text-violet-700 text-sm font-bold disabled:opacity-50 active:bg-violet-100"
        title={hasInstruments ? undefined : "학생 상세에서 악기를 먼저 지정해 주세요"}
      >
        🎸 악기 파트 팀 만들기
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {notice && <p className="text-sm font-bold text-violet-700">{notice}</p>}

      {teams.length === 0 && (
        <div className="rounded-2xl bg-white border border-violet-100 p-8 text-center text-gray-500">
          아직 팀이 없어요. 위에서 첫 팀을 만들어 보세요!
        </div>
      )}

      {teams.map((team) => {
        const memberIds = memberships
          .filter((m) => m.team_id === team.id)
          .map((m) => m.profile_id);
        const members = students.filter((s) => memberIds.includes(s.id));
        // 이 팀에 아직 없는 학생은 전부 후보 — 다른 팀 소속이어도 추가 가능 (다중 소속)
        const candidates = students.filter((s) => !memberIds.includes(s.id));
        return (
          <section key={team.id} className="rounded-2xl bg-white border border-violet-100 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <input
                defaultValue={team.name}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== team.name) run(() => renameTeam(team.id, name));
                }}
                className="flex-1 min-w-0 text-lg font-extrabold text-violet-900 bg-transparent rounded-lg px-1 -mx-1 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`'${team.name}' 팀을 없앨까요?\n팀 묶음만 사라지고, 학생과 다른 팀 소속은 그대로예요.`)) {
                    run(() => deleteTeam(team.id));
                  }
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-sm font-bold disabled:opacity-50 active:bg-red-100"
              >
                팀 삭제
              </button>
            </div>

            {members.length === 0 ? (
              <p className="text-sm text-gray-400">아직 팀원이 없어요.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
                      team.leader_id === m.id
                        ? "bg-amber-50 text-amber-800 border border-amber-300"
                        : "bg-violet-50 text-violet-800"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(() => setTeamLeader(team.id, team.leader_id === m.id ? null : m.id))
                      }
                      aria-label={
                        team.leader_id === m.id
                          ? `${m.display_name} 파트장 해제`
                          : `${m.display_name} 파트장으로 지정`
                      }
                      title={team.leader_id === m.id ? "파트장 해제" : "파트장으로 지정"}
                      className="text-base leading-none"
                    >
                      {team.leader_id === m.id ? "⭐" : "☆"}
                    </button>
                    {m.instrument && `${instrumentBadge(m.instrument)} `}
                    {m.display_name}
                    {teamIdsOf(m.id).length > 1 && (
                      <span className="text-[10px] font-bold text-violet-400">
                        +{teamIdsOf(m.id).length - 1}팀
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => removeTeamMember(team.id, m.id))}
                      aria-label={`${m.display_name} 이 팀에서 빼기`}
                      className="text-violet-400 active:text-violet-700"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {members.length > 0 && (
              <p className="text-xs text-gray-400 -mt-1">
                ☆을 누르면 파트장(세션장) 지정 — 파트장은 팀원 영상을 검토할 수 있어요.
              </p>
            )}

            {candidates.length > 0 && (
              <select
                value=""
                disabled={busy}
                onChange={(e) => {
                  if (e.target.value) run(() => addTeamMember(team.id, e.target.value));
                }}
                className="h-11 px-3 rounded-xl border border-dashed border-violet-300 text-sm font-bold text-violet-600"
              >
                <option value="">+ 팀원 넣기... (다른 팀 소속이어도 돼요)</option>
                {candidates.map((s) => {
                  const others = teamIdsOf(s.id)
                    .map((id) => teams.find((t) => t.id === id)?.name)
                    .filter(Boolean);
                  return (
                    <option key={s.id} value={s.id}>
                      {s.display_name}
                      {others.length > 0 ? ` (${others.join(", ")} 소속)` : ""}
                    </option>
                  );
                })}
              </select>
            )}

            {members.length > 0 && (
              <Link
                href={`/teacher/cards/new?team=${team.id}`}
                className="text-sm font-bold text-violet-600 self-start"
              >
                🍇 이 팀에게 숙제 배정하기 →
              </Link>
            )}
          </section>
        );
      })}

      {unassigned.length > 0 && teams.length > 0 && (
        <p className="text-sm text-gray-500">
          무소속: {unassigned.map((s) => s.display_name).join(", ")}
        </p>
      )}
    </div>
  );
}
