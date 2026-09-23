import { allowRateLimit } from "@/lib/server/security";
import { requireUser } from "@/lib/server/supabase";

export async function POST(request: Request) {
  if (!allowRateLimit(request, "auth-logout", 30, 60 * 1000)) {
    return Response.json({ error: "Too many logout requests." }, { status: 429 });
  }

  const auth = await requireUser(request).catch(() => null);
  if (auth?.user) {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      await auth.admin.auth.admin.signOut(token, "local").catch(() => null);
    }
  }

  // Create response with cleared auth cookie headers if applicable
  const response = Response.json({ ok: true, message: "Logged out successfully." });
  response.headers.set("Set-Cookie", "sb-access-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
  response.headers.append("Set-Cookie", "sb-refresh-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
  return response;
}
