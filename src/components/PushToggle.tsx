"use client";

import { useEffect, useState } from "react";
import {
  savePushSubscription,
  removePushSubscription,
  sendTestPush,
} from "@/lib/actions/push";

type State = "loading" | "unsupported" | "off" | "on" | "denied";

/** base64url VAPID 공개키 → Uint8Array */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

/** 웹푸시 알림 켜기/끄기 — 기기별 구독 */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (
        !vapidPublicKey ||
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const existing = await registration?.pushManager.getSubscription();
      if (!cancelled) setState(existing ? "on" : "off");
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const json = subscription.toJSON();
      const result = await savePushSubscription({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setState("on");
      const test = await sendTestPush();
      setMessage(test.ok ? "알림을 켰어요! 테스트 알림을 보냈어요 🔔" : "알림을 켰어요!");
    } catch {
      setMessage("알림을 켜지 못했어요. 브라우저 설정을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading" || state === "unsupported") return null;

  return (
    <div className="rounded-2xl bg-white border border-violet-100 p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-bold text-gray-700 text-sm">🔔 알림 받기</p>
        <p className="mt-0.5 text-xs text-gray-400">
          {state === "denied"
            ? "브라우저에서 알림이 차단돼 있어요. 주소창 옆 자물쇠 → 알림 허용으로 바꿔 주세요."
            : state === "on"
              ? "이 기기로 새 영상·판정 소식을 받고 있어요."
              : "새 영상이 올라오거나 판정이 나오면 이 기기로 알려드려요."}
        </p>
        {message && <p className="mt-1 text-xs font-bold text-violet-700">{message}</p>}
      </div>
      {state !== "denied" && (
        <button
          type="button"
          disabled={busy}
          onClick={state === "on" ? disable : enable}
          aria-label={state === "on" ? "알림 끄기" : "알림 켜기"}
          className={`shrink-0 w-13 h-7 rounded-full p-0.5 transition-colors disabled:opacity-50 ${
            state === "on" ? "bg-violet-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${
              state === "on" ? "translate-x-6" : ""
            }`}
          />
        </button>
      )}
    </div>
  );
}
