"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GrapeBunch } from "./GrapeBunch";
import { VideoUploader } from "./VideoUploader";
import { GrapeVideoSection } from "./GrapeVideoSection";
import { Celebration } from "./Celebration";
import { SongTracks } from "./SongTracks";
import { ShareCompletionButton } from "./ShareCompletionButton";
import { ShareCardButton } from "./ShareCardButton";
import { ShowcaseButton } from "./ShowcaseButton";
import { deleteSubmission } from "@/lib/actions/uploads";
import { growMyCard } from "@/lib/actions/cards";
import { approvedCount, type GrapeState } from "@/lib/grapes";
import { groupLimits } from "@/lib/limits";
import type { ProgressCard, SongTrack } from "@/lib/types";

interface Props {
  card: ProgressCard;
  grapes: GrapeState[];
  /** 이 곡의 연습 음원(MR) — 미션 아래에 표시 */
  tracks?: SongTrack[];
  myId?: string;
  /** 검토자 호칭 (선생님/운영진/리더) */
  leaderLabel?: string;
  /** 그룹 프리미엄 — 업로드 상한 확대 + 720p 녹화 */
  premium?: boolean;
  /** 마감된 숙제 — 지난 기록은 볼 수 있고 새 제출/삭제만 막는다 */
  readOnly?: boolean;
  /** 이 멤버가 고른 포도알 스킨 id */
  skinId?: string;
  /** 자랑 카드용 — 멤버 이름 */
  memberName?: string;
  /** 자랑 카드용 — 그룹 이름 */
  groupName?: string;
  /** 지금 자랑 벽에 걸어 둔 내 영상(제출) id */
  showcaseSubmissionId?: string | null;
}

/** 학생 핵심 화면: 포도송이 + 포도알 탭 → 상태별 바텀 시트 */
export function StudentCardView({
  card,
  grapes,
  tracks,
  myId,
  leaderLabel = "선생님",
  premium = false,
  readOnly = false,
  skinId,
  memberName = "멤버",
  groupName = "우리 그룹",
  showcaseSubmissionId = null,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<GrapeState | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);

  // 내 카드면 포도알을 더 달 수 있다 (늘리기만, 최대 60). 마감 카드는 불가.
  const canGrow = !readOnly && card.total_grapes < 60;
  const addGrape = async () => {
    if (adding) return;
    setAdding(true);
    const result = await growMyCard({ cardId: card.id, addGrapes: 1 });
    setAdding(false);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  };

  const done = approvedCount(grapes);
  const completed = !!card.completed_at;
  // 녹화기에서 반주로 틀 수 있는 이 곡의 MR 목록
  const recorderTracks = (tracks ?? []).map((track) => ({
    id: track.id,
    label: track.label,
    uploaderName: track.uploader_name,
  }));

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

      {readOnly && (
        <div className="rounded-2xl bg-gray-100 border border-gray-200 p-3 text-center">
          <p className="font-bold text-gray-700">🔒 마감된 숙제예요</p>
          <p className="mt-0.5 text-xs text-gray-500">
            새 영상은 올릴 수 없지만 지난 기록은 언제든 볼 수 있어요.
          </p>
        </div>
      )}

      {completed && (
        <div className="flex flex-col gap-2">
          <ShareCompletionButton cardId={card.id} shared={!!card.shared_at} />
          <ShareCardButton
            totalGrapes={card.total_grapes}
            skinId={skinId}
            title={card.title}
            memberName={memberName}
            groupName={groupName}
            completedAt={card.completed_at}
          />
        </div>
      )}

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
          skinId={skinId}
          onAddGrape={canGrow ? addGrape : undefined}
          addBusy={adding}
          className="max-w-sm mx-auto"
        />
        <p className="mt-2 text-center text-sm text-gray-400">
          포도알을 눌러 연습 영상을 올려 보세요!
          {canGrow && (
            <>
              <br />
              <span className="text-green-600 font-medium">점선 + 알을 누르면 포도알을 더 달 수 있어요 🍇</span>
            </>
          )}
        </p>
      </div>

      {completed && <Celebration />}

      {/* 바텀 시트 */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closeSheet} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`포도알 ${selected.index}`}
            className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl p-5 pb-8 max-w-lg mx-auto shadow-2xl max-h-[85vh] overflow-y-auto"
          >
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
                  다 올라가면 바로 검토가 시작돼요.
                </p>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="mt-4 w-full h-13 py-3 rounded-xl bg-violet-600 text-white font-bold active:bg-violet-800"
                >
                  확인
                </button>
              </div>
            ) : readOnly ? (
              <div className="flex flex-col gap-3">
                <p className="text-center text-sm font-bold text-gray-600">
                  🔒 마감된 숙제라 새 영상은 올릴 수 없어요
                </p>
                {selected.history.length > 0 && (
                  <GrapeVideoSection
                    history={selected.history}
                    grapeIndex={selected.index}
                    retentionDays={groupLimits(premium).retentionDays}
                  />
                )}
              </div>
            ) : selected.status === "empty" ? (
              <VideoUploader
                cardId={card.id}
                grapeIndex={selected.index}
                onDone={onUploadDone}
                premium={premium}
                leaderLabel={leaderLabel}
                tracks={recorderTracks}
              />
            ) : selected.status === "retry" ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
                  <p className="text-sm font-bold text-orange-700">{leaderLabel} 말씀 ✍️</p>
                  <p className="mt-1 text-gray-700">
                    {selected.history[0]?.teacher_comment ?? "한 번 더 연습해 볼까요?"}
                  </p>
                </div>
                <p className="text-center text-sm font-bold text-gray-600">
                  다시 도전해 봐요! 할 수 있어요 💪
                </p>
                <VideoUploader
                  cardId={card.id}
                  grapeIndex={selected.index}
                  onDone={onUploadDone}
                  premium={premium}
                  leaderLabel={leaderLabel}
                  tracks={recorderTracks}
                />
                <GrapeVideoSection
                  history={selected.history}
                  grapeIndex={selected.index}
                  retentionDays={groupLimits(premium).retentionDays}
                />
              </div>
            ) : selected.status === "pending" ? (
              <div className="flex flex-col gap-3">
                <div className="text-center">
                  <div className="text-4xl">👀</div>
                  <p className="mt-1 font-bold text-lime-700">지금 검토 받는 중이에요!</p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    확인이 끝나면 포도알이 채워져요.
                  </p>
                </div>
                <GrapeVideoSection
                  history={selected.history}
                  grapeIndex={selected.index}
                  retentionDays={groupLimits(premium).retentionDays}
                />
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
              (() => {
                const approvedSub = selected.history.find((s) => s.status === "approved");
                const canShowcase = approvedSub && !approvedSub.video_deleted_at;
                return (
                  <div className="flex flex-col gap-3">
                    <p className="text-center font-bold text-violet-700">🍇 합격한 포도알이에요!</p>
                    {approvedSub?.teacher_comment && (
                      <div className="rounded-xl bg-violet-50 border border-violet-200 p-3">
                        <p className="text-sm font-bold text-violet-700">{leaderLabel} 말씀 ✍️</p>
                        <p className="mt-1 text-gray-700">{approvedSub.teacher_comment}</p>
                      </div>
                    )}
                    <GrapeVideoSection
                      history={selected.history}
                      grapeIndex={selected.index}
                      retentionDays={groupLimits(premium).retentionDays}
                    />
                    {canShowcase && (
                      <ShowcaseButton
                        submissionId={approvedSub.id}
                        isCurrent={showcaseSubmissionId === approvedSub.id}
                      />
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </>
      )}
    </div>
  );
}
