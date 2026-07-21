import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { parseInstruments } from "@/lib/instruments";
import type { Profile, ProgressCard } from "@/lib/types";

export interface RankedMember {
  studentId: string;
  name: string;
  bunches: number;
  rank: number; // 1부터
}

export interface InstrumentRank {
  instrument: string;
  members: RankedMember[]; // 포도송이 많은 순
}

/** 순위별 칭호 (악기명과 조합). 1~3위만 특별 칭호. */
export function rankTitle(instrument: string, rank: number): { emoji: string; name: string } | null {
  if (rank === 1) return { emoji: "👑", name: `${instrument} 지존` };
  if (rank === 2) return { emoji: "🥈", name: `${instrument} 고수` };
  if (rank === 3) return { emoji: "🥉", name: `${instrument} 유망주` };
  return null;
}

/**
 * 그룹의 악기별 포도송이 순위. 학생 RLS로는 남의 기록을 못 보므로 service role로 집계한다.
 * 겸업 멤버는 맡은 악기마다 순위에 든다. 포도송이 0개인 멤버는 제외.
 */
export async function getInstrumentRanks(academyId: string): Promise<InstrumentRank[]> {
  const admin = createSupabaseAdmin();
  const [{ data: profileRows }, { data: cardRows }] = await Promise.all([
    admin.from("profiles").select("id, display_name, instrument").eq("academy_id", academyId).eq("role", "student"),
    admin.from("progress_cards").select("student_id, completed_at").eq("academy_id", academyId),
  ]);
  const profiles = (profileRows ?? []) as Pick<Profile, "id" | "display_name" | "instrument">[];
  const cards = (cardRows ?? []) as Pick<ProgressCard, "student_id" | "completed_at">[];

  const bunchesOf = new Map<string, number>();
  for (const c of cards) {
    if (c.completed_at) bunchesOf.set(c.student_id, (bunchesOf.get(c.student_id) ?? 0) + 1);
  }

  const byInstrument = new Map<string, RankedMember[]>();
  for (const p of profiles) {
    const bunches = bunchesOf.get(p.id) ?? 0;
    if (bunches === 0) continue;
    for (const inst of parseInstruments(p.instrument)) {
      const list = byInstrument.get(inst) ?? [];
      list.push({ studentId: p.id, name: p.display_name, bunches, rank: 0 });
      byInstrument.set(inst, list);
    }
  }

  const result: InstrumentRank[] = [];
  for (const [instrument, members] of byInstrument) {
    members.sort((a, b) => b.bunches - a.bunches || a.name.localeCompare(b.name, "ko"));
    members.forEach((m, i) => (m.rank = i + 1));
    result.push({ instrument, members });
  }
  result.sort((a, b) => a.instrument.localeCompare(b.instrument, "ko"));
  return result;
}
