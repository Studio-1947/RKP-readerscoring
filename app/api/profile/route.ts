import { allowRateLimit } from "@/lib/server/security";
import { requireUser } from "@/lib/server/supabase";

type Details = { name?: unknown; username?: unknown; age?: unknown; phone?: unknown; email?: unknown; place?: unknown; leaderboardOptIn?: unknown; favoriteAuthors?: unknown; favoriteBooks?: unknown };
function textList(value: unknown) {
  if (!Array.isArray(value) || value.length > 4 || value.some((item) => typeof item !== "string" || item.trim().length > 120)) return null;
  return value.map((item) => item.trim()).filter(Boolean);
}
function autoUsername(name: string, email: string, phone: string, userId: string) {
  let base = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!base && email) base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!base && phone) base = `reader${phone.replace(/\D/g, "").slice(-4)}`;
  if (!base) base = "reader";
  const tag = userId.slice(0, 4);
  return `${base}_${tag}`;
}
function validDetails(value: Details, userId: string) {
  const full_name = typeof value.name === "string" ? value.name.trim() : "";
  let username = typeof value.username === "string" ? value.username.trim().replace(/^@/, "") : "";
  if (!username) username = autoUsername(full_name, typeof value.email === "string" ? value.email : "", typeof value.phone === "string" ? value.phone : "", userId);
  const age = Number(value.age); const phone = typeof value.phone === "string" ? value.phone.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim() : ""; const place = typeof value.place === "string" ? value.place.trim() : "";
  const favorite_authors = textList(value.favoriteAuthors ?? []); const favorite_books = textList(value.favoriteBooks ?? []);
  if (!full_name || full_name.length > 120 || username.length > 60 || (String(value.age ?? "") && (!Number.isInteger(age) || age < 5 || age > 120)) || (phone && (phone.replace(/\D/g, "").length < 10 || phone.length > 24)) || place.length > 120 || email.length > 254 || !favorite_authors || !favorite_books) return null;
  return { full_name: full_name || null, username: username || null, age: String(value.age ?? "") ? age : null, phone: phone || null, email: email || null, place: place || null, leaderboard_opt_in: value.leaderboardOptIn === true, favorite_authors, favorite_books };
}

export async function POST(request: Request) {
  if (!allowRateLimit(request, "profile-save", 20, 60 * 60 * 1_000)) return Response.json({ error: "Too many profile updates." }, { status: 429 });
  const auth = await requireUser(request).catch(() => null);
  if (!auth) return Response.json({ error: "A reader session is required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Details | null;
  const profile = body && validDetails(body, auth.user.id);
  if (!profile) return Response.json({ error: "Please complete the required profile details." }, { status: 400 });
  const { error } = await auth.admin.from("reader_profiles").upsert({ id: auth.user.id, ...profile, consented_at: new Date().toISOString() });
  if (error) return Response.json({ error: "Unable to save your profile." }, { status: 500 });
  return Response.json({ ok: true });
}
