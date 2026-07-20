"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GrapeBunch } from "./GrapeBunch";
import { VideoUploader } from "./VideoUploader";
import { GrapeVideoSection } from "./GrapeVideoSection";
import { Celebration } from "./Celebration";
import { SongTracks } from "./SongTracks";
import { deleteSubmission } from "@/lib/actions/uploads";
import { approvedCount, type GrapeState } from "@/lib/grapes";
import type { ProgressCard, SongTrack } from "@/lib/types";

interface Props {
  card: ProgressCard;
  grapes: GrapeState[];
  /** 이 곡의 연습 음원(MR) — 미션 아래에 표시 */
  tracks?: SongTrack[];
  myId?: string;
}

/** 학생 핵심 화면: 포도송이 + 포도알 탭 → 상태별 바텀 시트 */
export function StudentCardView({ card, grapes, tracks, myId }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<GrapeState | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const done = approvedCount(grapes);
  const completed = !!card.completed_at;

  const closeSheet = () => {
    setSelected(null);
    setJustUploaded(false);
  };

  const onUploadDone = () => {
    setJustUploaded(true);
    router.refresh();
  };

  const onDelete = async (submissionId: string) => {
    if (!window.confirm("이 영상을 지울까요? 지운 뒤에 새로 찍어서 올릴 수 있어요.")) return;
    setDeleting(true);
    const result = await deleteSubmission(submissionId);
    setDeleting(false);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    closeSheet();
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4 pb-40">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-violet-900">
          {completed ? "🏆 " : "🎵 "}
          {card.title}
        </h1>
        <p className="mt-2 text-lg font-extrabold text-violet-600">
          🍇 {done} / {card.total_grapes}알
        </p>
        {completed && (
          <p className="mt-1 font-bold text-amber-600">포도송이 완성! 정말 대단해요! 🎉</p>
        )}
      </div>

      {card.description && (
        <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-4 text-left">
          <p className="text-sm font-extrabold text-sky-800">🎯 이번 곡 미션</p>
          <p className="mt-1.5 text-sm text-gray-700 whitespace-pre-line">{card.description}</p>
        </div>
      )}

      {tracks && myId && (
        <SongTracks songTitle={card.title} tracks={tracks} myId={myId} isTeacher={false} />
      )}

      <div className="rounded-3xl bg-white border-2 border-violet-100 p-5">
        <GrapeBunch
          grapes={grapes}
          onGrapeClick={(g) => { setSelected(g); setJustUploaded(false); }}
          selectedIndex={selected?.index}
          className="max-w-sm mx-auto"
        />
        <p className="mt-2 text-center text-sm text-gray-400">
          포도알을 눌러 연습 영상을 올려 보세요!
        </p>
      </div>

      {completed && <Celebration />}

      {/* 바텀 시트 */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closeSheet} />
          <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl p-5 pb-8 max-w-lg mx-auto shadow-2xl">
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-extrabold text-violet-900 text-center mb-3">
              포도알 #{selected.index}
            </h2>

            {justUploaded ? (
              <div className="text-center py-4">
                <div className="text-5xl">🙌</div>
                <p className="mt-2 font-bold text-violet-800">영상이 올라가고 있어요!</p>
                <p className="mt-1 text-sm text-gray-500">
                  화면 아래에서 진행 상황을 볼 수 있어요.
                  <br />
                  다 올라가면 선생님이 확인할 거예요.
                </p>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="mt-4 w-full h-13 py-3 rounded-xl bg-violet-600 text-white font-bold active:bg-violet-800"
                >
                  확인
                </button>
              </div>
            ) : selected.status === "empty" ? (
              <VideoUploader cardId={card.id} grapeIndex={selected.index} onDone={onUploadDone} />
            ) : selected.status === "retry" ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
                  <p className="text-sm font-bold text-orange-700">선생님 말씀 ✍️</p>
                  <p className="mt-1 text-gray-700">
                    {selected.history[0]?.teacher_comment ?? "한 번 더 연습해 볼까요?"}
                  </p>
                </div>
                <p className="text-center text-sm font-bold text-gray-600">
                  다시 도전해 봐요! 할 수 있어요 💪
                </p>
                <VideoUploader cardId={card.id} grapeIndex={selected.index} onDone={onUploadDone} />
                <GrapeVideoSection history={selected.history} grapeIndex={selected.index} />
              </div>
            ) : selected.status === "pending" ? (
              <div className="flex flex-col gap-3">
                <div className="text-center">
                  <div className="text-4xl">👀</div>
                  <p className="mt-1 font-bold text-lime-700">선생님이 보고 계세요!</p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    확인이 끝나면 포도알이 채워져요.
                  </p>
                </div>
                <GrapeVideoSection history={selected.history} grapeIndex={selected.index} />
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => onDelete(selected.history[0].id)}
                  className="h-12 rounded-xl bg-red-50 text-red-500 text-sm font-bold active:bg-red-100 disabled:opacity-50"
                >
                  {deleting ? "지우는 중..." : "🗑 이 영상 지우고 다시 찍기"}
                </button>
              </div>
            ) : (
              // approved
              <div className="flex flex-col gap-3">
                <p className="text-center font-bold text-violet-700">🍇 합격한 포도알이에요!</p>
                {selected.history.find((s) => s.status === "approved")?.teacher_comment && (
                  <div className="rounded-xl bg-violet-50 border border-violet-200 p-3">
                    <p className="text-sm font-bold text-violet-700">선생님 말씀 ✍️</p>
                    <p className="mt-1 text-gray-700">
                      {selected.history.find((s) => s.status === "approved")?.teacher_comment}
                    </p>
                  </div>
                )}
                <GrapeVideoSection history={selected.history} grapeIndex={selected.index} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
