"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  /** 현황판이 공개돼 있을 때만 탭을 보여준다 */
  boardShared: boolean;
}

/**
 * 멤버 화면 하단 고정 탭바.
 * 지금까지 포도밭·현황판은 홈으로 돌아가 스크롤해야만 갈 수 있었다 — 어디서든 한 번에 이동.
 */
export function BottomNav({ boardShared }: Props) {
  const pathname = usePathname();

  const tabs = [
    { href: "/me", label: "홈", emoji: "🏠", match: (p: string) => p === "/me" },
    {
      href: "/me/vineyard",
      label: "포도밭",
      emoji: "🍇",
      match: (p: string) => p.startsWith("/me/vineyard"),
    },
    {
      href: "/me/wall",
      label: "자랑벽",
      emoji: "🏆",
      match: (p: string) => p.startsWith("/me/wall"),
    },
    ...(boardShared
      ? [
          {
            href: "/me/board",
            label: "현황판",
            emoji: "📊",
            match: (p: string) => p.startsWith("/me/board"),
          },
        ]
      : []),
  ];

  return (
    <nav
      aria-label="주요 화면"
      className="sticky bottom-0 z-40 bg-white/95 backdrop-blur border-t border-violet-100 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-lg mx-auto grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${
                active ? "text-violet-700" : "text-gray-400"
              }`}
            >
              {/* 색만으로 구분하지 않도록 활성 표시 막대 */}
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-violet-600" aria-hidden />
              )}
              <span className="text-lg leading-none">{tab.emoji}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
