import { createAdminClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data: quiz, error } = await admin.from("admin_quizzes").select("id,title_hi,title_en").eq("status", "published").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !quiz) return Response.json({ quiz: null });
    const { data: questions, error: questionError } = await admin.from("admin_quiz_questions").select("id,question_hi,question_en,options,correct_index,position").eq("quiz_id", quiz.id).order("position");
    if (questionError || !questions?.length) return Response.json({ quiz: null });
    return Response.json({ quiz: { id: quiz.id, title: { hi: quiz.title_hi, en: quiz.title_en }, questions } });
  } catch { return Response.json({ quiz: null }); }
}
