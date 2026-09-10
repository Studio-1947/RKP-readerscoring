"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ScoreGuide } from "@/components/reading-context";
import { ReaderDashboard } from "@/components/reader-dashboard";
import { Info, Languages, Mic, Play, RotateCcw, Share2, Timer, Volume2, X } from "lucide-react";
import { ReadingScore, scoreReading } from "@/lib/scoring";
import { saveReaderAttempt } from "@/lib/reader-storage";
import { createClient } from "@/utils/supabase/client";

type Language = "hi" | "en";
type View = "practice" | "leaderboard" | "progress";
type Status = "ready" | "recording" | "transcribing" | "details" | "result" | "unsupported";
type Passage = { id: string; sequence: number; title: string; difficulty_editorial: string; lines: string[]; reference_text: string; word_count_whitespace: number };
type Details = { name: string; age: string; phone: string; email: string; place: string; consent: boolean; leaderboardOptIn: boolean };
type Leader = { reader_label: string; best_score: number };
type Props = { passages: Passage[] };
type TranscriptSource = "browser" | "server";
type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const copy = {
  hi: {
    title: "राजकमल रीडर", motto: "अपनी आवाज़ में साहित्य", newPassage: "नई रचना", listen: "पहले सुनें", stopListen: "सुनना रोकें",
    start: "रिकॉर्ड करना शुरू करें", finish: "रिकॉर्डिंग पूरी करें", ready: "तैयार होने पर शुरू करें", help: "पंक्तियाँ अपनी आवाज़ में पढ़ें",
    recording: "आपकी आवाज़ रिकॉर्ड हो रही है", recordingHelp: "आराम से और स्पष्ट पढ़ें", transcribing: "आपकी reading जाँची जा रही है…", transcribingHelp: "कुछ क्षण लग सकते हैं",
    profileTag: "स्कोर अनलॉक करें", profileTitle: "अपना विस्तृत स्कोर देखें", profileHelp: "अपनी accuracy, pace और passage coverage देखने के लिए ये विवरण भरें।",
    name: "पूरा नाम", age: "आयु", phone: "फ़ोन नंबर", email: "ईमेल (वैकल्पिक)", place: "शहर / स्थान",
    consent: "मैं सहमत हूँ कि राजकमल मेरे स्कोर के लिए ये विवरण इस्तेमाल कर सकता है।",
    privacy: "आपकी रिकॉर्डिंग सुरक्षित ट्रांसक्रिप्शन सेवा को भेजी जाती है और काम पूरा होते ही हटाने का अनुरोध किया जाता है। यह ऐप सहमति के बाद आपके विवरण, पहचाना गया पाठ और स्कोर सहेजता है।",
    view: "मेरा स्कोर देखें", saving: "सहेजा जा रहा है…", result: "आपका परिणाम", great: "आपका पाठ पूरा हुआ", score: "कुल स्कोर",
    accuracy: "शुद्धता", fluency: "प्रवाह", completion: "पूर्णता", speed: "गति", retry: "फिर पढ़ें", share: "परिणाम शेयर करें",
    unsupported: "इस browser में audio recording उपलब्ध नहीं है। नया Chrome, Edge, Firefox या Safari इस्तेमाल करें।",
    recordingError: "माइक्रोफ़ोन की अनुमति दें और फिर कोशिश करें।", processingError: "रिकॉर्डिंग को पढ़ा नहीं जा सका। फिर से कोशिश करें।",
    voiceError: "Hindi आवाज़ उपलब्ध नहीं है। अपनी device voice settings जाँचें।", missing: "यह जानकारी भरें।",
    ageError: "5 से 120 के बीच आयु भरें।", phoneError: "मान्य फ़ोन नंबर भरें।", emailError: "मान्य ईमेल भरें।", copied: "परिणाम कॉपी हो गया है।",
    noMicFound: "कोई माइक्रोफ़ोन नहीं मिला। अपनी device settings जाँचें।",
    serviceBlocked: "इस browser ने आवाज़ पहचान सेवा रोक दी है। Chrome या Edge पर कोशिश करें।",
    networkError: "आवाज़ पहचान सेवा तक नहीं पहुँचा जा सका। इंटरनेट जाँचें और फिर कोशिश करें।",
    langUnsupported: "इस browser में हिंदी आवाज़ पहचान उपलब्ध नहीं है। Chrome या Edge पर कोशिश करें।",
    noSpeechHint: "अभी कुछ सुनाई नहीं दिया — माइक के पास थोड़ा तेज़ पढ़ें।",
    stalled: "कोई आवाज़ पहचानी नहीं गई। माइक्रोफ़ोन जाँचें और फिर पढ़ें।",
  },
  en: {
    title: "Rajkamal Reader", motto: "Literature in your voice", newPassage: "New passage", listen: "Listen first", stopListen: "Stop listening",
    start: "Start recording", finish: "Finish recording", ready: "Ready when you are", help: "Read the passage aloud in your own voice",
    recording: "Your voice is being recorded", recordingHelp: "Read slowly and clearly", transcribing: "Checking your reading…", transcribingHelp: "This may take a few moments",
    profileTag: "UNLOCK YOUR SCORE", profileTitle: "See your reading breakdown", profileHelp: "Complete these details to unlock your accuracy, pace and passage-coverage metrics.",
    name: "Full name", age: "Age", phone: "Phone number", email: "Email (optional)", place: "City / place",
    consent: "I agree that Rajkamal may use these details for my score.",
    privacy: "Your recording is sent to a secure transcription service and deletion is requested after processing. This app saves your details, recognized text and score after consent.",
    view: "View my score", saving: "Saving…", result: "YOUR RESULT", great: "Your reading is complete", score: "TOTAL SCORE",
    accuracy: "Accuracy", fluency: "Fluency", completion: "Completion", speed: "Speed", retry: "Read again", share: "Share result",
    unsupported: "Audio recording is unavailable in this browser. Use a current version of Chrome, Edge, Firefox, or Safari.",
    recordingError: "Allow microphone access and try again.", processingError: "We could not process this recording. Please try again.",
    voiceError: "A Hindi voice is unavailable. Check your device voice settings.", missing: "Complete this field.",
    ageError: "Enter an age from 5 to 120.", phoneError: "Enter a valid phone number.", emailError: "Enter a valid email.", copied: "Your result is copied and ready to share.",
    noMicFound: "No microphone was found. Check your device settings.",
    serviceBlocked: "This browser blocked the speech service. Try Chrome or Edge.",
    networkError: "We could not reach the speech service. Check your internet connection and try again.",
    langUnsupported: "Hindi speech recognition is unavailable in this browser. Try Chrome or Edge.",
    noSpeechHint: "We can't hear you yet — read a little louder, closer to the mic.",
    stalled: "We could not hear any reading. Check your microphone and read again.",
  },
} as const;

const emptyScore: ReadingScore = { total: 0, accuracy: 0, fluency: 0, completion: 0, consistency: 0, wordsRead: 0, expectedWords: 0, wordsPerMinute: 0, xp: 0 };

const micLog = (event: string, details: Record<string, unknown> = {}) => {
  console.info(`[Rajkamal Reader][mic] ${event}`, { at: new Date().toISOString(), ...details });
};

export default function OpenReader({ passages }: Props) {
  const [language, setLanguage] = useState<Language>("hi");
  const [activeView, setActiveView] = useState<View>("practice");
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>("ready");
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [score, setScore] = useState<ReadingScore>(emptyScore);
  const [error, setError] = useState("");
  const [samplePlaying, setSamplePlaying] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState("");
  const [transcriptSource, setTranscriptSource] = useState<TranscriptSource>("browser");
  const [isSaving, setIsSaving] = useState(false);
  const [browserHint, setBrowserHint] = useState("");
  const [recordingUrl, setRecordingUrl] = useState("");
  const recordingUrlRef = useRef("");
  const recognitionRestart = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionFinish = useRef<Promise<void>>(Promise.resolve());
  const resolveRecognitionFinish = useRef<(() => void) | null>(null);
  const recognitionRetries = useRef(0);
  const [details, setDetails] = useState<Details>({ name: "", age: "", phone: "", email: "", place: "", consent: false, leaderboardOptIn: false });
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [topLeaders, setTopLeaders] = useState<Leader[]>([]);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const microphoneStream = useRef<MediaStream | null>(null);
  const microphoneStarting = useRef(false);
  const audioChunks = useRef<Blob[]>([]);
  const browserRecognition = useRef<BrowserSpeechRecognition | null>(null);
  const browserFinalTranscript = useRef("");
  const browserLatestTranscript = useRef("");
  const stoppedAt = useRef(0);
  const listeningToken = useRef(0);
  const listening = useRef(false);
  const startedAt = useRef(0);
  const attempts = useRef(0);

  const passage = passages[index];
  const t = copy[language];
  const recording = status === "recording";
  const busy = recording || status === "transcribing";
  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    let cancelled = false;
    async function loadLeaders() {
      try {
        const { data } = await createClient().rpc("practice_leaderboard");
        if (!cancelled) setTopLeaders((data ?? []).slice(0, 3));
      } catch {
        if (!cancelled) setTopLeaders([]);
      }
    }
    void loadLeaders();
    return () => { cancelled = true; };
  }, [status]);

  useEffect(() => () => {
    micLog("component cleanup");
    stoppedAt.current = Date.now();
    if (recognitionRestart.current) clearTimeout(recognitionRestart.current);
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    resolveRecognitionFinish.current?.();
    const recorder = mediaRecorder.current;
    mediaRecorder.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      recorder.stop();
    }
    microphoneStream.current?.getTracks().forEach((track) => track.stop());
    microphoneStream.current = null;
    browserRecognition.current?.abort();
    browserRecognition.current = null;
    window.speechSynthesis?.cancel();
  }, []);

  function releaseMicrophone(reason = "unspecified") {
    micLog("releasing media stream", {
      reason,
      tracks: microphoneStream.current?.getTracks().map((track) => ({
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      })) ?? [],
    });
    microphoneStream.current?.getTracks().forEach((track) => track.stop());
    microphoneStream.current = null;
    microphoneStarting.current = false;
  }

  function resetAttempt() {
    setStatus("ready"); setSeconds(0); setTranscript(""); setScore(emptyScore); setError(""); setErrors({}); setTranscriptionStatus(""); setTranscriptSource("browser");
    browserFinalTranscript.current = "";
    browserLatestTranscript.current = "";
  }

  function nextPassage() {
    if (busy) return;
    setIndex((value) => (value + 1) % passages.length);
    resetAttempt();
  }

  function startBrowserRecognition() {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setBrowserHint(language === "hi" ? "लाइव पाठ उपलब्ध नहीं है। रिकॉर्डिंग से पाठ बनाया जाएगा।" : "Live text is unavailable. Your recording will still be transcribed.");
      return;
    }

    const recognition = new Recognition();
    browserRecognition.current = recognition;
    const prefix = browserFinalTranscript.current;
    let retryable = true;
    recognitionFinish.current = new Promise<void>((resolve) => { resolveRecognitionFinish.current = resolve; });
    const finish = resolveRecognitionFinish.current;
    recognition.lang = "hi-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      micLog("browser recognition listening");
      setBrowserHint(language === "hi" ? "लाइव पाठ सुन रहा है…" : "Listening for live text…");
    };
    recognition.onresult = (event) => {
      if (browserRecognition.current !== recognition) return;
      recognitionRetries.current = 0;
      let interim = "";
      let final = prefix;
      for (let item = 0; item < event.results.length; item += 1) {
        const result = event.results[item];
        const text = result[0]?.transcript?.trim() ?? "";
        if (result.isFinal && text) final = `${final} ${text}`.trim();
        else if (text) interim = `${interim} ${text}`.trim();
      }
      browserFinalTranscript.current = final;
      browserLatestTranscript.current = `${final} ${interim}`.trim();
      setTranscript(browserLatestTranscript.current);
    };
    recognition.onerror = (event) => {
      micLog("browser speech recognition error", { error: event.error });
      retryable = event.error === "no-speech" || event.error === "network";
      setBrowserHint(event.error === "no-speech" ? t.noSpeechHint : event.error === "network" ? t.networkError : t.serviceBlocked);
    };
    recognition.onend = () => {
      micLog("browser recognition ended", { retryable, retries: recognitionRetries.current });
      finish?.();
      if (browserRecognition.current !== recognition) return;
      browserRecognition.current = null;
      if (!stoppedAt.current && mediaRecorder.current?.state === "recording" && retryable && recognitionRetries.current < 3) {
        recognitionRetries.current += 1;
        recognitionRestart.current = setTimeout(() => {
          if (!stoppedAt.current && mediaRecorder.current?.state === "recording") startBrowserRecognition();
        }, 300);
      }
    };
    try { recognition.start(); }
    catch (caught) {
      finish?.(); browserRecognition.current = null;
      setBrowserHint(t.serviceBlocked);
      micLog("browser speech recognition unavailable", { error: String(caught) });
    }
  }

  async function transcribeWithSpeechmatics(blob: Blob) {
    const body = new FormData();
    const extension = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
    body.append("audio", blob, `reading.${extension}`);
    const response = await fetch("/api/transcribe", { method: "POST", body, signal: AbortSignal.timeout(55_000) });
    const payload = await response.json().catch(() => ({ error: "Transcription returned an invalid response." })) as { text?: string; error?: string; code?: string; detail?: string; requestId?: string };
    if (!response.ok || !payload.text) throw new Error(`${payload.error || "Transcription failed."} [${payload.code || response.status}${payload.detail ? ` : ${payload.detail}` : ""}${payload.requestId ? ` / ${payload.requestId}` : ""}]`);
    return payload.text.trim();
  }

  async function startRecording() {
    if (mediaRecorder.current || microphoneStarting.current) return;
    microphoneStarting.current = true;
    setError("");
    micLog("start requested", {
      mediaRecorderSupported: typeof MediaRecorder !== "undefined",
      mediaDevicesSupported: Boolean(navigator.mediaDevices?.getUserMedia),
      visibilityState: document.visibilityState,
      secureContext: window.isSecureContext,
    });
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      microphoneStarting.current = false;
      setStatus("unsupported");
      return;
    }

    try {
      micLog("requesting browser microphone permission");
      microphoneStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTracks = microphoneStream.current.getAudioTracks();
      micLog("media stream acquired", {
        active: microphoneStream.current.active,
        tracks: audioTracks.map((track) => ({ enabled: track.enabled, muted: track.muted, readyState: track.readyState })),
      });
      audioTracks.forEach((track) => {
        track.addEventListener("mute", () => micLog("media track muted", { readyState: track.readyState }));
        track.addEventListener("unmute", () => micLog("media track unmuted", { readyState: track.readyState }));
        track.addEventListener("ended", () => micLog("media track ended by browser/device", { readyState: track.readyState }));
      });
    } catch (caught) {
      const permissionError = caught instanceof DOMException ? { name: caught.name, message: caught.message } : { value: String(caught) };
      console.error("[Rajkamal Reader][mic] getUserMedia failed", permissionError);
      microphoneStarting.current = false;
      setStatus("ready");
      setError(t.recordingError);
      return;
    }

    window.speechSynthesis?.cancel();
    setSamplePlaying(false);
    audioChunks.current = [];
    stoppedAt.current = 0;
    startedAt.current = Date.now();
    attempts.current += 1;
    setTranscript("");
    setBrowserHint("");
    recognitionRetries.current = 0;
    recognitionFinish.current = Promise.resolve();
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    recordingUrlRef.current = "";
    setRecordingUrl("");
    browserFinalTranscript.current = "";
    browserLatestTranscript.current = "";
    setSeconds(0);
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      .find((candidate) => MediaRecorder.isTypeSupported(candidate));
    try {
      const recorder = new MediaRecorder(microphoneStream.current, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 32_000,
      });
      mediaRecorder.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunks.current.push(event.data);
      };
      recorder.onerror = (event) => {
        console.error("[Rajkamal Reader][mic] MediaRecorder error", event);
        setError(t.processingError);
      };
      recorder.onstop = async () => {
        mediaRecorder.current = null;
        await Promise.race([recognitionFinish.current, new Promise<void>((resolve) => setTimeout(resolve, 1500))]);
        if (browserRecognition.current) {
          browserRecognition.current.onresult = null;
          browserRecognition.current.abort();
          browserRecognition.current = null;
        }
        releaseMicrophone("recording completed");
        const duration = Math.max(1, Math.floor((stoppedAt.current - startedAt.current) / 1000));
        setSeconds(duration);
        try {
          const blob = new Blob(audioChunks.current, { type: recorder.mimeType || "audio/webm" });
          recordingUrlRef.current = URL.createObjectURL(blob);
          setRecordingUrl(recordingUrlRef.current);
          micLog("recording ready for Speechmatics transcription", { bytes: blob.size, mimeType: blob.type, duration });
          setTranscriptionStatus(language === "hi" ? "रिकॉर्डिंग का सुरक्षित ट्रांसक्रिप्शन हो रहा है…" : "Securely transcribing your recording…");
          const text = await transcribeWithSpeechmatics(blob);
          if (!text) throw new Error("No speech was recognized");
          setTranscript(text);
          setTranscriptSource("server");
          setScore(scoreReading(passage.reference_text, text, duration, attempts.current));
          setError("");
          setStatus("details");
        } catch (caught) {
          console.error("[Rajkamal Reader][mic] Speechmatics transcription failed", caught);
          const fallback = browserLatestTranscript.current.trim();
          if (fallback) {
            setTranscript(fallback);
            setTranscriptSource("browser");
            setScore(scoreReading(passage.reference_text, fallback, duration, attempts.current));
            setError(language === "hi" ? "सर्वर उपलब्ध नहीं था—यह browser का अनुमानित अभ्यास स्कोर है।" : "The server was unavailable—this is an unverified browser practice score.");
            setStatus("details");
          } else {
            setError(caught instanceof Error ? caught.message : t.processingError);
            setStatus("ready");
          }
        }
      };
      recorder.start(1000);
      startBrowserRecognition();
      micLog("MediaRecorder started", { mimeType: recorder.mimeType });
      microphoneStarting.current = false;
      setStatus("recording");
    } catch (caught) {
      console.error("[Rajkamal Reader][mic] MediaRecorder start failed", caught);
      mediaRecorder.current = null;
      releaseMicrophone("MediaRecorder start failed");
      setStatus("ready");
      setError(t.recordingError);
    }
  }

  function finishRecording() {
    const recorder = mediaRecorder.current;
    if (!recorder || recorder.state === "inactive" || stoppedAt.current) return;
    stoppedAt.current = Date.now();
    micLog("finish requested by reader");
    setStatus("transcribing");
    if (recognitionRestart.current) clearTimeout(recognitionRestart.current);
    try { browserRecognition.current?.stop(); }
    catch (caught) { micLog("browser recognition stop failed", { error: String(caught) }); }
    recorder.stop();
  }

  function listen() {
    const synth = window.speechSynthesis;
    if (!synth) { setError(t.voiceError); return; }
    if (listening.current || samplePlaying) {
      listeningToken.current += 1;
      listening.current = false;
      synth.cancel();
      setSamplePlaying(false);
      return;
    }
    const token = listeningToken.current + 1;
    listeningToken.current = token;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(passage.reference_text);
    utterance.lang = "hi-IN"; utterance.rate = 0.82; utterance.pitch = 1;
    utterance.voice = synth.getVoices().find((voice) => voice.lang.toLowerCase() === "hi-in")
      ?? synth.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("hi"))
      ?? null;
    const stop = () => {
      if (listeningToken.current !== token) return;
      listening.current = false;
      setSamplePlaying(false);
    };
    utterance.onstart = () => {
      if (listeningToken.current !== token) return;
      listening.current = true;
      setSamplePlaying(true);
    };
    utterance.onend = stop;
    utterance.onerror = () => {
      stop();
      if (listeningToken.current === token) setError(t.voiceError);
    };
    synth.speak(utterance);
    // Chrome occasionally leaves synthesis paused after cancelling a prior utterance.
    window.setTimeout(() => {
      if (listeningToken.current === token && synth.paused) synth.resume();
    }, 80);
    listening.current = true;
    setSamplePlaying(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Partial<Record<keyof Details, string>> = {};
    if (!details.name.trim()) next.name = t.missing;
    const age = Number(details.age);
    if (!Number.isInteger(age) || age < 5 || age > 120) next.age = t.ageError;
    if (details.phone.replace(/\D/g, "").length < 10) next.phone = t.phoneError;
    if (details.email && !/^\S+@\S+\.\S+$/.test(details.email)) next.email = t.emailError;
    if (!details.place.trim()) next.place = t.missing;
    if (!details.consent) next.consent = t.missing;
    setErrors(next);
    if (Object.keys(next).length) return;
    setIsSaving(true); setError("");
    try {
      await saveReaderAttempt({ details: { ...details, leaderboardOptIn: transcriptSource === "server" && details.leaderboardOptIn }, passage, transcript, durationSeconds: seconds, score, scoringSource: transcriptSource });
      setStatus("result");
    } catch {
      setError(language === "hi" ? "आपके विवरण save नहीं हो पाए। Supabase setup और internet connection जाँचें।" : "We could not save your result. Check the Supabase setup and internet connection.");
    } finally { setIsSaving(false); }
  }

  async function share() {
    const message = language === "hi" ? `मैंने “${passage.title}” पढ़ा और ${score.total}/100 स्कोर किया।` : `I read “${passage.title}” and scored ${score.total}/100.`;
    if (navigator.share) await navigator.share({ title: "Rajkamal Reader", text: message });
    else { await navigator.clipboard.writeText(message); setError(t.copied); }
  }

  function downloadScoreCard() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#9f1420";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#c91e2b";
    context.beginPath();
    context.arc(1080, 80, 250, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#e5b043";
    context.fillRect(70, 70, 86, 12);
    context.fillStyle = "#ffffff";
    context.font = "700 34px Arial";
    context.fillText(language === "hi" ? "राजकमल हिंदी रीडिंग स्कोर" : "Rajkamal Hindi Reading Score", 70, 140);
    context.font = "700 54px Arial";
    context.fillText(passage.title.slice(0, 30), 70, 235);
    context.font = "900 175px Arial";
    context.fillText(String(score.total), 70, 475);
    context.font = "700 34px Arial";
    context.fillText("/100", 285, 465);
    context.fillStyle = "#ffe8a7";
    context.font = "700 26px Arial";
    context.fillText(`${score.accuracy}% accuracy · ${score.wordsPerMinute} WPM`, 70, 555);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rajkamal-reading-score.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  const field = "mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 outline-none focus:border-[#b42332] focus:ring-2 focus:ring-[#b42332]/15";
  const statusTitle = recording ? t.recording : status === "transcribing" ? t.transcribing : t.ready;
  const statusHelp = recording ? t.recordingHelp : status === "transcribing" ? (transcriptionStatus || t.transcribingHelp) : t.help;

  return <main className="padhaku-shell min-h-screen pb-24">
    <header className="reader-topbar"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 lg:gap-4"><Image src="/rajkamal-emblem.svg" alt="Rajkamal" width={60} height={60} priority className="size-10 shrink-0 object-contain sm:size-12 lg:size-15" /><p className="reader-chant whitespace-nowrap text-sm font-bold text-[#7e1421] sm:text-lg lg:text-2xl" aria-label="साथ जुड़ें, साथ पढ़ें"><span>साथ </span><span className="flip-word"><span className="flip-word-sizer" aria-hidden="true">जुड़ें</span><span className="flip-word-sizer" aria-hidden="true">पढ़ें</span><span className="flip-word-item" aria-hidden="true">जुड़ें</span><span className="flip-word-item flip-word-delayed" aria-hidden="true">पढ़ें</span></span></p></div>
      <nav className="desktop-reader-nav" aria-label={language === "hi" ? "मुख्य नेविगेशन" : "Main navigation"}>{(["practice", "leaderboard", "progress"] as View[]).map((view) => <button key={view} className={activeView === view ? "active" : ""} onClick={() => setActiveView(view)}>{view === "practice" ? (language === "hi" ? "आज का पाठ" : "Today’s reading") : view === "leaderboard" ? (language === "hi" ? "लीडरबोर्ड" : "Leaderboard") : (language === "hi" ? "मेरी प्रगति" : "My progress")}</button>)}</nav>
      <button onClick={() => setLanguage(language === "hi" ? "en" : "hi")} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-[#7e1421] sm:gap-2 sm:px-4 sm:text-sm lg:px-5 lg:text-base"><Languages className="size-3.5 sm:size-4 lg:size-4.5" />{language === "hi" ? "English" : "हिंदी"}</button>
    </div></header>
    {activeView === "practice" ? <section className="padhaku-practice">
      <div className="padhaku-intro"><div><p className="padhaku-eyebrow">{language === "hi" ? "हिंदी रीडिंग स्कोर" : "HINDI READING SCORE"}</p><h1>{language === "hi" ? "पढ़िए, रिकॉर्ड कीजिए, स्कोर बढ़ाइए।" : "Read, record, improve your score."}</h1><p>{language === "hi" ? "आज का छोटा हिंदी पाठ अपनी आवाज़ में पढ़ें।" : "Read today’s short Hindi passage in your own voice."}</p></div><button onClick={nextPassage} disabled={busy} className="padhaku-new"><RotateCcw className="size-4" />{t.newPassage}</button></div>
      <div className="padhaku-grid">
        <article className="padhaku-card">
          <div className="padhaku-card-head"><div><span>{language === "hi" ? "पाठ" : "PASSAGE"} {passage.sequence} / {passages.length}</span><span className="padhaku-level">● {passage.difficulty_editorial}</span></div><i><b style={{ width: `${(passage.sequence / passages.length) * 100}%` }} /></i></div>
          <div className="padhaku-title-row"><div><p>{t.newPassage}</p><h2>{passage.title}</h2></div><button onClick={listen} disabled={busy} className={samplePlaying ? "speaking" : ""}><span><Volume2 className="size-4" /></span>{samplePlaying ? t.stopListen : t.listen}</button></div>
          <div className="padhaku-passage">{passage.lines.map((line) => <p key={line}>{line}</p>)}</div>
          <div className="padhaku-meta"><span>{passage.word_count_whitespace} {language === "hi" ? "शब्द" : "words"}</span><span>{language === "hi" ? "लगभग 1 मिनट" : "about 1 minute"}</span><span>हिंदी</span></div>
          <section className={`padhaku-record ${busy ? "active" : ""}`} aria-live="polite">
            <div className="padhaku-record-copy"><strong>{statusTitle}</strong><span>{statusHelp}</span></div>
            <div className="padhaku-record-actions"><span><Timer className="size-4" />{elapsed}</span>{recording ? <button onClick={finishRecording} className="recording"><Mic className="size-4" />{t.finish}</button> : <button onClick={startRecording} disabled={status === "transcribing"}><Play className="size-4 fill-current" />{t.start}</button>}</div>
            {recording && <div className="padhaku-wave">{Array.from({ length: 18 }).map((_, item) => <i key={item} className="audio-bar" style={{ height: `${20 + ((item * 23) % 65)}%` }} />)}</div>}
            {recording && <p className="padhaku-error" translate="no">{transcript || browserHint}</p>}
            {recordingUrl && !recording && <div className="col-span-full"><p>{language === "hi" ? "अपनी रिकॉर्डिंग सुनें" : "Listen to your recording"}</p><audio controls src={recordingUrl} className="w-full" /></div>}
            {error && <p className="padhaku-error"><Info className="size-4" />{error}</p>}
          </section>
        </article>
        <aside className="padhaku-side">
          <section className="padhaku-leader"><div className="padhaku-side-title"><div><p>{language === "hi" ? "इस हफ्ते" : "THIS WEEK"}</p><h2>{language === "hi" ? "लीडरबोर्ड" : "Leaderboard"}</h2></div><Info className="size-5" /></div><div className="padhaku-ranks">{topLeaders.length ? topLeaders.map((row, i) => <p key={`${i}-${row.reader_label}`}><span>{i + 1}</span><strong>{row.reader_label}</strong><b>{row.best_score}</b></p>) : <div className="padhaku-ranks-empty">{language === "hi" ? "अभी कोई सत्यापित स्कोर नहीं है।" : "No verified scores yet."}</div>}</div><button onClick={() => setActiveView("leaderboard")}>{language === "hi" ? "पूरी सूची देखें →" : "View full leaderboard →"}</button></section>
          <section className="padhaku-streak"><p>{language === "hi" ? "राजकमल रीडिंग रिवार्ड्स" : "RAJKAMAL READING REWARDS"}</p><div><h2>{language === "hi" ? "अपनी रीडिंग स्ट्रीक बनाएँ" : "Build your reading streak"}</h2><span>🔥</span></div><i><b /></i><p>{language === "hi" ? "हर दिन एक नया पाठ पढ़ें और अपनी प्रगति देखें।" : "Read a new passage every day and follow your progress."}</p><button onClick={() => setActiveView("progress")}>{language === "hi" ? "अपनी प्रगति देखें →" : "View your progress →"}</button></section>
          <ScoreGuide hindi={language === "hi"} />
        </aside>
      </div>
      {status === "unsupported" && <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">{t.unsupported}</div>}
      {status === "details" && <div className="reader-modal fixed inset-0 z-[70] flex items-end justify-center bg-stone-950/45 p-0 sm:items-center sm:p-6" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="score-unlock-title" className="reader-modal-card mt-5 flex max-h-[92dvh] w-full flex-col overflow-hidden border border-[#e5b043]/70 bg-[#fffaf0]">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#eadabb] px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
            <div className="min-w-0"><p className="text-xs font-bold tracking-[.16em] text-[#b42332]">{t.profileTag}</p><h2 id="score-unlock-title" className="serif mt-1 text-xl font-bold sm:text-2xl">{t.profileTitle}</h2></div>
            <button type="button" onClick={resetAttempt} aria-label={language === "hi" ? "बंद करें" : "Close"} className="-mr-2 -mt-2 grid size-10 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-900/5 hover:text-stone-800"><X className="size-5" /></button>
          </div>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-7">
              <p className="text-sm text-stone-600">{t.profileHelp}</p>
              <p className="mt-3 rounded-xl bg-white/80 px-4 py-3 text-sm leading-6 text-stone-700">{transcript}</p>
              {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-[#b42332]"><Info className="mr-1 inline size-4" />{error}</p>}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <FormField label={t.name} error={errors.name}><input autoFocus value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} autoComplete="name" className={field} /></FormField>
                <FormField label={t.age} error={errors.age}><input value={details.age} onChange={(event) => setDetails({ ...details, age: event.target.value })} type="number" min="5" max="120" className={field} /></FormField>
                <FormField label={t.phone} error={errors.phone}><input value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" className={field} /></FormField>
                <FormField label={t.email} error={errors.email}><input value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })} autoComplete="email" type="email" className={field} /></FormField>
                <div className="sm:col-span-2"><FormField label={t.place} error={errors.place}><input value={details.place} onChange={(event) => setDetails({ ...details, place: event.target.value })} autoComplete="address-level2" className={field} /></FormField></div>
                <label className="flex items-start gap-3 rounded-xl border border-[#eadabb] bg-white px-4 py-3 text-xs leading-5 text-stone-600 sm:col-span-2"><input checked={details.consent} onChange={(event) => setDetails({ ...details, consent: event.target.checked })} type="checkbox" className="mt-0.5 size-4 accent-[#b42332]" /><span>{t.consent}{errors.consent && <strong className="mt-1 block text-[#b42332]">{errors.consent}</strong>}</span></label>
                <label className="flex items-start gap-3 text-xs leading-5 text-stone-600 sm:col-span-2"><input type="checkbox" disabled={transcriptSource !== "server"} checked={transcriptSource === "server" && details.leaderboardOptIn} onChange={event => setDetails({ ...details, leaderboardOptIn: event.target.checked })} className="mt-0.5 size-4 accent-[#b42332] disabled:opacity-40" /><span>{transcriptSource !== "server" ? (language === "hi" ? "Browser के अनुमानित स्कोर को leaderboard में शामिल नहीं किया जा सकता।" : "Unverified browser scores cannot be added to the leaderboard.") : (language === "hi" ? "अपना सर्वश्रेष्ठ स्कोर सूची में दिखाएँ। आपका पहला नाम लीडरबोर्ड पर दिखेगा।" : "Show my best score on the leaderboard. My first name will be shown publicly.")}</span></label>
                <p className="text-xs leading-5 text-stone-500 sm:col-span-2"><Info className="mr-1 inline size-3.5" />{t.privacy}</p>
              </div>
            </div>
            <div className="shrink-0 border-t border-[#eadabb] px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:px-7">
              <button disabled={isSaving} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#b42332] px-5 py-3 text-sm font-bold text-white hover:bg-[#7e1421] disabled:cursor-wait disabled:opacity-60">{isSaving ? t.saving : t.view}</button>
            </div>
          </form>
        </section>
      </div>}
      {status === "result" && <section className="mt-5 rounded-xl border border-[#e5b043]/70 bg-[#fffaf0] p-5  sm:p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="flex items-center gap-2 text-xs font-bold tracking-[.16em] text-[#b42332]">{t.result}</p><h2 className="serif mt-2 text-3xl font-bold">{t.great}</h2></div><div className="rounded-2xl bg-[#b42332] px-6 py-4 text-center text-white"><p className="text-xs font-bold uppercase tracking-widest text-white/70">{t.score}</p><p className="serif text-4xl font-bold">{score.total}<span className="text-lg text-white/70">/100</span></p></div></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label={t.accuracy} value={`${score.accuracy}%`} /><Metric label={t.fluency} value={`${score.fluency}%`} /><Metric label={t.completion} value={`${score.completion}%`} /><Metric label={t.speed} value={`${score.wordsPerMinute} WPM`} /></div><div className="mt-6 flex flex-col gap-3 border-t border-[#eadabb] pt-5 sm:flex-row"><button onClick={resetAttempt} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#b42332] px-4 py-3 text-sm font-bold text-[#b42332]"><RotateCcw className="size-4" />{t.retry}</button><button onClick={downloadScoreCard} className="flex flex-1 items-center justify-center rounded-full border border-[#b42332] px-4 py-3 text-sm font-bold text-[#b42332]">{language === "hi" ? "स्कोर कार्ड डाउनलोड" : "Download score card"}</button><button onClick={share} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#b42332] px-4 py-3 text-sm font-bold text-white"><Share2 className="size-4" />{t.share}</button></div></section>}
    </section> : <ReaderDashboard view={activeView} hindi={language === "hi"} refresh={status} onPractice={() => setActiveView("practice")} />}
    {status !== "details" && <nav className="mobile-reader-nav" aria-label={language === "hi" ? "मोबाइल नेविगेशन" : "Mobile navigation"}>{(["practice", "leaderboard", "progress"] as View[]).map((view) => <button key={view} className={activeView === view ? "active" : ""} onClick={() => setActiveView(view)}>{view === "practice" ? (language === "hi" ? "पाठ" : "Read") : view === "leaderboard" ? (language === "hi" ? "सूची" : "Leaders") : (language === "hi" ? "प्रगति" : "Progress")}</button>)}</nav>}
  </main>;
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-stone-700">{label}{children}{error && <span className="mt-1 block text-xs font-medium text-[#b42332]">{error}</span>}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#eadabb] bg-white px-4 py-3"><p className="text-xs font-semibold text-stone-500">{label}</p><p className="mt-1 text-xl font-bold text-stone-800">{value}</p></div>;
}
