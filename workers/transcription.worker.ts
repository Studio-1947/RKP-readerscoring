import { pipeline } from "@huggingface/transformers";
import type { AutomaticSpeechRecognitionPipelineType } from "@huggingface/transformers";

type Device = "webgpu" | "wasm";

let transcriber: AutomaticSpeechRecognitionPipelineType | null = null;

async function loadTranscriber(device: Device) {
  const options = {
    device,
    dtype: device === "webgpu" ? "fp16" as const : "q8" as const,
    progress_callback: (progress: unknown) => self.postMessage({ type: "progress", progress }),
  };
  return pipeline<"automatic-speech-recognition">(
    "automatic-speech-recognition",
    "onnx-community/whisper-base",
    options,
  );
}

self.onmessage = async (event: MessageEvent<{ audio: Float32Array; device: Device }>) => {
  try {
    const { audio, device } = event.data;

    if (!transcriber) {
      self.postMessage({ type: "status", message: "Loading the Hindi speech model…" });
      try {
        transcriber = await loadTranscriber(device);
      } catch (caught) {
        if (device !== "webgpu") throw caught;
        self.postMessage({ type: "status", message: "GPU unavailable; continuing with compatibility mode…" });
        transcriber = await loadTranscriber("wasm");
      }
    }

    self.postMessage({ type: "status", message: "Transcribing your reading…" });
    const result = await transcriber(audio, {
      language: "hi",
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const text = Array.isArray(result) ? result.map((item) => item.text).join(" ") : result.text;
    self.postMessage({ type: "complete", text: text.trim() });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    self.postMessage({ type: "error", message });
  }
};
