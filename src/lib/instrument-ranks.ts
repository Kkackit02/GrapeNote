import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { parseInstruments } from "@/lib/instruments";
import type { Profile, ProgressCard } from "@/lib/types";

export interface RankedMember {
  studentId: string;
  name: string;
  grapes: number; // 합격(포도알) 수 — 순위 기준
  bunches: number; // 완성 포도송이 — 동점 시 타이브레이크
  rank: number; // 1부터
}

export interface InstrumentRank {
  instrument: string;
  members: RankedMember[]; // 포도송이 많은 순
}

/** 순위별 칭호 (악기명과 조합). 1~3위만 특별 칭호. */
export function rankTitle(instrument: string, rank: number): { emoji: string; name: string } | null {
  if (rank === 1) return { emoji: "👑", name: `${instrument} 킹` };
  if (rank === 2) return { emoji: "🥈", name: `${instrument} 짱` };
  if (rank === 3) return { emoji: "🥉", name: `${instrument} 좌` };
  return null;
}

/**
 * 그룹의 악기별 순위 — 포도알(합격) 수 기준, 동점이면 포도송이 수로 가른다.
 * 학생 RLS로는 남의 기록을 못 보므로 service role로 집계한다.
 * 겸업 멤버는 맡은 악기마다 순위에 든다. 합격 0개인 멤버는 제외.
 */
export async function getInstrumentRanks(academyId: string): Promise<InstrumentRank[]> {
  const admin = createSupabaseAdmin();
  const [{ data: profileRows }, { data: cardRows }, { data: subRows }] = await Promise.all([
    admin.from("profiles").select("id, display_name, instrument").eq("academy_id", academyId).eq("role", "student"),
    admin.from("progress_cards").select("student_id, completed_at").eq("academy_id", academyId),
    admin.from("submissions").select("student_id").eq("academy_id", academyId).eq("status", "approved"),
  ]);
  const profiles = (profileRows ?? []) as Pick<Profile, "id" | "display_name" | "instrument">[];
  const cards = (cardRows ?? []) as Pick<ProgressCard, "student_id" | "completed_at">[];
  const subs = (subRows ?? []) as { student_id: string }[];

  const grapesOf = new Map<string, number>();
  for (const s of subs) grapesOf.set(s.student_id, (grapesOf.get(s.student_id) ?? 0) + 1);
  const bunchesOf = new Map<string, number>();
  for (const c of cards) {
    if (c.completed_at) bunchesOf.set(c.student_id, (bunchesOf.get(c.student_id) ?? 0) + 1);
  }

  const byInstrument = new Map<string, RankedMember[]>();
  for (const p of profiles) {
    const grapes = grapesOf.get(p.id) ?? 0;
    if (grapes === 0) continue; // 연습(합격) 기록 없으면 제외
    const bunches = bunchesOf.get(p.id) ?? 0;
    for (const inst of parseInstruments(p.instrument)) {
      const list = byInstrument.get(inst) ?? [];
      list.push({ studentId: p.id, name: p.display_name, grapes, bunches, rank: 0 });
      byInstrument.set(inst, list);
    }
  }

  const result: InstrumentRank[] = [];
  for (const [instrument, members] of byInstrument) {
    // 포도알 많은 순 → 동점이면 포도송이 → 그래도 같으면 이름
    members.sort(
      (a, b) => b.grapes - a.grapes || b.bunches - a.bunches || a.name.localeCompare(b.name, "ko")
    );
    members.forEach((m, i) => (m.rank = i + 1));
    result.push({ instrument, members });
  }
  result.sort((a, b) => a.instrument.localeCompare(b.instrument, "ko"));
  return result;
}
