import { getTerms } from "@/lib/terms-server";
import { NewStudentForm } from "@/components/NewStudentForm";

export default async function NewStudentPage() {
  const terms = await getTerms();
  return <NewStudentForm terms={terms} />;
}
