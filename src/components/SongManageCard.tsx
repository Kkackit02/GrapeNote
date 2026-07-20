"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSong, deleteSong } from "@/lib/actions/songs";
import { closeCards, reopenCards } from "@/lib/actions/cards";
import { LineupModal, type LineupStudent } from "@/components/LineupModal";
import { SongTracks } from "@/components/SongTracks";
import { instrumentBadge } from "@/lib/instruments";
import type { SongTrack } from "@/lib/types";

export interface SongSummary {
  title: string;
  mission: string | null;
  dueDate: string | null;
  totalGrapes: number;
  completedIds: string[];
  pendingCount: number;
  trackCount: number;
  /** 이 곡의 모든 카드 id (마감/해제 대상) */
  cardIds: string[];
  /** 마감된 카드 수 */
  closedCount: number;
}

interface Props {
  song: SongSummary;
  students: LineupStudent[];
  assignedIds: string[];
  /** 이 곡의 MR 목록 (모달에서 재생·추가·삭제) */
  tracks: SongTrack[];
  /** 로그인한 리더 id — 내가 올린 MR 삭제 판단용 */
  myId: string;
}

/** 곡 관리 카드: 편성·미션·기한·진행을 한 곳에서 보고 고친다 */
export function SongManageCard({ song, students, assignedIds, tracks, myId }: Props) {
  const router = useRouter();
  const [lineupOpen, setLineupOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tracksOpen, setTracksOpen] = useState(false);
  const [mission, setMission] = useState(song.mission ?? "");
  const [dueDate, setDueDate] = useState(song.dueDate ?? "");
  const [totalGrapes, setTotalGrapes] = useState(song.totalGrapes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assigned = students.filter((s) => assignedIds.includes(s.id));
  const completedSet = new Set(song.completedIds);

  const saveSettings = async () => {
    setError(null);
    setBusy(true);
    const result = await updateSong({ title: song.title, mission, dueDate: dueDate || null, totalGrapes });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.data.grapesSkipped > 0) {
      window.alert(
        `저장했어요. 다만 ${result.data.grapesSkipped}명은 제출 기록이 있어서 포도알 수를 줄이지 못했어요.`
      );
    }
    setSettingsOpen(false);
    router.refresh();
  };

  const close = async () => {
    if (
      !window.confirm(
        `「${song.title}」을(를) 마감할까요?\n· 멤버 ${assigned.length}명의 화면에서 사라지고 더 이상 제출할 수 없어요\n· 지난 제출 영상은 드라이브로 자동 백업돼요\n· 기록은 남고, 언제든 마감을 해제할 수 있어요`
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    const result = await closeCards(song.cardIds);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.alert(
      `🔒 「${song.title}」을(를) 마감했어요.` +
        (result.data.archiveSkipped
          ? "\n(드라이브 미연결이라 백업은 건너뛰었어요)"
          : `\n영상 ${result.data.archived}개를 드라이브에 백업했어요.`)
    );
    router.refresh();
  };

  const reopen = async () => {
    setError(null);
    setBusy(true);
    const result = await reopenCards(song.cardIds);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  const remove = async () => {
    const typed = window.prompt(
      `「${song.title}」을(를) 완전히 삭제해요.\n멤버 ${assigned.length}명의 카드·연습 영상·MR·곡 팀이 전부 사라지고 되돌릴 수 없어요!\n\n정말 삭제하려면 곡 이름을 그대로 입력해 주세요:`
    );
    if (typed === null) return;
    if (typed.trim() !== song.title) {
      window.alert("곡 이름이 일치하지 않아 삭제하지 않았어요.");
      return;
    }
    setBusy(true);
    const result = await deleteSong(song.title);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <section className="rounded-2xl bg-white border border-violet-100 p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-extrabold text-violet-900 truncate">
            {song.closedCount >= song.cardIds.length && song.cardIds.length > 0 ? "🔒 " : "🎵 "}
            {song.title}
          </h3>
          <p className="mt-0.5 text-xs text-gray-400">
            🍇 {song.totalGrapes}알
            {song.dueDate && ` · 📅 ~${song.dueDate}`}
            {song.trackCount > 0 && ` · 🎧 MR ${song.trackCount}개`}
          </p>
        </div>
        <span className="shrink-0 text-xs font-bold text-violet-600">
          {song.completedIds.length}/{assigned.length}명 완성
          {song.pendingCount > 0 && (
            <span className="ml-1 text-lime-600">👀{song.pendingCount}</span>
          )}
        </span>
      </div>

      {song.mission && (
        <p className="text-sm text-gray-600 whitespace-pre-line">
          <span className="font-bold text-sky-700">🎯</span> {song.mission}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {assigned.map((s) => (
          <span
            key={s.id}
            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              completedSet.has(s.id)
                ? "bg-violet-100 text-violet-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {instrumentBadge(s.instrument)} {s.name}
            {completedSet.has(s.id) && " 🏆"}
          </span>
        ))}
        {assigned.length === 0 && (
          <span className="text-xs text-gray-400">편성된 멤버가 없어요.</span>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => setLineupOpen(true)}
          className="px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-sm font-bold disabled:opacity-50 active:bg-violet-100"
        >
          👥 편성
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setSettingsOpen(true)}
          className="px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-sm font-bold disabled:opacity-50 active:bg-violet-100"
        >
          ✏️ 설정
        </button>
        <button
          type="button"
          onClick={() => setTracksOpen(true)}
          className="px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-sm font-bold active:bg-violet-100"
        >
          🎧 MR{song.trackCount > 0 && ` ${song.trackCount}`}
        </button>
        {song.closedCount >= song.cardIds.length && song.cardIds.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={reopen}
            className="px-3 py-2 rounded-xl bg-white border border-gray-300 text-gray-600 text-sm font-bold disabled:opacity-50"
          >
            🔓 마감 해제
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={close}
            className="px-3 py-2 rounded-xl bg-gray-700 text-white text-sm font-bold disabled:opacity-50 active:bg-gray-800"
          >
            🔒 마감
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="ml-auto px-3 py-2 rounded-xl bg-red-50 text-red-500 text-sm font-bold disabled:opacity-50 active:bg-red-100"
        >
          🗑
        </button>
      </div>

      {lineupOpen && (
        <LineupModal
          title={song.title}
          students={students}
          assignedIds={assignedIds}
          onClose={() => setLineupOpen(false)}
        />
      )}

      {tracksOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setTracksOpen(false)}
        >
          <div
            className="w-full max-w-sm max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <SongTracks songTitle={song.title} tracks={tracks} myId={myId} isTeacher />
            <button
              type="button"
              onClick={() => setTracksOpen(false)}
              className="mt-2 w-full h-12 rounded-2xl bg-white/90 text-gray-700 font-bold"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-violet-900">✏️ {song.title} 설정</h3>
            <p className="-mt-1 text-xs font-bold text-orange-600">
              ⚠️ 이 곡 편성 멤버 전원의 카드에 적용돼요.
            </p>
            <label className="flex flex-col gap-1 text-sm font-bold text-gray-700">
              🎯 미션
              <textarea
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                rows={3}
                className="rounded-xl border border-gray-300 p-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-sm font-bold text-gray-700">
                🍇 포도알
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={totalGrapes}
                  onChange={(e) => setTotalGrapes(Number(e.target.value))}
                  className="h-11 px-3 rounded-xl border border-gray-300 font-normal focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold text-gray-700">
                📅 기한
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-11 px-3 rounded-xl border border-gray-300 font-normal focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </label>
            </div>
            <p className="text-xs text-gray-400">이 곡의 모든 멤버 카드에 함께 적용돼요.</p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="h-12 rounded-xl bg-gray-100 text-gray-600 font-bold active:bg-gray-200"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveSettings}
                className="h-12 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
              >
                {busy ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
