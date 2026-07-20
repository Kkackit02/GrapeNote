import Link from "next/link";

const FEATURES = [
  {
    emoji: "🍇",
    title: "연습 1회 = 포도알 1개",
    desc: "영상을 올리면 검토 후 포도알이 채워져요. 종이 진도카드 그대로, 온라인으로.",
  },
  {
    emoji: "👀",
    title: "검토가 빨라요",
    desc: "밀린 영상을 최대 6개 동시 재생으로 훑고 그 자리에서 합격/재연습 판정.",
  },
  {
    emoji: "🎸",
    title: "밴드·합주에 딱",
    desc: "곡별 편성, 악기 파트별 세션장 검토, 곡마다 미션과 MR 공유까지.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <div className="text-6xl mb-3">🍇</div>
        <h1 className="text-3xl font-extrabold text-violet-900">GrapeNote</h1>
        <p className="mt-2 text-gray-600">
          연습 영상을 올리고 포도알을 채우는
          <br />
          온라인 악기 연습 진도 카드!
        </p>
        <p className="mt-1 text-sm text-violet-600 font-bold">
          피아노 학원부터 밴드 동아리까지 🎹🎸
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <Link
          href="/student/login"
          className="h-16 rounded-2xl bg-violet-600 text-white text-xl font-bold flex items-center justify-center gap-2 active:bg-violet-800"
        >
          🎵 멤버로 시작하기
        </Link>
        <Link
          href="/login"
          className="h-16 rounded-2xl bg-white border-2 border-violet-200 text-violet-800 text-xl font-bold flex items-center justify-center gap-2 active:bg-violet-100"
        >
          🧑‍🏫 그룹 만들기 · 리더 로그인
        </Link>
        <Link
          href="/student/join"
          className="text-center text-sm text-violet-600 underline underline-offset-4 mt-2"
        >
          초대코드를 받았나요? 여기서 가입하세요
        </Link>
      </div>

      <div className="w-full max-w-sm grid gap-2">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl bg-white/70 border border-violet-100 px-4 py-3 flex items-start gap-3"
          >
            <span className="text-2xl">{f.emoji}</span>
            <div>
              <p className="font-bold text-gray-800 text-sm">{f.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <footer className="text-center text-xs text-gray-400">
        건국대 밴드 동아리 <b>너드더락</b>이 쓰고 있어요 · 만든 사람:{" "}
        <a
          href="https://github.com/Kkackit02"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-violet-600"
        >
          github.com/Kkackit02
        </a>
      </footer>
    </main>
  );
}
