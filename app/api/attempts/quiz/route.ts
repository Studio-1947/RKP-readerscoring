import { quizId, quizQuestions, quizTitle } from "@/lib/quiz-data";
import { allowRateLimit } from "@/lib/server/security";
import { requireUser } from "@/lib/server/supabase";

type Details = { name?: unknown; age?: unknown; phone?: unknown; email?: unknown; place?: unknown; leaderboardOptIn?: unknown };
function validDetails(value: Details) {
  const full_name = typeof value.name === "string" ? value.name.trim() : "";
  const age = Number(value.age); const phone = typeof value.phone === "string" ? value.phone.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim() : ""; const place = typeof value.place === "string" ? value.place.trim() : "";
  if (!full_name || full_name.length > 120 || !Number.isInteger(age) || age < 5 || age > 120 || phone.replace(/\D/g, "").length < 10 || phone.length > 24 || !place || place.length > 120 || email.length > 254) return null;
  return { full_name, age, phone, email: email || null, place, leaderboard_opt_in: value.leaderboardOptIn === true };
}

export async function POST(request: Request) {
  if (!allowRateLimit(request, "quiz-save", 30, 60 * 60 * 1_000)) return Response.json({ error: "Too many save requests." }, { status: 429 });
  const auth = await requireUser(request).catch(() => null);
  if (!auth) return Response.json({ error: "A reader session is required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { answers?: unknown; details?: Details } | null;
  const details = body?.details && validDetails(body.details);
  if (!details || !body?.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) return Response.json({ error: "Invalid quiz submission." }, { status: 400 });
  const answers = body.answers as Record<string, unknown>;
  const questions = quizQuestions.filter((question) => Object.hasOwn(answers, question.id));
  if (questions.length !== 8 || questions.some((question) => !Number.isInteger(answers[question.id]) || (answers[question.id] as number) < 0 || (answers[question.id] as number) > 3)) return Response.json({ error: "Invalid quiz submission." }, { status: 400 });
  const correctCount = questions.filter((question) => question.correctIndex === answers[question.id]).length;
  const totalScore = Math.round((correctCount / questions.length) * 100);
  const { error: profileError } = await auth.admin.from("reader_profiles").upsert({ id: auth.user.id, ...details, consented_at: new Date().toISOString() });
  if (profileError) return Response.json({ error: "Unable to save reader details." }, { status: 500 });
  const { error } = await auth.admin.from("quiz_attempts").insert({ reader_id: auth.user.id, quiz_id: quizId, quiz_title: quizTitle.hi, correct_count: correctCount, total_questions: questions.length, total_score: totalScore });
  if (error) return Response.json({ error: "Unable to save quiz score." }, { status: 500 });
  return Response.json({ correctCount, totalQuestions: questions.length, totalScore });
}
