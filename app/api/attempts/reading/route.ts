import library from "@/Hindi_Literary_100_Samples.json";
import { scoreReading } from "@/lib/scoring";
import { allowRateLimit, verifyTranscriptionProof } from "@/lib/server/security";
import { requireUser } from "@/lib/server/supabase";

type Details = { name?: unknown; age?: unknown; phone?: unknown; email?: unknown; place?: unknown; leaderboardOptIn?: unknown };

function validDetails(value: Details) {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const age = Number(value.age);
  const phone = typeof value.phone === "string" ? value.phone.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim() : "";
  const place = typeof value.place === "string" ? value.place.trim() : "";
  if (!name || name.length > 120 || !Number.isInteger(age) || age < 5 || age > 120 || phone.replace(/\D/g, "").length < 10 || phone.length > 24 || !place || place.length > 120 || email.length > 254) return null;
  return { full_name: name, age, phone, email: email || null, place, leaderboard_opt_in: value.leaderboardOptIn === true };
}

export async function POST(request: Request) {
  if (!allowRateLimit(request, "reading-save", 20, 60 * 60 * 1_000)) return Response.json({ error: "Too many save requests." }, { status: 429 });
  const auth = await requireUser(request).catch(() => null);
  if (!auth) return Response.json({ error: "A reader session is required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { details?: Details; passageId?: unknown; durationSeconds?: unknown; proof?: unknown } | null;
  const details = body?.details && validDetails(body.details);
  const passage = typeof body?.passageId === "string" ? library.samples.find((item) => item.id === body.passageId) : undefined;
  const transcript = verifyTranscriptionProof(body?.proof);
  const durationSeconds = Number(body?.durationSeconds);
  if (!details || !passage || !transcript || !Number.isInteger(durationSeconds) || durationSeconds < 2 || durationSeconds > 1800) return Response.json({ error: "Invalid verified reading submission." }, { status: 400 });
  const score = scoreReading(passage.reference_text, transcript, durationSeconds, 1);
  const { error: profileError } = await auth.admin.from("reader_profiles").upsert({ id: auth.user.id, ...details, consented_at: new Date().toISOString() });
  if (profileError) return Response.json({ error: "Unable to save reader details." }, { status: 500 });
  const { error: attemptError } = await auth.admin.from("reading_attempts").insert({ reader_id: auth.user.id, passage_id: passage.id, passage_title: passage.title, passage_sequence: passage.sequence, transcript, duration_seconds: durationSeconds, accuracy: score.accuracy, fluency: score.fluency, completion: score.completion, words_per_minute: score.wordsPerMinute, total_score: score.total, scoring_source: "server" });
  if (attemptError) return Response.json({ error: "Unable to save the reading score." }, { status: 500 });
  return Response.json({ score });
}
