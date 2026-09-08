import { ReadingScore } from "@/lib/scoring";
import { createClient } from "@/utils/supabase/client";

export type ReaderDetails = {
  name: string;
  age: string;
  phone: string;
  email: string;
  place: string;
};

type SaveAttemptInput = {
  details: ReaderDetails;
  passage: { id: string; title: string; sequence: number };
  transcript: string;
  durationSeconds: number;
  score: ReadingScore;
};

async function getAnonymousReaderId() {
  const supabase = createClient();
  const { data: currentUser, error: currentUserError } = await supabase.auth.getUser();
  if (currentUserError) throw currentUserError;
  if (currentUser.user) return { supabase, userId: currentUser.user.id };

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("Unable to create a reader session.");
  return { supabase, userId: data.user.id };
}

export async function saveReaderAttempt(input: SaveAttemptInput) {
  const { supabase, userId } = await getAnonymousReaderId();
  const { details, passage, transcript, durationSeconds, score } = input;

  const { error: profileError } = await supabase.from("reader_profiles").upsert({
    id: userId,
    full_name: details.name.trim(),
    age: Number(details.age),
    phone: details.phone.trim(),
    email: details.email.trim() || null,
    place: details.place.trim(),
    consented_at: new Date().toISOString(),
  });
  if (profileError) throw profileError;

  const { error: attemptError } = await supabase.from("reading_attempts").insert({
    reader_id: userId,
    passage_id: passage.id,
    passage_title: passage.title,
    passage_sequence: passage.sequence,
    transcript,
    duration_seconds: durationSeconds,
    accuracy: score.accuracy,
    fluency: score.fluency,
    completion: score.completion,
    words_per_minute: score.wordsPerMinute,
    total_score: score.total,
    scoring_source: "browser",
  });
  if (attemptError) throw attemptError;
}
