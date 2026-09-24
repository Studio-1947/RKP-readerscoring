import { adminSessionCookie, issueAdminSession, validEnvironmentAdmin } from "@/lib/server/admin";
import { allowRateLimit } from "@/lib/server/security";

export async function POST(request: Request) {
  if (!allowRateLimit(request, "admin-login", 8, 15 * 60 * 1_000)) return Response.json({ error: "Too many sign-in attempts. Please wait and try again." }, { status: 429 });
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  if (!body || !validEnvironmentAdmin(body.email, body.password)) return Response.json({ error: "Invalid email or password." }, { status: 401 });
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${adminSessionCookie.name}=${issueAdminSession(String(body.email).trim().toLowerCase())}; Path=/; Max-Age=${adminSessionCookie.options.maxAge}; HttpOnly; SameSite=Lax${adminSessionCookie.options.secure ? "; Secure" : ""}`);
  return response;
}
