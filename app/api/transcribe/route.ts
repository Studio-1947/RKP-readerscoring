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

// Speechmatics answers auth failures with an nginx HTML page, so `.json()` would throw
// and mask the real upstream status behind a parse error.
async function readJobResponse(response: Response): Promise<JobResponse> {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as JobResponse;
  } catch {
    return { detail: raw.slice(0, 300) };
  }
}

function providerError(payload: JobResponse, fallback: string) {
  return payload.job?.errors?.map((error) => error.message).filter(Boolean).join("; ")
    || payload.detail
    || payload.error
    || fallback;
}

export async function POST(request: Request) {
  const apiKey = process.env.SPEECHMATICS_API_KEY?.trim();
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
  const requestId = crypto.randomUUID();
  const signal = AbortSignal.timeout(JOB_TIMEOUT_MS);
  let stage = "submit";
  let upstreamStatus = 0;

  try {
    // Forward a fully materialized copy of the audio. Re-appending the `File` that
    // `request.formData()` returns leaves the outbound multipart part empty on some
    // serverless runtimes, and an empty `data_file` is exactly what Speechmatics
    // rejects with a 400 ("data_file is too small for valid audio, size: 0").
    const audioBytes = new Uint8Array(await audio.arrayBuffer());
    if (!audioBytes.byteLength) throw new Error("Recording body was empty after parsing.");
    const providerFile = new Blob([audioBytes], { type: normalizedType || "audio/webm" });

    const providerBody = new FormData();
    providerBody.append("data_file", providerFile, audio.name || "reading.webm");
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
      signal,
    });
    upstreamStatus = submitted.status;
    const submittedPayload = await readJobResponse(submitted);
    if (!submitted.ok) throw new Error(providerError(submittedPayload, "Speechmatics rejected the recording."));
    jobId = submittedPayload.id || submittedPayload.job?.id || "";
    if (!jobId) throw new Error("Speechmatics did not return a job ID.");

    const deadline = Date.now() + JOB_TIMEOUT_MS;
    let completed = false;
    stage = "poll";
    while (Date.now() < deadline) {
      await wait(POLL_INTERVAL_MS);
      const statusResponse = await fetch(`${SPEECHMATICS_BASE_URL}/jobs/${encodeURIComponent(jobId)}`, {
        headers,
        cache: "no-store",
        signal,
      });
      upstreamStatus = statusResponse.status;
      const statusPayload = await readJobResponse(statusResponse);
      if (!statusResponse.ok) throw new Error(providerError(statusPayload, "Unable to read transcription status."));
      const status = statusPayload.job?.status;
      if (status === "rejected") throw new Error(providerError(statusPayload, "Speechmatics could not transcribe the recording."));
      if (status === "done") { completed = true; break; }
    }

    if (!completed) throw new Error("Transcription timed out.");

    stage = "transcript";
    const transcriptResponse = await fetch(
      `${SPEECHMATICS_BASE_URL}/jobs/${encodeURIComponent(jobId)}/transcript?format=txt`,
      { headers: { ...headers, Accept: "text/plain" }, cache: "no-store", signal },
    );
    upstreamStatus = transcriptResponse.status;
    if (!transcriptResponse.ok) throw new Error("Unable to retrieve the completed transcript.");
    const text = (await transcriptResponse.text()).trim();
    if (!text) throw new Error("No speech was recognized.");

    return Response.json({ text, source: "speechmatics" });
  } catch (caught) {
    console.error("[Rajkamal Reader][speechmatics] transcription failed", { requestId, stage, upstreamStatus, bytes: audio.size, mimeType: audio.type, error: caught });
    const message = caught instanceof Error ? caught.message : String(caught);
    const noSpeech = message === "No speech was recognized.";
    const timedOut = signal.aborted || message === "Transcription timed out.";
    return Response.json(
      {
        error: noSpeech ? "No speech was detected in the recording." : timedOut ? "Transcription timed out. Please try a shorter recording." : "Transcription service could not process this recording.",
        code: noSpeech ? "NO_SPEECH" : timedOut ? "PROVIDER_TIMEOUT" : `PROVIDER_${stage.toUpperCase()}_${upstreamStatus || "NETWORK"}`,
        // The upstream message is a format/validation string, never credentials — carrying
        // it through keeps a failure diagnosable from the browser console alone.
        detail: noSpeech || timedOut ? undefined : message,
        requestId,
      },
      { status: noSpeech ? 422 : timedOut ? 504 : 502 },
    );
  } finally {
    if (jobId) {
      await fetch(`${SPEECHMATICS_BASE_URL}/jobs/${encodeURIComponent(jobId)}`, {
        method: "DELETE",
        headers,
        signal: AbortSignal.timeout(3_000),
      }).catch(() => undefined);
    }
  }
}
