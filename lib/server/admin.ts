import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/server/supabase";
import { requireUser } from "@/lib/server/supabase";

const sessionName = "rajkamal_admin_session";
const sessionTtlMs = 12 * 60 * 60 * 1_000;

function equal(left: string, right: string) {
  const leftBuffer = Buffer.from(left); const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function validEnvironmentAdmin(email: unknown, password: unknown) {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword || typeof email !== "string" || typeof password !== "string") return false;
  return equal(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase()) && equal(password, expectedPassword);
}

export function issueAdminSession(email: string) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.TRANSCRIPTION_PROOF_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured.");
  const payload = Buffer.from(JSON.stringify({ email, expiresAt: Date.now() + sessionTtlMs })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function hasEnvironmentAdminSession(request: Request) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.TRANSCRIPTION_PROOF_SECRET;
  const token = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${sessionName}=`))?.slice(sessionName.length + 1);
  if (!secret || !token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (!equal(signature, expected)) return false;
  try { const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: unknown; expiresAt?: unknown }; return typeof value.email === "string" && typeof value.expiresAt === "number" && value.expiresAt > Date.now() && value.email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase(); } catch { return false; }
}

export const adminSessionCookie = { name: sessionName, options: { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionTtlMs / 1000 } };

export async function requireAdmin(request: Request) {
  if (hasEnvironmentAdminSession(request)) return { admin: createAdminClient(), userId: null };
  const auth = await requireUser(request).catch(() => null);
  if (!auth) return null;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const role = auth.user.app_metadata?.role;
  if (role !== "admin" && (!auth.user.email || !allowed.includes(auth.user.email.toLowerCase()))) return null;
  return { admin: auth.admin, userId: auth.user.id };
}
