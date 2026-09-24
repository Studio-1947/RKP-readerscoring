import { ReadingScore } from "@/lib/scoring";
import { createClient } from "@/utils/supabase/client";

export type ReaderDetails = {
  name: string;
  username?: string;
  age: string;
  phone: string;
  email: string;
  place: string;
  leaderboardOptIn?: boolean;
  favoriteAuthors?: string[];
  favoriteBooks?: string[];
  memberSince?: string;
};

export async function loadSavedReaderDetails(): Promise<ReaderDetails | null> {
  const supabase = createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("reader_profiles")
    .select("full_name,username,age,phone,email,place,leaderboard_opt_in,favorite_authors,favorite_books,created_at")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    name: data.full_name ?? "",
    username: data.username ?? "",
    age: data.age == null ? "" : String(data.age),
    phone: data.phone ?? "",
    email: data.email ?? "",
    place: data.place ?? "",
    leaderboardOptIn: data.leaderboard_opt_in === true,
    favoriteAuthors: data.favorite_authors ?? [],
    favoriteBooks: data.favorite_books ?? [],
    memberSince: data.created_at,
  };
}

type SaveAttemptInput = {
  details: ReaderDetails;
  passage: { id: string; title: string; sequence: number };
  transcript: string;
  durationSeconds: number;
  score: ReadingScore;
  scoringSource?: "browser" | "server";
  proof?: string;
};

async function authenticatedRequest(path: string, body: unknown, method = "POST") {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw error ?? new Error("No reader session found.");
  const response = await fetch(path, { method, headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" }, body: method === "DELETE" ? undefined : JSON.stringify(body) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Unable to save reader data.");
  return response.status === 204 ? null : response.json();
}

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
      && (existingProfile.full_name ?? "").trim().toLocaleLowerCase() === details.name.trim().toLocaleLowerCase()
      && (existingProfile.phone ?? "").replace(/\D/g, "") === details.phone.replace(/\D/g, "");
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
  const { details, passage, durationSeconds, proof } = input;
  await getAnonymousReaderId(details);
  if (!proof) throw new Error("Only server-verified recordings can be saved.");
  return authenticatedRequest("/api/attempts/reading", { details, passageId: passage.id, durationSeconds, proof });
}

export async function updateLeaderboardOptIn(optIn: boolean) {
  const supabase = createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!auth.user) throw new Error("No reader session found.");

  const { error } = await supabase.from("reader_profiles").update({ leaderboard_opt_in: optIn }).eq("id", auth.user.id);
  if (error) throw error;
}

type SaveQuizAttemptInput = {
  details: ReaderDetails;
  answers: Record<string, number>;
  quizId?: string;
};

export async function saveQuizAttempt(input: SaveQuizAttemptInput) {
  await getAnonymousReaderId(input.details);
  return authenticatedRequest("/api/attempts/quiz", input);
}

export async function deleteReaderData() {
  await authenticatedRequest("/api/reader", null, "DELETE");
}

export async function saveReaderProfile(details: ReaderDetails) {
  await getAnonymousReaderId(details);
  return authenticatedRequest("/api/profile", details);
}
