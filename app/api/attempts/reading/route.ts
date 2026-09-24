import library from "@/Hindi_Literary_100_Samples.json";
import { scoreReading } from "@/lib/scoring";
import { allowRateLimit, verifyTranscriptionProof } from "@/lib/server/security";
import { requireUser } from "@/lib/server/supabase";

export async function POST(request: Request) {
  if (!allowRateLimit(request, "reading-save", 20, 60 * 60 * 1_000)) return Response.json({ error: "Too many save requests." }, { status: 429 });
  const auth = await requireUser(request).catch(() => null);
  if (!auth) return Response.json({ error: "A reader session is required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { passageId?: unknown; durationSeconds?: unknown; proof?: unknown } | null;
  const passageId = typeof body?.passageId === "string" ? body.passageId : "";
  let passage: { id: string; sequence: number; title: string; reference_text: string } | undefined = library.samples.find((item) => item.id === passageId);
  if (!passage && passageId) {
    const { data } = await auth.admin.from("reader_passages").select("id,sequence,title,reference_text").eq("id", passageId).eq("status", "published").maybeSingle();
    if (data) passage = data;
  }
  const transcript = verifyTranscriptionProof(body?.proof);
  const durationSeconds = Number(body?.durationSeconds);
  if (!passage || !transcript || !Number.isInteger(durationSeconds) || durationSeconds < 2 || durationSeconds > 1800) return Response.json({ error: "Invalid verified reading submission." }, { status: 400 });
  const score = scoreReading(passage.reference_text, transcript, durationSeconds, 1);
  const { error: attemptError } = await auth.admin.from("reading_attempts").insert({ reader_id: auth.user.id, passage_id: passage.id, passage_title: passage.title, passage_sequence: passage.sequence, transcript, duration_seconds: durationSeconds, accuracy: score.accuracy, fluency: score.fluency, completion: score.completion, words_per_minute: score.wordsPerMinute, total_score: score.total, scoring_source: "server" });
  if (attemptError) return Response.json({ error: "Unable to save the reading score." }, { status: 500 });
  return Response.json({ score });
}
