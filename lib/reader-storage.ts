import { ReadingScore } from "@/lib/scoring";
import { createClient } from "@/utils/supabase/client";

export type ReaderDetails = {
  name: string;
  age: string;
  phone: string;
  email: string;
  place: string;
  leaderboardOptIn?: boolean;
};

export async function loadSavedReaderDetails(): Promise<ReaderDetails | null> {
  const supabase = createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("reader_profiles")
    .select("full_name,age,phone,email,place,leaderboard_opt_in")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    name: data.full_name,
    age: String(data.age),
    phone: data.phone,
    email: data.email ?? "",
    place: data.place,
    leaderboardOptIn: data.leaderboard_opt_in === true,
  };
}

type SaveAttemptInput = {
  details: ReaderDetails;
  passage: { id: string; title: string; sequence: number };
  transcript: string;
  durationSeconds: number;
  score: ReadingScore;
  scoringSource?: "browser" | "server";
};

export async function getAnonymousReaderId(details: ReaderDetails) {
  const supabase = createClient();
  const { data: currentUser, error: currentUserError } = await supabase.auth.getUser();
  if (currentUserError && currentUserError.name !== "AuthSessionMissingError") throw currentUserError;

  if (currentUser.user) {
    const { data: existingProfile, error: profileError } = await supabase
      .from("reader_profiles")
      .select("full_name,phone")
      .eq("id", currentUser.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const sameReader = existingProfile
      && existingProfile.full_name.trim().toLocaleLowerCase() === details.name.trim().toLocaleLowerCase()
      && existingProfile.phone.replace(/\D/g, "") === details.phone.replace(/\D/g, "");
    if (!existingProfile || sameReader) return { supabase, userId: currentUser.user.id };

    // Shared devices are common at events. Do not overwrite the previous person's
    // profile when a different name/phone submits the next reading.
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) throw signOutError;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("Unable to create a reader session.");
  return { supabase, userId: data.user.id };
}

export async function saveReaderAttempt(input: SaveAttemptInput) {
  const { details, passage, transcript, durationSeconds, score, scoringSource = "browser" } = input;
  const { supabase, userId } = await getAnonymousReaderId(details);

  const { error: profileError } = await supabase.from("reader_profiles").upsert({
    id: userId,
    full_name: details.name.trim(),
    age: Number(details.age),
    phone: details.phone.trim(),
    email: details.email.trim() || null,
    place: details.place.trim(),
    consented_at: new Date().toISOString(),
    leaderboard_opt_in: details.leaderboardOptIn === true,
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
    scoring_source: scoringSource,
  });
  if (attemptError) throw attemptError;
}

type SaveQuizAttemptInput = {
  details: ReaderDetails;
  quizId: string;
  quizTitle: string;
  correctCount: number;
  totalQuestions: number;
  totalScore: number;
};

export async function saveQuizAttempt(input: SaveQuizAttemptInput) {
  const { details, quizId, quizTitle, correctCount, totalQuestions, totalScore } = input;
  const { supabase, userId } = await getAnonymousReaderId(details);

  const { error: profileError } = await supabase.from("reader_profiles").upsert({
    id: userId,
    full_name: details.name.trim(),
    age: Number(details.age),
    phone: details.phone.trim(),
    email: details.email.trim() || null,
    place: details.place.trim(),
    consented_at: new Date().toISOString(),
    leaderboard_opt_in: details.leaderboardOptIn === true,
  });
  if (profileError) throw profileError;

  const { error: attemptError } = await supabase.from("quiz_attempts").insert({
    reader_id: userId,
    quiz_id: quizId,
    quiz_title: quizTitle,
    correct_count: correctCount,
    total_questions: totalQuestions,
    total_score: totalScore,
  });
  if (attemptError) throw attemptError;
}
