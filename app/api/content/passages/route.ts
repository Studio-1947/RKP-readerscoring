import library from "@/Hindi_Literary_100_Samples.json";
import { createAdminClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await createAdminClient().from("reader_passages").select("id,sequence,title,difficulty_editorial,lines,reference_text,word_count_whitespace").eq("status", "published").order("sequence");
    if (error) throw error;
    const passages = (data ?? []).filter((row) => Array.isArray(row.lines) && row.lines.every((line) => typeof line === "string"));
    return Response.json({ passages: passages.length ? passages : library.samples });
  } catch {
    return Response.json({ passages: library.samples });
  }
}
