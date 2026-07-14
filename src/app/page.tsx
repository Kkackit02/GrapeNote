import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <div className="text-6xl mb-3">🍇</div>
        <h1 className="text-3xl font-extrabold text-violet-900">GrapeNote</h1>
        <p className="mt-2 text-gray-600">
          연습 영상을 올리고 포도알을 채우는
          <br />
          온라인 피아노 진도카드
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <Link
          href="/student/login"
          className="h-16 rounded-2xl bg-violet-600 text-white text-xl font-bold flex items-center justify-center gap-2 active:bg-violet-800"
        >
          🎹 학생으로 시작하기
        </Link>
        <Link
          href="/login"
          className="h-16 rounded-2xl bg-white border-2 border-violet-200 text-violet-800 text-xl font-bold flex items-center justify-center gap-2 active:bg-violet-100"
        >
          🧑‍🏫 선생님으로 시작하기
        </Link>
        <Link
          href="/student/join"
          className="text-center text-sm text-violet-600 underline underline-offset-4 mt-2"
        >
          초대코드를 받았나요? 여기서 가입하세요
        </Link>
      </div>
    </main>
  );
}
