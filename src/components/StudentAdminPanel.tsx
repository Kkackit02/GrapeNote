"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetStudentPin, renameStudent, deleteStudent } from "@/lib/actions/students";

interface Props {
  studentId: string;
  displayName: string;
  /** 멤버 호칭 (학생/멤버) */
  memberLabel?: string;
}

/** 멤버 관리: PIN 재설정 / 이름 수정 / 계정 삭제 */
export function StudentAdminPanel({ studentId, displayName, memberLabel = "학생" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [name, setName] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const doResetPin = async () => {
    if (!/^\d{6}$/.test(pin)) {
      setMessage({ ok: false, text: "PIN은 숫자 6자리여야 해요." });
      return;
    }
    if (!window.confirm(`${displayName} 님의 PIN을 ${pin}(으)로 바꿀까요?`)) return;
    setBusy(true);
    const result = await resetStudentPin(studentId, pin);
    setBusy(false);
    setMessage(
      result.ok
        ? { ok: true, text: `PIN이 변경됐어요. 새 PIN(${pin})을 알려주세요!` }
        : { ok: false, text: result.error }
    );
    if (result.ok) setPin("");
  };

  const doRename = async () => {
    setBusy(true);
    const result = await renameStudent(studentId, name);
    setBusy(false);
    setMessage(
      result.ok ? { ok: true, text: "이름이 수정됐어요." } : { ok: false, text: result.error }
    );
    if (result.ok) router.refresh();
  };

  const doDelete = async () => {
    const typed = window.prompt(
      `정말 삭제하려면 이름(${displayName})을 똑같이 입력해 주세요.\n카드, 영상, 계정이 전부 삭제되고 되돌릴 수 없어요!`
    );
    if (typed !== displayName) {
      if (typed !== null) setMessage({ ok: false, text: "이름이 일치하지 않아 취소했어요." });
      return;
    }
    setBusy(true);
    const result = await deleteStudent(studentId);
    setBusy(false);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    router.push("/teacher");
    router.refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-gray-400 underline underline-offset-4 self-start"
      >
        {`⚙️ ${memberLabel} 관리 (PIN 재설정 · 이름 · 삭제)`}
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-700">⚙️ {memberLabel} 관리</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400">
          접기
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-gray-600">PIN 재설정 (비밀번호를 까먹었을 때)</p>
        <div className="flex gap-2">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="새 PIN 6자리"
            className="flex-1 h-11 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <button
            type="button"
            disabled={busy}
            onClick={doResetPin}
            className="px-4 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50"
          >
            변경
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-gray-600">이름 수정</p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 h-11 px-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <button
            type="button"
            disabled={busy}
            onClick={doRename}
            className="px-4 rounded-xl bg-violet-100 text-violet-700 text-sm font-bold disabled:opacity-50"
          >
            수정
          </button>
        </div>
      </div>

      {message && (
        <p className={`text-sm font-medium ${message.ok ? "text-lime-700" : "text-red-500"}`}>
          {message.text}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={doDelete}
        className="text-sm text-red-400 underline underline-offset-4 self-start disabled:opacity-50"
      >
        {`🗑 ${memberLabel} 삭제 (모든 기록이 지워져요)`}
      </button>
    </div>
  );
}
