import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcription is not configured yet. Add OPENAI_API_KEY to the Vercel Production environment." },
      { status: 503 },
    );
  }

  const incoming = await request.formData();
  const audio = incoming.get("audio");
  const reference = incoming.get("reference");

  if (!(audio instanceof File) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Please submit a recording smaller than 4 MB." }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", audio, audio.name || "reading.webm");
  upstream.append("model", "gpt-4o-mini-transcribe");
  upstream.append("language", "hi");
  if (typeof reference === "string" && reference.trim()) {
    upstream.append("prompt", reference.slice(0, 3500));
  }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!response.ok) {
      console.error("Transcription provider error:", response.status);
      return NextResponse.json({ error: "We could not transcribe this recording. Please try again." }, { status: 502 });
    }

    const payload = await response.json() as { text?: string };
    if (!payload.text?.trim()) {
      return NextResponse.json({ error: "No speech was detected. Please try again in a quiet place." }, { status: 422 });
    }

    return NextResponse.json({ transcript: payload.text.trim() });
  } catch {
    return NextResponse.json({ error: "The transcription service is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
