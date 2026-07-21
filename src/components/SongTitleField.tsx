"use client";

import { useState } from "react";
import type { GroupType } from "@/lib/terms";

const BOOKS = [
  { key: "custom", label: "직접 입력", max: 0 },
  { key: "바이엘", label: "바이엘", max: 106 },
  { key: "체르니 100", label: "체르니 100", max: 100 },
  { key: "체르니 30", label: "체르니 30", max: 30 },
  { key: "체르니 40", label: "체르니 40", max: 40 },
  { key: "하농", label: "하농", max: 60 },
  { key: "부르크뮐러 25", label: "부르크뮐러 25", max: 25 },
  { key: "소나티네", label: "소나티네", max: 20 },
] as const;

interface Props {
  value: string;
  onChange: (title: string) => void;
  /** 교재 프리셋(바이엘·체르니…)은 학원에서만 의미가 있다. 밴드/동아리엔 숨긴다. */
  groupType?: GroupType;
}

/** 곡 제목 입력. 학원이면 교재 프리셋 + 번호 선택도 제공한다. */
export function SongTitleField({ value, onChange, groupType = "academy" }: Props) {
  const showBooks = groupType === "academy";
  const [bookKey, setBookKey] = useState<string>("custom");
  const [number, setNumber] = useState("");
  const book = BOOKS.find((b) => b.key === bookKey)!;

  const selectBook = (key: string) => {
    setBookKey(key);
    const selected = BOOKS.find((b) => b.key === key)!;
    if (key === "custom") {
      onChange("");
    } else {
      onChange(number ? `${selected.key} - ${number}번` : "");
    }
  };

  const changeNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 3);
    setNumber(digits);
    if (bookKey !== "custom") {
      onChange(digits ? `${book.key} - ${digits}번` : "");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {showBooks && (
      <div className="flex gap-2">
        <select
          value={bookKey}
          onChange={(e) => selectBook(e.target.value)}
          className="flex-1 h-12 px-3 rounded-xl border border-gray-300 text-sm font-bold text-violet-700"
        >
          {BOOKS.map((b) => (
            <option key={b.key} value={b.key}>{b.label}</option>
          ))}
        </select>
        {bookKey !== "custom" && (
          <div className="flex items-center gap-1">
            <input
              value={number}
              onChange={(e) => changeNumber(e.target.value)}
              inputMode="numeric"
              placeholder={`1~${book.max}`}
              className="w-20 h-12 px-3 rounded-xl border border-gray-300 text-center font-bold focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <span className="text-sm font-bold text-gray-500">번</span>
          </div>
        )}
      </div>
      )}
      {!showBooks || bookKey === "custom" ? (
        <input
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={showBooks ? "곡 이름 (예: 젓가락 행진곡)" : "곡 이름 (예: 혁오 - TOMBOY)"}
          className="h-12 px-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      ) : (
        value && (
          <p className="text-sm text-gray-500">
            카드 제목: <b className="text-violet-700">{value}</b>
          </p>
        )
      )}
    </div>
  );
}
