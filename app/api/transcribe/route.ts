const SPEECHMATICS_BASE_URL = "https://asr.api.speechmatics.com/v2";
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const POLL_INTERVAL_MS = 750;
const JOB_TIMEOUT_MS = 48_000;
const ACCEPTED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
]);

export const runtime = "nodejs";
export const maxDuration = 60;

type JobResponse = {
  code?: number;
  detail?: string;
  error?: string;
  id?: string;
  job?: { id?: string; status?: string; errors?: Array<{ message?: string }> };
};

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function providerError(payload: JobResponse, fallback: string) {
  return payload.job?.errors?.map((error) => error.message).filter(Boolean).join("; ")
    || payload.detail
    || payload.error
    || fallback;
}

export async function POST(request: Request) {
  const apiKey = process.env.SPEECHMATICS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Transcription service is not configured." }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_AUDIO_BYTES + 64_000) {
    return Response.json({ error: "Recording is too large." }, { status: 413 });
  }

  let audio: File;
  try {
    const body = await request.formData();
    const candidate = body.get("audio");
    if (!(candidate instanceof File)) throw new Error("Audio file is missing.");
    audio = candidate;
  } catch {
    return Response.json({ error: "A valid audio recording is required." }, { status: 400 });
  }

  const normalizedType = audio.type.split(";")[0].toLowerCase();
  if (!audio.size || audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "Recording must be between 1 byte and 5 MB." }, { status: 413 });
  }
  if (normalizedType && !ACCEPTED_AUDIO_TYPES.has(normalizedType)) {
    return Response.json({ error: "Unsupported audio format." }, { status: 415 });
  }

  const headers = { Authorization: `Bearer ${apiKey}` };
  let jobId = "";

  try {
    const providerBody = new FormData();
    providerBody.append("data_file", audio, audio.name || "reading.webm");
    providerBody.append("config", JSON.stringify({
      type: "transcription",
      transcription_config: {
        language: "hi",
      },
    }));

    const submitted = await fetch(`${SPEECHMATICS_BASE_URL}/jobs/`, {
      method: "POST",
      headers,
      body: providerBody,
      cache: "no-store",
    });
    const submittedPayload = await submitted.json() as JobResponse;
    if (!submitted.ok) throw new Error(providerError(submittedPayload, "Speechmatics rejected the recording."));
    jobId = submittedPayload.id || submittedPayload.job?.id || "";
    if (!jobId) throw new Error("Speechmatics did not return a job ID.");

    const deadline = Date.now() + JOB_TIMEOUT_MS;
    let completed = false;
    while (Date.now() < deadline) {
      await wait(POLL_INTERVAL_MS);
      const statusResponse = await fetch(`${SPEECHMATICS_BASE_URL}/jobs/${encodeURIComponent(jobId)}`, {
        headers,
        cache: "no-store",
      });
      const statusPayload = await statusResponse.json() as JobResponse;
      if (!statusResponse.ok) throw new Error(providerError(statusPayload, "Unable to read transcription status."));
      const status = statusPayload.job?.status;
      if (status === "rejected") throw new Error(providerError(statusPayload, "Speechmatics could not transcribe the recording."));
      if (status === "done") { completed = true; break; }
    }

    if (!completed) throw new Error("Transcription timed out.");

    const transcriptResponse = await fetch(
      `${SPEECHMATICS_BASE_URL}/jobs/${encodeURIComponent(jobId)}/transcript?format=txt`,
      { headers: { ...headers, Accept: "text/plain" }, cache: "no-store" },
    );
    if (!transcriptResponse.ok) throw new Error("Unable to retrieve the completed transcript.");
    const text = (await transcriptResponse.text()).trim();
    if (!text) throw new Error("No speech was recognized.");

    return Response.json({ text, source: "speechmatics" });
  } catch (caught) {
    console.error("[Rajkamal Reader][speechmatics] transcription failed", caught);
    const message = caught instanceof Error ? caught.message : String(caught);
    const noSpeech = message === "No speech was recognized.";
    return Response.json(
      {
        error: noSpeech ? "No speech was detected in the recording." : "Transcription service could not process this recording.",
        code: noSpeech ? "NO_SPEECH" : "PROVIDER_ERROR",
      },
      { status: noSpeech ? 422 : 502 },
    );
  } finally {
    if (jobId) {
      await fetch(`${SPEECHMATICS_BASE_URL}/jobs/${encodeURIComponent(jobId)}`, {
        method: "DELETE",
        headers,
      }).catch(() => undefined);
    }
  }
}
