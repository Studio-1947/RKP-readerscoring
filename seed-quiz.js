const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^"|"$/g, "");
  }
  return values;
}

const env = { ...loadEnv(path.join(__dirname, ".env.local")), ...process.env };
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const sourcePath = path.resolve(__dirname, "hindi-literature-mcq-seed-final.json");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const restUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;

async function request(endpoint, options = {}) {
  const response = await fetch(`${restUrl}/${endpoint}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(await response.text());
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function validateSeed(seed) {
  if (!Array.isArray(seed.questions) || seed.questions.length !== seed.totalQuestions) {
    throw new Error("The seed question count does not match totalQuestions.");
  }
  const ids = new Set();
  const questions = seed.questions.map((question, position) => {
    if (!Number.isInteger(question.id) || ids.has(question.id)) throw new Error(`Invalid or duplicate question id: ${question.id}`);
    ids.add(question.id);
    if (typeof question.question !== "string" || !question.question.trim()) throw new Error(`Question ${question.id} has no text.`);
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6) throw new Error(`Question ${question.id} must have 2–6 options.`);
    const correct = question.options.filter((option) => option.isCorrect);
    if (correct.length !== 1 || correct[0].id !== question.correctAnswer || correct[0].text !== question.correctAnswerText) {
      throw new Error(`Question ${question.id} has an inconsistent answer key.`);
    }
    return {
      question_hi: question.question.trim(),
      question_en: question.question.trim(),
      options: question.options.map((option) => option.text.trim()),
      correct_index: question.options.findIndex((option) => option.isCorrect),
      position,
    };
  });
  return questions;
}

async function seed() {
  const parsedQuestions = validateSeed(source);
  const existing = await request("admin_quiz_questions?select=question_hi&limit=1000");
  const sourceQuestions = new Set(parsedQuestions.map((question) => question.question_hi));
  if (existing.some((question) => sourceQuestions.has(question.question_hi))) {
    throw new Error("This Hindi literature quiz (or part of it) is already seeded.");
  }

  const quizId = `hindi-literature-mcq-${Date.now().toString(36)}`;
  const quiz = {
    id: quizId,
    title_hi: "हिंदी साहित्य बहुविकल्पीय प्रश्नोत्तरी",
    title_en: "Hindi Literature MCQ Quiz",
    status: "published",
  };
  const questions = parsedQuestions.map((question, index) => ({
    ...question,
    id: `${quizId}-${index + 1}`,
    quiz_id: quizId,
  }));

  await request("admin_quizzes", { method: "POST", body: JSON.stringify(quiz), headers: { Prefer: "return=minimal" } });
  try {
    await request("admin_quiz_questions", { method: "POST", body: JSON.stringify(questions), headers: { Prefer: "return=minimal" } });
  } catch (error) {
    await request(`admin_quizzes?id=eq.${encodeURIComponent(quizId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    throw error;
  }
  console.log(`Seeded ${questions.length} Hindi literature questions (quiz: ${quizId}).`);
}

seed().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
