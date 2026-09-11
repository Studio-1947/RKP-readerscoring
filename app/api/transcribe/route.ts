const SPEECHMATICS_BASE_URL = "https://asr.api.speechmatics.com/v2";
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const POLL_INTERVAL_MS = 400;
const SPEECHMATICS_TIMEOUT_MS = 30_000;
const TRANSIENT_RETRY_DELAYS_MS = [400, 1_000];
const ACCEPTED_AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/x-wav"]);
const EXTENSION_MAP: Record<string, string> = {
  "audio/webm": "webm", "audio/mp4": "mp4", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav",
};

export const runtime = "nodejs";
export const maxDuration = 40;

type JobResponse = {
  detail?: string;
  error?: string;
  id?: string;
  job?: { id?: string; status?: string; errors?: Array<{ message?: string }> };
};
type AudioInput = { blob: Blob; bytes: number; filename: string; mimeType: string };

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// Providers can answer failures with HTML, so parsing must not hide the useful
// upstream response behind a JSON parse error.
async function readJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return { detail: raw.slice(0, 300) } as T;
  }
}

function speechmaticsError(payload: JobResponse, fallback: string) {
  return payload.job?.errors?.map((error) => error.message).filter(Boolean).join("; ")
    || payload.detail || payload.error || fallback;
}

function isTransientStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

async function transcribeWithSpeechmatics(input: AudioInput, apiKey: string) {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const signal = AbortSignal.timeout(SPEECHMATICS_TIMEOUT_MS);
  let jobId = "";
  try {
    let submitted: Response | undefined;
    let submittedPayload: JobResponse = {};
    for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt += 1) {
      const body = new FormData();
      body.append("data_file", input.blob, input.filename);
      body.append("config", JSON.stringify({
        type: "transcription",
        transcription_config: { language: "hi", operating_point: "standard" },
      }));
      submitted = await fetch(`${SPEECHMATICS_BASE_URL}/jobs/`, {
        method: "POST", headers, body, cache: "no-store", signal,
      });
      submittedPayload = await readJsonResponse<JobResponse>(submitted);
      if (submitted.ok || !isTransientStatus(submitted.status) || attempt === TRANSIENT_RETRY_DELAYS_MS.length) break;
      await wait(TRANSIENT_RETRY_DELAYS_MS[attempt]);
    }
    if (!submitted?.ok) {
      throw new Error(speechmaticsError(submittedPayload, `Speechmatics returned ${submitted?.status || "no response"}.`));
    }
    jobId = submittedPayload.id || submittedPayload.job?.id || "";
    if (!jobId) throw new Error("Speechmatics did not return a job ID.");

    const deadline = Date.now() + SPEECHMATICS_TIMEOUT_MS;
    let completed = false;
    while (Date.now() < deadline) {
      await wait(POLL_INTERVAL_MS);
      const statusResponse = await fetch(`${SPEECHMATICS_BASE_URL}/jobs/${encodeURIComponent(jobId)}`, {
        headers, cache: "no-store", signal,
      });
      const statusPayload = await readJsonResponse<JobResponse>(statusResponse);
      if (!statusResponse.ok) {
        if (isTransientStatus(statusResponse.status)) continue;
        throw new Error(speechmaticsError(statusPayload, `Speechmatics status returned ${statusResponse.status}.`));
      }
      if (statusPayload.job?.status === "rejected") {
        throw new Error(speechmaticsError(statusPayload, "Speechmatics rejected the recording."));
      }
      if (statusPayload.job?.status === "done") { completed = true; break; }
    }
    if (!completed) throw new Error("Speechmatics transcription timed out.");

    const transcriptResponse = await fetch(
      `${SPEECHMATICS_BASE_URL}/jobs/${encodeURIComponent(jobId)}/transcript?format=txt`,
      { headers: { ...headers, Accept: "text/plain" }, cache: "no-store", signal },
    );
    if (!transcriptResponse.ok) throw new Error(`Speechmatics transcript returned ${transcriptResponse.status}.`);
    const text = (await transcriptResponse.text()).trim();
    if (!text) throw new Error("No speech was recognized.");
    return text;
  } finally {
    if (jobId) {
      await fetch(`${SPEECHMATICS_BASE_URL}/jobs/${encodeURIComponent(jobId)}`, {
        method: "DELETE", headers, signal: AbortSignal.timeout(3_000),
      }).catch(() => undefined);
    }
  }
}

export async function POST(request: Request) {
  const speechmaticsKey = process.env.SPEECHMATICS_API_KEY?.trim();
  if (!speechmaticsKey) {
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
  if (audio.size < 1_000) {
    return Response.json({ error: "Recording is too short or incomplete. Please record for at least two seconds.", code: "INCOMPLETE_RECORDING" }, { status: 422 });
  }
  if (normalizedType && !ACCEPTED_AUDIO_TYPES.has(normalizedType)) {
    return Response.json({ error: "Unsupported audio format." }, { status: 415 });
  }

  // Materialize once so the same recording can safely be sent to either provider.
  const audioBytes = new Uint8Array(await audio.arrayBuffer());
  const mimeType = normalizedType || "audio/webm";
  const extension = EXTENSION_MAP[mimeType] || "webm";
  const filename = audio.name && audio.name !== "blob" && audio.name.includes(".") ? audio.name : `reading.${extension}`;
  const input: AudioInput = {
    blob: new Blob([audioBytes], { type: mimeType }),
    bytes: audioBytes.byteLength,
    filename,
    mimeType,
  };
  const requestId = crypto.randomUUID();
  try {
    const text = await transcribeWithSpeechmatics(input, speechmaticsKey);
    return Response.json({ text, source: "speechmatics" });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    const noSpeech = message === "No speech was recognized.";
    const timedOut = message.includes("timed out") || (caught instanceof DOMException && caught.name === "TimeoutError");
    console.error("[Rajkamal Reader][speechmatics] transcription failed", {
      requestId, bytes: input.bytes, mimeType: input.mimeType, error: message,
    });
    return Response.json(
      {
        error: noSpeech
          ? "No speech was detected in the recording."
          : timedOut
            ? "Speechmatics transcription timed out. Please try a shorter recording."
            : "Speechmatics could not process this recording.",
        code: noSpeech ? "NO_SPEECH" : timedOut ? "SPEECHMATICS_TIMEOUT" : "SPEECHMATICS_FAILED",
        detail: noSpeech ? undefined : message.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240),
        requestId,
      },
      { status: noSpeech ? 422 : timedOut ? 504 : 502 },
    );
  }
}
