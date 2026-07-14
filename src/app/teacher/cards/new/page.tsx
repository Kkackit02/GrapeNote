import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { BulkCardForm } from "@/components/BulkCardForm";
import type { Profile } from "@/lib/types";

export default async function NewCardPage() {
  const supabase = await createSupabaseServer();
  const { data: students } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .order("display_name");
  const studentList = (students ?? []) as Profile[];

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-4">
      <div>
        <Link href="/teacher" className="text-sm text-gray-400">← 대시보드</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-violet-900">진도카드 배정</h1>
        <p className="mt-1 text-sm text-gray-500">
          여러 학생을 선택하면 같은 카드를 한 번에 배정할 수 있어요.
        </p>
      </div>

      {studentList.length === 0 ? (
        <div className="rounded-2xl bg-white border border-violet-100 p-8 text-center text-gray-500">
          아직 가입한 학생이 없어요.
          <br />
          먼저{" "}
          <Link href="/teacher/students/new" className="font-bold text-violet-700 underline">
            학생을 초대
          </Link>
          해 주세요!
        </div>
      ) : (
        <BulkCardForm students={studentList} />
      )}
    </div>
  );
}
