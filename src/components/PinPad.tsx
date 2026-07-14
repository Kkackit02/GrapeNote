"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

/** 초등학생용 큰 숫자 키패드 + PIN 점 표시 */
export function PinPad({ value, onChange, maxLength = 6 }: Props) {
  const press = (digit: string) => {
    if (value.length < maxLength) onChange(value + digit);
  };

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="flex justify-center gap-3 my-4" aria-label="비밀번호 입력 상태">
        {Array.from({ length: maxLength }).map((_, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full border-2 border-violet-400 ${
              i < value.length ? "bg-violet-500" : "bg-white"
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            className="h-14 rounded-2xl bg-violet-50 text-2xl font-bold text-violet-900 active:bg-violet-200"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange("")}
          className="h-14 rounded-2xl bg-orange-50 text-sm font-bold text-orange-600 active:bg-orange-200"
        >
          지우기
        </button>
        <button
          type="button"
          onClick={() => press("0")}
          className="h-14 rounded-2xl bg-violet-50 text-2xl font-bold text-violet-900 active:bg-violet-200"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          className="h-14 rounded-2xl bg-violet-50 text-2xl text-violet-900 active:bg-violet-200"
          aria-label="한 글자 지우기"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
