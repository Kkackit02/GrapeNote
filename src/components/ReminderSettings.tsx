"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setReminderDays } from "@/lib/actions/reminders";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  /** 저장된 요일 (KST 0=일~6=토). 비면 꺼짐 */
  initialDays: number[];
}

/**
 * 연습 리마인더 설정 — 고른 요일 저녁에 '오늘 아직 연습 안 한' 멤버에게 알림.
 * 요일을 하나도 안 고르면 리마인더가 꺼진다.
 */
export function ReminderSettings({ initialDays }: Props) {
  const router = useRouter();
  const [days, setDays] = useState<Set<number>>(new Set(initialDays));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const on = days.size > 0;

  const persist = async (next: Set<number>) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await setReminderDays([...next]);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  };

  const toggleDay = (d: number) => {
    const next = new Set(days);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setDays(next);
    void persist(next);
  };

  const setPreset = (preset: number[]) => {
    const next = new Set(preset);
    setDays(next);
    void persist(next);
  };

  return (
    <div className="rounded-2xl bg-white border border-violet-100 p-4">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-700">🔔 연습 리마인더</span>
        <span className={`text-xs font-bold ${on ? "text-violet-600" : "text-gray-400"}`}>
          {on ? "켜짐" : "꺼짐"}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        고른 요일 저녁에, 그날 아직 연습 영상을 안 올린 멤버에게 살짝 알림을 보내요.
      </p>

      <div className="mt-3 flex gap-1.5">
        {DAYS.map((label, d) => (
          <button
            key={d}
            type="button"
            disabled={saving}
            onClick={() => toggleDay(d)}
            className={`flex-1 h-10 rounded-xl text-sm font-bold disabled:opacity-60 ${
              days.has(d)
                ? "bg-violet-600 text-white"
                : "bg-violet-50 text-violet-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2 text-xs">
        <button
          type="button"
          disabled={saving}
          onClick={() => setPreset([1, 2, 3, 4, 5])}
          className="font-bold text-violet-600 underline underline-offset-2 disabled:opacity-50"
        >
          평일마다
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setPreset([])}
          className="font-bold text-gray-400 underline underline-offset-2 disabled:opacity-50"
        >
          끄기
        </button>
        {saved && !error && <span className="ml-auto text-gray-400">저장됐어요</span>}
      </div>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
