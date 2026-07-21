"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { requestUpload, confirmUpload } from "@/lib/actions/uploads";

export interface UploadTask {
  id: string;
  cardId: string;
  grapeIndex: number;
  file: File;
  title?: string;
  comment?: string;
  /** 어떤 악기로 연습했는지 */
  instrument?: string;
  /** 0..1 */
  progress: number;
  status: "preparing" | "uploading" | "confirming" | "done" | "error";
  error?: string;
}

interface UploadManagerValue {
  uploads: UploadTask[];
  /** 백그라운드 업로드 시작. 즉시 반환한다. */
  startUpload(input: {
    cardId: string;
    grapeIndex: number;
    file: File;
    title?: string;
    comment?: string;
    instrument?: string;
  }): { ok: boolean; error?: string };
  retryUpload(id: string): void;
  dismissUpload(id: string): void;
}

const UploadManagerContext = createContext<UploadManagerValue | null>(null);

export function useUploadManager(): UploadManagerValue {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) throw new Error("UploadManagerProvider가 필요합니다");
  return ctx;
}

async function hashFile(file: File): Promise<string | undefined> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

/** signed URL로 XHR 업로드 — 진행률 콜백 지원 (supabase-js는 진행률 미지원) */
function putWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (ratio: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("content-type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`업로드 실패 (${xhr.status})`));
    xhr.onerror = () => reject(new Error("네트워크 오류"));
    xhr.send(file);
  });
}

export function UploadManagerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const uploadsRef = useRef(uploads);
  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  const patch = useCallback((id: string, changes: Partial<UploadTask>) => {
    setUploads((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  }, []);

  const run = useCallback(
    async (task: UploadTask) => {
      try {
        patch(task.id, { status: "preparing", progress: 0, error: undefined });
        const fileHash = await hashFile(task.file);

        const req = await requestUpload({
          cardId: task.cardId,
          grapeIndex: task.grapeIndex,
          fileName: task.file.name || "video.mp4",
          fileSize: task.file.size,
          fileHash,
        });
        if (!req.ok) throw new Error(req.error);

        patch(task.id, { status: "uploading" });
        await putWithProgress(req.data.signedUrl, task.file, (ratio) =>
          patch(task.id, { progress: ratio })
        );

        patch(task.id, { status: "confirming", progress: 1 });
        const confirm = await confirmUpload({
          cardId: task.cardId,
          grapeIndex: task.grapeIndex,
          path: req.data.path,
          fileSize: task.file.size,
          fileHash,
          title: task.title,
          comment: task.comment,
          instrument: task.instrument,
        });
        if (!confirm.ok) throw new Error(confirm.error);

        patch(task.id, { status: "done" });
        router.refresh(); // 포도알이 "검토 대기"로 바뀐 것을 반영
        setTimeout(() => {
          setUploads((prev) => prev.filter((t) => t.id !== task.id));
        }, 4000);
      } catch (e) {
        patch(task.id, {
          status: "error",
          error: e instanceof Error ? e.message : "업로드에 실패했어요",
        });
      }
    },
    [patch, router]
  );

  const startUpload: UploadManagerValue["startUpload"] = useCallback(
    (input) => {
      const active = uploadsRef.current.find(
        (t) =>
          t.cardId === input.cardId &&
          t.grapeIndex === input.grapeIndex &&
          t.status !== "done" &&
          t.status !== "error"
      );
      if (active) return { ok: false, error: "이 포도알 영상은 이미 올라가는 중이에요!" };

      const task: UploadTask = {
        id: `up-${Date.now()}-${input.grapeIndex}`,
        ...input,
        progress: 0,
        status: "preparing",
      };
      setUploads((prev) => [...prev, task]);
      void run(task);
      return { ok: true };
    },
    [run]
  );

  const retryUpload = useCallback(
    (id: string) => {
      const task = uploadsRef.current.find((t) => t.id === id);
      if (task) void run(task);
    },
    [run]
  );

  const dismissUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 업로드 중 탭을 닫으면 유실되므로 경고
  useEffect(() => {
    const hasActive = uploads.some((t) => t.status !== "done" && t.status !== "error");
    if (!hasActive) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploads]);

  return (
    <UploadManagerContext.Provider value={{ uploads, startUpload, retryUpload, dismissUpload }}>
      {children}
      <UploadStatusBar />
    </UploadManagerContext.Provider>
  );
}

/** 화면 하단 고정 진행률 칩 */
function UploadStatusBar() {
  const { uploads, retryUpload, dismissUpload } = useUploadManager();
  if (uploads.length === 0) return null;

  return (
    <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] inset-x-3 z-[45] max-w-lg mx-auto flex flex-col gap-2 pointer-events-none">
      {uploads.map((task) => (
        <div
          key={task.id}
          className={`pointer-events-auto rounded-2xl shadow-lg border px-4 py-3 text-sm font-bold ${
            task.status === "error"
              ? "bg-red-50 border-red-200 text-red-600"
              : task.status === "done"
                ? "bg-lime-50 border-lime-300 text-lime-700"
                : "bg-white border-violet-200 text-violet-800"
          }`}
        >
          {task.status === "error" ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                포도알 #{task.grapeIndex} — {task.error}
              </span>
              <span className="flex gap-2 shrink-0">
                <button type="button" onClick={() => retryUpload(task.id)} className="underline">
                  재시도
                </button>
                <button type="button" onClick={() => dismissUpload(task.id)} aria-label="닫기">
                  ✕
                </button>
              </span>
            </div>
          ) : task.status === "done" ? (
            <span>
              🍇 포도알 #{task.grapeIndex} 제출 완료!{task.instrument ? ` (${task.instrument})` : ""} 곧 검토받을 거예요
            </span>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <span>
                  📤 포도알 #{task.grapeIndex} 올라가는 중
                  {task.status === "uploading" && ` ${Math.round(task.progress * 100)}%`}
                </span>
                <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-violet-100 overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${Math.round(task.progress * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
