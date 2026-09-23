import { createHmac, timingSafeEqual } from "node:crypto";

const proofTtlMs = 10 * 60 * 1_000;
const requests = new Map<string, number[]>();

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export function issueTranscriptionProof(transcript: string) {
  const secret = process.env.TRANSCRIPTION_PROOF_SECRET;
  if (!secret) throw new Error("TRANSCRIPTION_PROOF_SECRET is not configured.");
  const payload = base64Url(JSON.stringify({ transcript, expiresAt: Date.now() + proofTtlMs }));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyTranscriptionProof(proof: unknown) {
  const secret = process.env.TRANSCRIPTION_PROOF_SECRET;
  if (!secret || typeof proof !== "string") return null;
  const [payload, signature] = proof.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { transcript?: unknown; expiresAt?: unknown };
    if (typeof value.transcript !== "string" || typeof value.expiresAt !== "number" || value.expiresAt < Date.now()) return null;
    return value.transcript;
  } catch { return null; }
}

// This is a per-instance backstop. Configure equivalent durable limits at the CDN/WAF.
export function allowRateLimit(request: Request, scope: string, limit: number, windowMs: number) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = `${scope}:${forwarded || request.headers.get("x-real-ip") || "unknown"}`;
  const now = Date.now();
  const recent = (requests.get(key) ?? []).filter((time) => time > now - windowMs);
  if (recent.length >= limit) { requests.set(key, recent); return false; }
  recent.push(now); requests.set(key, recent); return true;
}
