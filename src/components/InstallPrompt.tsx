"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "hidden" | "installable" | "ios";

/**
 * 홈 화면에 추가(PWA 설치) 안내.
 * 안드로이드·크롬은 버튼 한 번으로 설치되고, iOS는 프로그램 설치가 막혀 있어 방법만 알려준다.
 * iOS에서는 홈 화면에 추가해야 웹푸시 알림이 동작하므로 안내가 특히 중요하다.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem("grapenote-install-dismissed") === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("installable");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS 사파리는 beforeinstallprompt가 없다 — 직접 판별해 안내를 띄운다
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) {
      queueMicrotask(() => setMode((prev) => (prev === "hidden" ? "ios" : prev)));
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (mode === "hidden" || dismissed) return null;

  const close = () => {
    localStorage.setItem("grapenote-install-dismissed", "1");
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setDismissed(true);
  };

  return (
    <div className="rounded-2xl bg-violet-50 border border-violet-200 p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-bold text-violet-900 text-sm">📱 앱처럼 쓰기</p>
        {mode === "installable" ? (
          <p className="mt-0.5 text-xs text-violet-700">
            홈 화면에 추가하면 앱처럼 열리고 알림도 받을 수 있어요.
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-violet-700">
            아이폰은 아래 <b>공유 버튼</b>
            <span className="mx-0.5">⬆️</span>→ <b>&quot;홈 화면에 추가&quot;</b>를 눌러 주세요.
            <br />
            추가해야 🔔 알림을 받을 수 있어요.
          </p>
        )}
      </div>
      <div className="shrink-0 flex flex-col gap-1.5">
        {mode === "installable" && (
          <button
            type="button"
            onClick={install}
            className="px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold active:bg-violet-800"
          >
            추가하기
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="text-xs text-violet-400 underline underline-offset-2"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
