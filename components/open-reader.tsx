"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ScoreGuide, Leaderboard } from "@/components/reading-context";
import { BookOpen, Info, Languages, Mic, MicOff, Play, RotateCcw, Share2, Timer, Volume2 } from "lucide-react";
import { ReadingScore, scoreReading } from "@/lib/scoring";
import { saveReaderAttempt } from "@/lib/reader-storage";

type Language = "hi" | "en";
type Status = "ready" | "recording" | "transcribing" | "details" | "result" | "unsupported";
type Passage = { id: string; sequence: number; title: string; difficulty_editorial: string; lines: string[]; reference_text: string; word_count_whitespace: number };
type Details = { name: string; age: string; phone: string; email: string; place: string; consent: boolean; leaderboardOptIn: boolean };
type Props = { passages: Passage[] };

const copy = {
  hi: {
    title: "राजकमल रीडर", motto: "अपनी आवाज़ में साहित्य", newPassage: "नई रचना", listen: "पहले सुनें", stopListen: "सुनना रोकें",
    start: "रिकॉर्ड करना शुरू करें", finish: "रिकॉर्डिंग पूरी करें", ready: "तैयार होने पर शुरू करें", help: "पंक्तियाँ अपनी आवाज़ में पढ़ें",
    recording: "आपकी आवाज़ रिकॉर्ड हो रही है", recordingHelp: "आराम से और स्पष्ट पढ़ें", transcribing: "आपकी reading जाँची जा रही है…", transcribingHelp: "कुछ क्षण लग सकते हैं",
    profileTag: "स्कोर अनलॉक करें", profileTitle: "अपना विस्तृत स्कोर देखें", profileHelp: "अपनी accuracy, pace और passage coverage देखने के लिए ये विवरण भरें।",
    name: "पूरा नाम", age: "आयु", phone: "फ़ोन नंबर", email: "ईमेल (वैकल्पिक)", place: "शहर / स्थान",
    consent: "मैं सहमत हूँ कि राजकमल मेरे स्कोर के लिए ये विवरण इस्तेमाल कर सकता है।",
    privacy: "आपका browser आवाज़ को अपनी speech सेवा पर भेज सकता है। यह ऐप सहमति के बाद आपके विवरण, पहचाना गया पाठ और स्कोर सहेजता है।",
    view: "मेरा स्कोर देखें", saving: "सहेजा जा रहा है…", result: "आपका परिणाम", great: "आपका पाठ पूरा हुआ", score: "कुल स्कोर",
    accuracy: "शुद्धता", fluency: "प्रवाह", completion: "पूर्णता", speed: "गति", retry: "फिर पढ़ें", share: "परिणाम शेयर करें",
    unsupported: "इस browser में आवाज़ पहचान उपलब्ध नहीं है। इंटरनेट के साथ Chrome या Edge पर कोशिश करें।",
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
    privacy: "Your browser may send audio to its speech service. This app saves your details, recognized text and score after consent.",
    view: "View my score", saving: "Saving…", result: "YOUR RESULT", great: "Your reading is complete", score: "TOTAL SCORE",
    accuracy: "Accuracy", fluency: "Fluency", completion: "Completion", speed: "Speed", retry: "Read again", share: "Share result",
    unsupported: "Speech recognition is unavailable in this browser. Try Chrome or Edge with an internet connection.",
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
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>("ready");
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [score, setScore] = useState<ReadingScore>(emptyScore);
  const [error, setError] = useState("");
  const [samplePlaying, setSamplePlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [details, setDetails] = useState<Details>({ name: "", age: "", phone: "", email: "", place: "", consent: false, leaderboardOptIn: false });
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const recognition = useRef<SpeechRecognition | null>(null);
  const microphoneStream = useRef<MediaStream | null>(null);
  const microphoneStarting = useRef(false);
  const completedText = useRef("");
  const stoppedAt = useRef(0);
  const recognitionRestartCount = useRef(0);
  const recognitionRestartTimer = useRef<number | null>(null);
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

  useEffect(() => () => {
    micLog("component cleanup");
    if (recognitionRestartTimer.current) window.clearTimeout(recognitionRestartTimer.current);
    const active = recognition.current;
    recognition.current = null;
    if (active) {
      active.onresult = null;
      active.onerror = null;
      active.onend = null;
      active.abort();
    }
    microphoneStream.current?.getTracks().forEach((track) => track.stop());
    microphoneStream.current = null;
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
    setStatus("ready"); setSeconds(0); setTranscript(""); setScore(emptyScore); setError(""); setErrors({});
  }

  function nextPassage() {
    if (busy) return;
    setIndex((value) => (value + 1) % passages.length);
    resetAttempt();
  }

  function finishRecognition(active: SpeechRecognition) {
    if (recognition.current !== active) return;
    if (recognitionRestartTimer.current) window.clearTimeout(recognitionRestartTimer.current);
    recognitionRestartTimer.current = null;
    recognition.current = null;
    releaseMicrophone("recognition finished");
    const duration = Math.max(1, Math.floor(((stoppedAt.current || Date.now()) - startedAt.current) / 1000));
    setSeconds(duration);
    if (!completedText.current) {
      setError(language === "hi" ? "कोई आवाज़ पहचानी नहीं गई। फिर पढ़ें।" : "No speech was recognized. Please read again.");
      setStatus("ready");
      return;
    }
    setTranscript(completedText.current);
    setScore(scoreReading(passage.reference_text, completedText.current, duration, attempts.current));
    setStatus("details");
  }

  async function startRecording() {
    if (recognition.current || microphoneStarting.current) return;
    microphoneStarting.current = true;
    setError("");
    const API = window.SpeechRecognition || window.webkitSpeechRecognition;
    micLog("start requested", {
      recognitionSupported: Boolean(API),
      mediaDevicesSupported: Boolean(navigator.mediaDevices?.getUserMedia),
      visibilityState: document.visibilityState,
      secureContext: window.isSecureContext,
    });
    if (!API) { microphoneStarting.current = false; setStatus("unsupported"); return; }

    try {
      // Keep one media stream open for the full attempt. Chromium may end and
      // restart SpeechRecognition sessions during pauses, but the mic itself
      // should remain active until the reader presses Finish.
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

    // The component or another start attempt may have taken ownership while
    // the permission prompt was open.
    if (recognition.current) {
      releaseMicrophone("duplicate start request");
      return;
    }

    window.speechSynthesis?.cancel();
    setSamplePlaying(false);
    const active = new API();
    recognition.current = active;
    completedText.current = "";
    stoppedAt.current = 0;
    recognitionRestartCount.current = 0;
    startedAt.current = Date.now();
    attempts.current += 1;
    setTranscript("");
    setSeconds(0);
    active.lang = "hi-IN";
    active.continuous = true;
    active.interimResults = true;
    let failed = false;
    let sessionFinal = "";

    const commitSession = () => {
      if (!sessionFinal) return;
      completedText.current = `${completedText.current} ${sessionFinal}`.trim();
      sessionFinal = "";
    };

    active.onstart = () => micLog("speech recognition started", { restart: recognitionRestartCount.current });
    active.onaudiostart = () => micLog("speech recognition audio capture started");
    active.onaudioend = () => micLog("speech recognition audio capture ended");
    active.onsoundstart = () => micLog("sound detected");
    active.onsoundend = () => micLog("sound detection ended");
    active.onspeechstart = () => micLog("speech detected");
    active.onspeechend = () => micLog("speech detection ended");

    active.onresult = (event) => {
      if (recognition.current !== active) return;
      recognitionRestartCount.current = 0;
      setError("");
      let final = "";
      let interim = "";
      // Rebuild from the session results, so repeated events cannot duplicate words.
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript + " ";
        else interim += result[0].transcript + " ";
      }
      sessionFinal = final.trim();
      micLog("recognition result", { finalCharacters: final.trim().length, interimCharacters: interim.trim().length });
      setTranscript(`${completedText.current} ${sessionFinal} ${interim}`.trim());
    };
    active.onerror = (event) => {
      if (recognition.current !== active) return;
      const code = event.error;
      console.error("[Rajkamal Reader][mic] speech recognition error", {
        at: new Date().toISOString(),
        code,
        stoppedByUser: Boolean(stoppedAt.current),
        restart: recognitionRestartCount.current,
      });
      // Recoverable codes. Chrome can report "network" when its remote speech
      // service briefly disconnects even though the local microphone is fine.
      // Keep the media stream alive and let onend retry with a backoff.
      if (code === "no-speech") { setError(t.noSpeechHint); return; }
      if (code === "network") { setError(t.networkError); return; }
      if (code === "aborted") return;

      failed = true;
      if (recognitionRestartTimer.current) window.clearTimeout(recognitionRestartTimer.current);
      recognitionRestartTimer.current = null;
      setError(
        code === "not-allowed" ? t.recordingError
          : code === "service-not-allowed" ? t.serviceBlocked
            : code === "audio-capture" ? t.noMicFound
              : code === "language-not-supported" ? t.langUnsupported
                : t.processingError);
      recognition.current = null;
      active.abort();
      releaseMicrophone(`fatal recognition error: ${code}`);
      setStatus("ready");
    };
    active.onend = () => {
      micLog("speech recognition ended", {
        failed,
        stoppedByUser: Boolean(stoppedAt.current),
        restart: recognitionRestartCount.current,
        streamActive: microphoneStream.current?.active ?? false,
      });
      if (recognition.current !== active) return;
      if (failed) return;
      if (stoppedAt.current) {
        commitSession();
        finishRecognition(active);
        return;
      }
      commitSession();
      // Chrome may end a recognition session after a short silence even with
      // continuous mode. Keep recovering until the reader explicitly finishes.
      recognitionRestartCount.current += 1;
      recognitionRestartTimer.current = window.setTimeout(() => {
        if (recognition.current !== active || stoppedAt.current) return;
        micLog("restarting speech recognition", { restart: recognitionRestartCount.current });
        try { active.start(); } catch (caught) {
          console.error("[Rajkamal Reader][mic] recognition restart threw", caught);
          finishRecognition(active);
        }
      }, Math.min(250 * (2 ** (recognitionRestartCount.current - 1)), 5000));
    };
    try {
      active.start();
      micLog("speech recognition start invoked");
      microphoneStarting.current = false;
      setStatus("recording");
    } catch (caught) {
      console.error("[Rajkamal Reader][mic] recognition start threw", caught);
      recognition.current = null;
      active.abort();
      releaseMicrophone("recognition start threw");
      setStatus("ready");
      setError(t.recordingError);
    }
  }

  function finishRecording() {
    const active = recognition.current;
    if (!active || stoppedAt.current) return;
    stoppedAt.current = Date.now();
    micLog("finish requested by reader");
    setStatus("transcribing");
    // Wait for the final result and end event before scoring.
    try { active.stop(); } catch { finishRecognition(active); }
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
      await saveReaderAttempt({ details, passage, transcript, durationSeconds: seconds, score, scoringSource: "browser" });
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

  const field = "mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 outline-none focus:border-[#b42332] focus:ring-2 focus:ring-[#b42332]/15";
  const statusTitle = recording ? t.recording : status === "transcribing" ? t.transcribing : t.ready;
  const statusHelp = recording ? t.recordingHelp : status === "transcribing" ? t.transcribingHelp : t.help;

  return <main className="paper-grain min-h-screen pb-12">
    <header className="border-b border-stone-200 bg-[#fffcf7]/90 px-4 py-3 backdrop-blur sm:px-8 sm:py-4 lg:py-5"><div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 lg:gap-4"><Image src="/rajkamal-emblem.svg" alt="Rajkamal" width={60} height={60} priority className="size-10 shrink-0 object-contain sm:size-12 lg:size-15" /><p className="reader-chant whitespace-nowrap text-sm font-bold text-[#7e1421] sm:text-lg lg:text-2xl" aria-label="साथ जुड़ें, साथ पढ़ें"><span>साथ </span><span className="flip-word"><span className="flip-word-sizer" aria-hidden="true">जुड़ें</span><span className="flip-word-sizer" aria-hidden="true">पढ़ें</span><span className="flip-word-item" aria-hidden="true">जुड़ें</span><span className="flip-word-item flip-word-delayed" aria-hidden="true">पढ़ें</span></span></p></div>
      <button onClick={() => setLanguage(language === "hi" ? "en" : "hi")} className="flex shrink-0 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-[#7e1421] sm:gap-2 sm:px-4 sm:text-sm lg:px-5 lg:text-base"><Languages className="size-3.5 sm:size-4 lg:size-4.5" />{language === "hi" ? "English" : "हिंदी"}</button>
    </div></header>
    <section className="mx-auto max-w-4xl px-4 pt-7 sm:px-8 sm:pt-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-[.18em] text-[#b42332]">{language === "hi" ? "आज का अभ्यास" : "TODAY'S PRACTICE"}</p><h1 className="serif mt-1 text-xl font-bold sm:text-3xl">{t.motto}</h1></div><button onClick={nextPassage} disabled={busy} className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold hover:border-[#b42332] hover:text-[#b42332] disabled:opacity-40"><RotateCcw className="size-4" />{t.newPassage}</button></div>
      <article className="overflow-hidden rounded-xl border border-stone-200 bg-[#fffdf9] ">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 bg-[#fff7ec] px-5 py-4 sm:px-8"><div><div className="mb-2 flex gap-2"><span className="rounded-full bg-[#b42332] px-2.5 py-1 text-[10px] font-bold text-white">{language === "hi" ? "पाठ" : "PASSAGE"} {passage.sequence}/100</span><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-stone-600">{passage.difficulty_editorial}</span></div><h2 className="serif text-xl font-bold sm:text-2xl">{passage.title}</h2></div><button onClick={listen} disabled={busy} className="flex items-center gap-2 rounded-full px-2 py-2 text-xs font-bold text-[#7e1421] disabled:opacity-40"><Volume2 className={`size-4 ${samplePlaying ? "animate-pulse text-[#b42332]" : ""}`} />{samplePlaying ? t.stopListen : t.listen}</button></div>
        <div className="px-4 py-5 sm:px-8 sm:py-7"><div className="serif border-l-2 border-[#e5b043] pl-3 text-[1.1rem] leading-[1.9] text-stone-800 sm:text-[1.48rem] sm:leading-[2.2]">{passage.lines.map((line) => <p key={line}>{line}</p>)}</div><p className="mt-7 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-5 text-xs text-stone-500"><BookOpen className="size-4 text-[#b42332]" />Hindi reading passage · {passage.word_count_whitespace} {language === "hi" ? "शब्द" : "words"}</p></div>
      </article>
      <section className={`mt-5 rounded-xl border p-5 sm:p-6 ${busy ? "border-[#b42332]/40 bg-[#7e1421] text-white" : "border-stone-200 bg-white"}`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><div className={`grid size-14 place-items-center rounded-full ${busy ? "bg-white/15" : "bg-[#fdf0ef] text-[#b42332]"}`}>{recording ? <Mic className="size-6" /> : <MicOff className="size-6" />}</div><div><p className={`text-sm font-bold ${busy ? "text-[#ffe8a7]" : "text-[#b42332]"}`}>{statusTitle}</p><p className={`mt-1 text-xs ${busy ? "text-white/70" : "text-stone-500"}`}>{statusHelp}</p></div></div><div className="flex items-center justify-between gap-4 sm:justify-end"><span className="flex items-center gap-2 font-mono text-xl font-bold"><Timer className="size-4" />{elapsed}</span>{recording ? <button onClick={finishRecording} className="rounded-full bg-[#e5b043] px-5 py-3 text-sm font-bold text-[#352311]">{t.finish}</button> : <button onClick={startRecording} disabled={status === "transcribing"} className="flex items-center gap-2 rounded-full bg-[#b42332] px-5 py-3 text-sm font-bold text-white hover:bg-[#7e1421] disabled:cursor-wait disabled:opacity-60"><Play className="size-4 fill-current" />{t.start}</button>}</div></div>
        {recording && transcript && <p className="mt-4 text-sm" translate="no">{transcript}</p>}
        {recording && <div className="mt-5 flex h-9 items-center justify-center gap-1.5">{Array.from({ length: 22 }).map((_, item) => <span key={item} className="audio-bar w-1 rounded-full bg-[#e5b043]" style={{ height: `${20 + ((item * 23) % 65)}%` }} />)}</div>}
        {error && <p className={`mt-4 flex items-center gap-2 text-xs font-medium ${busy ? "text-[#ffe8a7]" : "text-[#b42332]"}`}><Info className="size-4" />{error}</p>}
      </section>
      <ScoreGuide hindi={language === "hi"} />
      {status === "unsupported" && <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">{t.unsupported}</div>}
      {status === "details" && <div className="reader-modal fixed inset-0 z-50 flex items-end bg-stone-950/45 p-0 sm:items-center sm:justify-center sm:p-6" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="score-unlock-title" className="reader-modal-card mt-5 max-h-[92dvh] w-full overflow-y-auto rounded-xl border border-[#e5b043]/70 bg-[#fffaf0] p-5 sm:p-7"><p className="text-xs font-bold tracking-[.16em] text-[#b42332]">{t.profileTag}</p><h2 id="score-unlock-title" className="serif mt-1 text-2xl font-bold">{t.profileTitle}</h2><p className="mt-2 text-sm text-stone-600">{t.profileHelp}</p><p className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-sm leading-6 text-stone-700">{transcript}</p>{error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-[#b42332]"><Info className="mr-1 inline size-4" />{error}</p>}<form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2"><FormField label={t.name} error={errors.name}><input autoFocus value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} autoComplete="name" className={field} /></FormField><FormField label={t.age} error={errors.age}><input value={details.age} onChange={(event) => setDetails({ ...details, age: event.target.value })} type="number" min="5" max="120" className={field} /></FormField><FormField label={t.phone} error={errors.phone}><input value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" className={field} /></FormField><FormField label={t.email} error={errors.email}><input value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })} autoComplete="email" type="email" className={field} /></FormField><div className="sm:col-span-2"><FormField label={t.place} error={errors.place}><input value={details.place} onChange={(event) => setDetails({ ...details, place: event.target.value })} autoComplete="address-level2" className={field} /></FormField></div><label className="flex items-start gap-3 rounded-xl border border-[#eadabb] bg-white px-4 py-3 text-xs leading-5 text-stone-600 sm:col-span-2"><input checked={details.consent} onChange={(event) => setDetails({ ...details, consent: event.target.checked })} type="checkbox" className="mt-0.5 size-4 accent-[#b42332]" /><span>{t.consent}{errors.consent && <strong className="mt-1 block text-[#b42332]">{errors.consent}</strong>}</span></label><label className="flex items-start gap-3 text-xs leading-5 text-stone-600 sm:col-span-2"><input type="checkbox" checked={details.leaderboardOptIn} onChange={event => setDetails({ ...details, leaderboardOptIn: event.target.checked })} className="mt-0.5 size-4 accent-[#b42332]" /><span>{language === "hi" ? "अपना सर्वश्रेष्ठ स्कोर सूची में दिखाएँ। केवल एक अनाम Reader पहचान दिखेगी। बाद में इस विकल्प को हटाकर परिणाम सहेजने पर सूची से हट सकते हैं।" : "Show my best score on the leaderboard under an anonymous Reader label. To leave, uncheck this and save another result."}</span></label><p className="text-xs leading-5 text-stone-500 sm:col-span-2"><Info className="mr-1 inline size-3.5" />{t.privacy}</p><button disabled={isSaving} className="flex items-center justify-center gap-2 rounded-full bg-[#b42332] px-5 py-3 text-sm font-bold text-white hover:bg-[#7e1421] disabled:cursor-wait disabled:opacity-60 sm:col-span-2">{isSaving ? t.saving : t.view}</button></form></section></div>}
      {status === "result" && <section className="mt-5 rounded-xl border border-[#e5b043]/70 bg-[#fffaf0] p-5  sm:p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="flex items-center gap-2 text-xs font-bold tracking-[.16em] text-[#b42332]">{t.result}</p><h2 className="serif mt-2 text-3xl font-bold">{t.great}</h2></div><div className="rounded-2xl bg-[#b42332] px-6 py-4 text-center text-white"><p className="text-xs font-bold uppercase tracking-widest text-white/70">{t.score}</p><p className="serif text-4xl font-bold">{score.total}<span className="text-lg text-white/70">/100</span></p></div></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label={t.accuracy} value={`${score.accuracy}%`} /><Metric label={t.fluency} value={`${score.fluency}%`} /><Metric label={t.completion} value={`${score.completion}%`} /><Metric label={t.speed} value={`${score.wordsPerMinute} WPM`} /></div><div className="mt-6 flex flex-col gap-3 border-t border-[#eadabb] pt-5 sm:flex-row"><button onClick={resetAttempt} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#b42332] px-4 py-3 text-sm font-bold text-[#b42332]"><RotateCcw className="size-4" />{t.retry}</button><button onClick={share} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#b42332] px-4 py-3 text-sm font-bold text-white"><Share2 className="size-4" />{t.share}</button></div></section>}
      <Leaderboard hindi={language === "hi"} refresh={status} />
    </section>
  </main>;
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-stone-700">{label}{children}{error && <span className="mt-1 block text-xs font-medium text-[#b42332]">{error}</span>}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#eadabb] bg-white px-4 py-3"><p className="text-xs font-semibold text-stone-500">{label}</p><p className="mt-1 text-xl font-bold text-stone-800">{value}</p></div>;
}
