import { requireAdmin } from "@/lib/server/admin";

const clean = (value: unknown, limit = 5000) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const status = (value: unknown) => value === "published" ? "published" : "draft";

function passageRecord(value: Record<string, unknown>, defaultStatus: unknown, index: number) {
  const title = clean(value.title, 160);
  const suppliedLines = Array.isArray(value.lines) ? value.lines.map((line) => clean(line, 2000)).filter(Boolean) : [];
  const reference = clean(value.referenceText ?? value.reference_text, 12000) || suppliedLines.join("\n");
  const lines = suppliedLines.length ? suppliedLines : reference.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!title || !reference || !lines.length) return null;
  const suppliedId = clean(value.id, 100).replace(/[^a-zA-Z0-9_-]/g, "");
  return { id: suppliedId || `${slug(title) || "passage"}-${Date.now().toString(36)}-${index + 1}`, title, reference_text: reference, lines, sequence: Number(value.sequence) || index + 1, difficulty_editorial: clean(value.difficulty ?? value.difficulty_editorial, 50) || "Standard", word_count_whitespace: Number(value.wordCount ?? value.word_count_whitespace) || reference.split(/\s+/).filter(Boolean).length, status: status(value.status ?? defaultStatus) };
}

function quizRecord(value: Record<string, unknown>, defaultStatus: unknown) {
  const titleEn = clean(value.titleEn ?? value.title_en, 160); const titleHi = clean(value.titleHi ?? value.title_hi, 160) || titleEn;
  const questions = Array.isArray(value.questions) ? value.questions : [];
  if (!titleEn || !questions.length || questions.length > 100) return null;
  const quizId = `${slug(titleEn)}-${Date.now().toString(36)}`;
  const parsed = questions.map((question, position) => {
    const item = question as Record<string, unknown>; const options = Array.isArray(item.options) ? item.options.map((option) => String(option).trim()).filter(Boolean) : [];
    return { id: `${quizId}-${position + 1}`, quiz_id: quizId, question_en: clean(item.questionEn ?? item.question_en, 1000), question_hi: clean(item.questionHi ?? item.question_hi, 1000) || clean(item.questionEn ?? item.question_en, 1000), options, correct_index: Number(item.correctIndex ?? item.correct_index), position };
  });
  if (parsed.some((item) => !item.question_en || item.options.length < 2 || !Number.isInteger(item.correct_index) || item.correct_index < 0 || item.correct_index >= item.options.length)) return null;
  return { quiz: { id: quizId, title_en: titleEn, title_hi: titleHi, status: status(value.status ?? defaultStatus) }, questions: parsed };
}

async function insertQuiz(auth: Awaited<ReturnType<typeof requireAdmin>>, value: Record<string, unknown>, defaultStatus: unknown) {
  if (!auth) return { error: "Admin access is required." };
  const parsed = quizRecord(value, defaultStatus);
  if (!parsed) return { error: "Every quiz needs a title and valid questions with two or more options." };
  const { error: quizError } = await auth.admin.from("admin_quizzes").insert(parsed.quiz);
  if (quizError) return { error: quizError.message };
  const { error: questionError } = await auth.admin.from("admin_quiz_questions").insert(parsed.questions);
  if (questionError) { await auth.admin.from("admin_quizzes").delete().eq("id", parsed.quiz.id); return { error: questionError.message }; }
  return { id: parsed.quiz.id };
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth) return Response.json({ error: "Admin access is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !["passage", "quiz", "bulk-passages", "bulk-quiz"].includes(String(body.kind))) return Response.json({ error: "Invalid content request." }, { status: 400 });
  if (body.kind === "passage") {
    const row = passageRecord(body, body.status, 0);
    if (!row) return Response.json({ error: "A title and passage text are required." }, { status: 400 });
    const { error } = await auth.admin.from("reader_passages").upsert(row);
    return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ ok: true, id: row.id });
  }
  if (body.kind === "quiz") {
    const result = await insertQuiz(auth, body, body.status);
    return result.error ? Response.json(result, { status: 400 }) : Response.json({ ok: true, id: result.id });
  }
  if (body.kind === "bulk-passages") {
    const source = Array.isArray(body.items) ? body.items : (body.data as { samples?: unknown })?.samples;
    if (!Array.isArray(source) || !source.length || source.length > 500) return Response.json({ error: "Upload a JSON array (or { samples: [...] }) with 1–500 passages." }, { status: 400 });
    const candidates = source.map((item, index) => item && typeof item === "object" ? passageRecord(item as Record<string, unknown>, body.status, index) : null);
    if (candidates.some((row) => !row)) return Response.json({ error: "One or more passages is missing a title or text." }, { status: 400 });
    const rows = candidates.filter((row): row is NonNullable<typeof row> => row !== null);
    const { error } = await auth.admin.from("reader_passages").upsert(rows);
    return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ ok: true, imported: rows.length });
  }
  const source = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : body;
  const result = await insertQuiz(auth, source, body.status);
  return result.error ? Response.json(result, { status: 400 }) : Response.json({ ok: true, imported: 1, id: result.id });
}
