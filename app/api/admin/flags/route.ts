import { requireAdmin } from "@/lib/server/admin";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth) return Response.json({ error: "Admin access is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { readerId?: unknown; reason?: unknown; source?: unknown } | null;
  if (!body || typeof body.readerId !== "string" || typeof body.reason !== "string" || !body.reason.trim()) return Response.json({ error: "Reader and reason are required." }, { status: 400 });
  const source = body.source === "quiz" || body.source === "manual" ? body.source : "reading";
  const { error } = await auth.admin.from("moderation_flags").insert({ reader_id: body.readerId, reason: body.reason.trim().slice(0, 500), source, ...(auth.userId ? { created_by: auth.userId } : {}) });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
