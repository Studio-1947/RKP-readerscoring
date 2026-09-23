import { requireUser } from "@/lib/server/supabase";

export async function DELETE(request: Request) {
  const auth = await requireUser(request).catch(() => null);
  if (!auth) return Response.json({ error: "A reader session is required." }, { status: 401 });
  const { error } = await auth.admin.auth.admin.deleteUser(auth.user.id);
  if (error) return Response.json({ error: "Unable to delete reader data." }, { status: 500 });
  return new Response(null, { status: 204 });
}
