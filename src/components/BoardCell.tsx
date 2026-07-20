"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateCardSettings } from "@/lib/actions/cards";
import { dueBadge } from "@/lib/due";

export interface BoardCellData {
  label: string;
  className: string;
  href: string;
  studentName: string;
  card: {
    id: string;
    title: string;
    description: string | null;
    totalGrapes: number;
    dueDate: string | null;
  };
  done: number;
  pendingCount: number;
  retryCount: number;
}

/**
 * 현황판 칸: 요약 팝업(진행·미션·기한 + 바로가기 + 수정).
 * 마우스는 호버로, 터치는 탭으로 연다 — 터치 기기에서는 탭이 바로 이동하지 않는다.
 */
export function BoardCell({ data }: { data: BoardCellData }) {
  const router = useRouter();
  const [popup, setPopup] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [totalGrapes, setTotalGrapes] = useState(data.card.totalGrapes);
  const [description, setDescription] = useState(data.card.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const due = dueBadge(data.card.dueDate);

  const openPopupAt = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setPopup({ x: rect.left + rect.width / 2, y: rect.top });
  };

  const isTouch = () =>
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  const showPopup = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouch()) return; // 터치 기기에서는 클릭으로만 연다
    openPopupAt(e.currentTarget);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isTouch()) return; // 마우스는 링크 그대로 동작
    e.preventDefault();
    if (popup) setPopup(null);
    else openPopupAt(e.currentTarget);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await updateCardSettings({
      cardId: data.card.id,
      totalGrapes,
      description,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    setPopup(null);
    router.refresh();
  };

  return (
    <div
      onMouseEnter={showPopup}
      onMouseLeave={() => !isTouch() && setPopup(null)}
      onClick={handleClick}
      className="relative"
    >
      <Link href={data.href} className="block px-2 py-2">
        {data.label}
      </Link>

      {/* 터치에서 바깥을 눌러 닫기 */}
      {popup && (
        <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setPopup(null)} />
      )}

      {popup && (
        <div
          className="fixed z-50 w-56 -translate-x-1/2 -translate-y-full rounded-xl bg-gray-900 text-white text-xs shadow-xl p-3 text-left"
          style={{ left: popup.x, top: popup.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-bold text-sm">
            {data.studentName} · {data.card.title}
          </p>
          <div className="mt-1.5 flex flex-col gap-0.5 text-gray-300">
            <span>🍇 {data.done} / {data.card.totalGrapes}알 채움</span>
            {data.pendingCount > 0 && <span>👀 검토 대기 {data.pendingCount}개</span>}
            {data.retryCount > 0 && <span>↺ 재연습 중 {data.retryCount}개</span>}
            <span>🎯 미션: {data.card.description || "없음"}</span>
            {due && <span>📅 {due.text}</span>}
          </div>
          <div className="mt-2 flex gap-1.5">
            <Link
              href={data.href}
              className="flex-1 text-center rounded-lg bg-white/15 py-2 font-bold hover:bg-white/25"
            >
              {data.pendingCount > 0 ? "검토하기" : "카드 보기"}
            </Link>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 rounded-lg bg-violet-500 py-2 font-bold hover:bg-violet-400"
            >
              ✏️ 수정
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 text-left"
            onMouseEnter={(e) => e.stopPropagation()}
          >
            <h3 className="font-extrabold text-violet-900">
              ✏️ {data.studentName} · {data.card.title}
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">이 카드만 바뀌어요 (다른 멤버는 그대로).</p>
            <label className="mt-4 flex items-center justify-between text-sm font-medium text-gray-700">
              포도알 개수 (연습 횟수)
              <input
                type="number"
                min={1}
                max={60}
                value={totalGrapes}
                onChange={(e) => setTotalGrapes(Number(e.target.value))}
                className="w-24 h-10 px-3 rounded-lg border border-gray-300 text-center font-bold text-violet-700"
              />
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="🎯 미션 (예: 1절은 악보 안 보고 치기)"
              className="mt-3 w-full rounded-xl border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setEditing(false); setError(null); }}
                className="h-11 rounded-xl bg-gray-100 text-gray-600 font-bold active:bg-gray-200"
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={save}
                className="h-11 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 active:bg-violet-800"
              >
                {busy ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
