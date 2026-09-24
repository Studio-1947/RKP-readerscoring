import { adminSessionCookie } from "@/lib/server/admin";

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${adminSessionCookie.name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${adminSessionCookie.options.secure ? "; Secure" : ""}`);
  return response;
}
