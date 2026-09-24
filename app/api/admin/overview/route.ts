import { requireAdmin } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth) return Response.json({ error: "Admin access is required." }, { status: 403 });
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [profiles, reading, quiz, flags, passages, quizzes] = await Promise.all([
    auth.admin.from("reader_profiles").select("id,full_name,username,email,place,created_at"),
    auth.admin.from("reading_attempts").select("reader_id,created_at,total_score,words_per_minute,duration_seconds,passage_title").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    auth.admin.from("quiz_attempts").select("reader_id,created_at,total_score,quiz_title").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    auth.admin.from("moderation_flags").select("id,reader_id,source,reason,status,created_at").order("created_at", { ascending: false }).limit(100),
    auth.admin.from("reader_passages").select("id,title,status,updated_at").order("updated_at", { ascending: false }).limit(100),
    auth.admin.from("admin_quizzes").select("id,title_en,title_hi,status,updated_at").order("updated_at", { ascending: false }).limit(100),
  ]);
  const results = [profiles, reading, quiz, flags, passages, quizzes];
  const failure = results.find((result) => result.error)?.error;
  if (failure) return Response.json({ error: `Admin data is unavailable: ${failure.message}` }, { status: 500 });
  const readers = profiles.data ?? [];
  const reads = reading.data ?? [];
  const quizAttempts = quiz.data ?? [];
  const suspicious = reads.filter((attempt) => attempt.words_per_minute > 280 || (attempt.total_score >= 98 && attempt.duration_seconds < 8)).map((attempt) => ({ ...attempt, kind: attempt.words_per_minute > 280 ? "Unusually high reading speed" : "Near-perfect score in very short time" }));
  return Response.json({
    metrics: { readers: readers.length, activeReaders: new Set([...reads, ...quizAttempts].map((item) => item.reader_id)).size, readingAttempts: reads.length, quizAttempts: quizAttempts.length, openFlags: (flags.data ?? []).filter((flag) => flag.status === "open").length },
    readers: readers.slice(0, 100), reading: reads.slice(0, 50), quizAttempts: quizAttempts.slice(0, 50), flags: flags.data ?? [], suspicious, passages: passages.data ?? [], quizzes: quizzes.data ?? [],
  });
}
