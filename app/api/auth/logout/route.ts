import { allowRateLimit } from "@/lib/server/security";
import { requireUser } from "@/lib/server/supabase";

const BASE_URL = "https://backend.rajkamalprakashan.com/api/v1/auth";

export async function POST(request: Request) {
  if (!allowRateLimit(request, "auth-logout", 30, 60 * 1000)) {
    return Response.json({ error: "Too many logout requests." }, { status: 429 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const rkpToken = request.headers.get("x-rkp-token") || token;
  
  // Call the new backend logout
  if (rkpToken) {
    await fetch(`${BASE_URL}/logout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${rkpToken}`
      }
    }).catch(() => null);
  }

  // Fallback to supabase logout to gracefully transition users
  const auth = await requireUser(request).catch(() => null);
  if (auth?.user && token) {
    await auth.admin.auth.admin.signOut(token, "local").catch(() => null);
  }

  // Create response with cleared auth cookie headers if applicable
  const response = Response.json({ ok: true, message: "Logged out successfully." });
  response.headers.set("Set-Cookie", "sb-access-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
  response.headers.append("Set-Cookie", "sb-refresh-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
  return response;
}
