import Link from "next/link";
import { getTerms } from "@/lib/terms-server";
import { groupLimits } from "@/lib/limits";

/** 도움말: 리더가 GrapeNote를 어떤 순서로 쓰는지 한 페이지에 정리 */
export default async function HelpPage() {
  const terms = await getTerms();
  const free = groupLimits(false);

  const steps = [
    {
      emoji: "1️⃣",
      title: `${terms.member} 초대하기`,
      href: "/teacher",
      linkText: "대시보드에서 초대코드 복사 →",
      body: `대시보드의 공용 초대코드(CLASS-...)를 단톡방에 공유하면, 각자 아이디와 PIN 6자리를 만들어 가입해요. 한 명씩 따로 코드를 주고 싶으면 "+ ${terms.member} 등록"을 쓰세요.`,
    },
    {
      emoji: "2️⃣",
      title: "곡 만들고 편성하기",
      href: "/teacher/songs/new",
      linkText: "새 곡 만들기 →",
      body:
        "곡 이름, 🎯 미션(어떻게 연습할지), 편성 멤버, 포도알 수(연습 횟수), 기한을 한 번에 정해요. 곡을 만들면 편성된 멤버에게 진도카드가 배정되고, 나중에 합류한 멤버도 자동으로 같은 곡을 받아요.",
    },
    {
      emoji: "3️⃣",
      title: "세션장(파트장) 지정하기",
      href: "/teacher/teams",
      linkText: "팀 관리 →",
      body:
        "멤버 상세에서 악기를 지정한 뒤 팀 관리의 \"🎸 악기 파트 팀 만들기\"를 누르면 파트별 팀이 자동으로 생겨요. 멤버 이름 옆 ☆을 누르면 그 사람이 세션장이 되어 같은 파트 멤버의 영상을 대신 검토할 수 있어요. (본인 영상은 본인이 검토할 수 없어요)",
    },
  ];

  const screens = [
    { emoji: "📊", name: "현황판", href: "/teacher/board", desc: "곡 × 멤버 진행 상태. 곡명을 누르면 편성 수정, 빈칸(＋)을 누르면 그 자리에서 배정." },
    { emoji: "🎵", name: "곡 관리", href: "/teacher/songs", desc: "곡별 편성·미션·기한을 한꺼번에 수정. 곡 단위 🔒 마감과 MR 관리도 여기서." },
    { emoji: "📋", name: "숙제 관리", href: "/teacher/cards", desc: "카드 하나하나를 표로 보고 체크해서 일괄 수정·마감·삭제." },
    { emoji: "👀", name: "검토함", href: "/teacher/review", desc: "밀린 영상을 1·2·4·6분할로 동시 재생하며 판정. 소리는 한 번에 한 개만 켜져요." },
    { emoji: "🎬", name: "영상 관리", href: "/teacher/videos", desc: "전체 제출 영상 표. 체크해서 일괄 다운로드·드라이브 백업·파일 정리." },
    { emoji: "📈", name: "주간 통계", href: "/teacher/stats", desc: `이번 주 ${terms.member}별 제출·합격 수와 오래 조용한 사람(💤).` },
    { emoji: "⚙️", name: "그룹 설정", href: "/teacher/settings", desc: "저장 공간, 알림, 멤버끼리 현황 공개, 구글 드라이브 백업." },
  ];

  const faqs = [
    {
      q: "영상이 며칠 뒤에 사라져요",
      a: `저장 공간을 아끼려고 판정된 영상 파일은 ${free.retentionDays}일 뒤 자동으로 정리돼요. 판정 기록과 코멘트는 영원히 남아요. 영상을 계속 보관하고 싶으면 ⚙️ 설정에서 구글 드라이브를 연결하세요 — 지워지기 직전에 자동 백업돼요.`,
    },
    {
      q: "🔒 마감하면 어떻게 되나요?",
      a: `그 숙제가 ${terms.member} 화면에서 사라지고 더 이상 영상을 올릴 수 없어요. 지난 제출 영상은 드라이브로 자동 백업되고, 기록은 남아요. 언제든 🔓 마감 해제할 수 있어요.`,
    },
    {
      q: "멤버가 앨범에서 영상을 못 올려요",
      a: "맞아요. 저장 공간을 지키려고 앱 안에서 바로 촬영한 영상만 올릴 수 있어요 (촬영 단계에서 화질을 낮춰 파일을 작게 만들어요). 최대 5분까지 찍을 수 있어요.",
    },
    {
      q: "MR(반주)을 틀면서 녹음할 수 있나요?",
      a: "곡 카드의 🎧 연습 음원에 MR을 올려두면, 멤버가 촬영할 때 반주를 고르고 볼륨을 맞춰 함께 녹음할 수 있어요. 이어폰을 끼는 걸 권해요.",
    },
    {
      q: "완성 소식이 자동으로 퍼지나요?",
      a: `아니요. 포도송이를 완성해도 본인에게만 알림이 가고, 본인이 "📣 자랑하기"를 눌러야 그룹 소식과 알림으로 공유돼요.`,
    },
    {
      q: "알림이 안 와요",
      a: "⚙️ 설정에서 🔔 알림 받기를 켜야 해요. 기기마다 따로 켜야 하고, 아이폰은 사파리에서 홈 화면에 추가한 뒤(앱처럼) 켜야 알림이 동작해요.",
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">❓ 도움말</h1>
        <p className="mt-1 text-sm text-gray-500">
          GrapeNote는 {terms.member}가 연습 영상을 올리고, 검토해서 합격하면 포도알이 채워지는 진도카드예요.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-extrabold text-violet-900">🚀 처음이라면 이 순서로</h2>
        <ol className="mt-2 flex flex-col gap-2">
          {steps.map((step) => (
            <li key={step.title} className="rounded-2xl bg-white border border-violet-100 p-4">
              <p className="font-extrabold text-gray-800">
                {step.emoji} {step.title}
              </p>
              <p className="mt-1 text-sm text-gray-600">{step.body}</p>
              <Link
                href={step.href}
                className="mt-2 inline-block text-sm font-bold text-violet-600"
              >
                {step.linkText}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-extrabold text-violet-900">🗺 화면 안내</h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {screens.map((screen) => (
            <li key={screen.name}>
              <Link
                href={screen.href}
                className="block rounded-xl bg-white border border-violet-100 px-4 py-3 active:bg-violet-50"
              >
                <p className="font-bold text-gray-800 text-sm">
                  {screen.emoji} {screen.name}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{screen.desc}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-extrabold text-violet-900">💬 자주 묻는 것</h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {faqs.map((faq) => (
            <li key={faq.q}>
              <details className="rounded-xl bg-white border border-violet-100 px-4 py-3">
                <summary className="font-bold text-gray-800 text-sm cursor-pointer list-none">
                  {faq.q}
                </summary>
                <p className="mt-1.5 text-sm text-gray-600">{faq.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-xs text-gray-400">
        더 궁금한 게 있으면{" "}
        <a
          href="https://github.com/Kkackit02/GrapeNote/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          GitHub 이슈
        </a>
        로 알려주세요 🍇
      </p>
    </div>
  );
}
