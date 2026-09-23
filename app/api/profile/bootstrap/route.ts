import { requireUser } from "@/lib/server/supabase";

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Profile setup is not configured on this server." }, { status: 503 });
  }
  const auth = await requireUser(request).catch(() => null);
  if (!auth) return Response.json({ error: "A reader session is required." }, { status: 401 });
  const { error } = await auth.admin.from("reader_profiles").upsert({ id: auth.user.id, email: auth.user.email ?? null }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return Response.json({ error: "Unable to initialize profile." }, { status: 500 });
  return Response.json({ ok: true });
}
