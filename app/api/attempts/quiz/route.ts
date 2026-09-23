import { quizId, quizQuestions, quizTitle } from "@/lib/quiz-data";
import { allowRateLimit } from "@/lib/server/security";
import { requireUser } from "@/lib/server/supabase";

export async function POST(request: Request) {
  if (!allowRateLimit(request, "quiz-save", 30, 60 * 60 * 1_000)) return Response.json({ error: "Too many save requests." }, { status: 429 });
  const auth = await requireUser(request).catch(() => null);
  if (!auth) return Response.json({ error: "A reader session is required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { answers?: unknown } | null;
  if (!body?.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) return Response.json({ error: "Invalid quiz submission." }, { status: 400 });
  const answers = body.answers as Record<string, unknown>;
  const questions = quizQuestions.filter((question) => Object.hasOwn(answers, question.id));
  if (questions.length !== 8 || questions.some((question) => !Number.isInteger(answers[question.id]) || (answers[question.id] as number) < 0 || (answers[question.id] as number) > 3)) return Response.json({ error: "Invalid quiz submission." }, { status: 400 });
  const correctCount = questions.filter((question) => question.correctIndex === answers[question.id]).length;
  const totalScore = Math.round((correctCount / questions.length) * 100);
  const { error } = await auth.admin.from("quiz_attempts").insert({ reader_id: auth.user.id, quiz_id: quizId, quiz_title: quizTitle.hi, correct_count: correctCount, total_questions: questions.length, total_score: totalScore });
  if (error) return Response.json({ error: "Unable to save quiz score." }, { status: 500 });
  return Response.json({ correctCount, totalQuestions: questions.length, totalScore });
}
