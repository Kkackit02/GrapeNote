"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setLeaderAssignPermission } from "@/lib/actions/academy";
import { instrumentEmoji, parseInstruments } from "@/lib/instruments";

export interface AssignLeader {
  id: string;
  name: string;
  instrument: string | null;
  canAssign: boolean;
}

interface Props {
  leaders: AssignLeader[];
}

/** 파트장별 숙제 배정 권한 관리 — 리더가 특정 파트장에게만 권한을 준다 */
export function LeaderAssignManager({ leaders }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggle = async (leader: AssignLeader) => {
    setBusyId(leader.id);
    const result = await setLeaderAssignPermission(leader.id, !leader.canAssign);
    setBusyId(null);
    if (result.ok) router.refresh();
  };

  return (
    <div className="rounded-2xl bg-white border border-violet-100 p-4">
      <p className="font-bold text-gray-700 text-sm">🎯 파트장 숙제 배정 권한</p>
      <p className="mt-0.5 text-xs text-gray-400">
        권한을 준 파트장만 자기 팀원에게 숙제를 낼 수 있어요.
      </p>

      {leaders.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">
          아직 세션장(파트장)이 없어요. 팀 관리에서 파트장을 먼저 지정해 주세요.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {leaders.map((leader) => {
            const inst = parseInstruments(leader.instrument)[0];
            return (
              <li key={leader.id} className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-gray-700 truncate">
                  {inst ? `${instrumentEmoji(inst)} ` : "⭐ "}
                  {leader.name}
                </span>
                <button
                  type="button"
                  disabled={busyId === leader.id}
                  onClick={() => toggle(leader)}
                  aria-label={leader.canAssign ? "권한 회수" : "권한 부여"}
                  className={`shrink-0 w-13 h-7 rounded-full p-0.5 transition-colors disabled:opacity-50 ${
                    leader.canAssign ? "bg-violet-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${
                      leader.canAssign ? "translate-x-6" : ""
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
