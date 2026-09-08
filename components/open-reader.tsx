"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BookOpen, Info, Languages, Mic, MicOff, Play, RotateCcw, Share2, Sparkles, Timer, Volume2 } from "lucide-react";
import { ReadingScore, scoreReading } from "@/lib/scoring";
import { saveReaderAttempt } from "@/lib/reader-storage";

type Language = "hi" | "en";
type Status = "ready" | "recording" | "transcribing" | "details" | "result" | "unsupported";
type Passage = { id: string; sequence: number; title: string; difficulty_editorial: string; lines: string[]; reference_text: string; word_count_whitespace: number };
type Details = { name: string; age: string; phone: string; email: string; place: string; consent: boolean };
type Props = { passages: Passage[] };

const copy = {
  hi: {
    title: "राजकमल रीडर", motto: "अपनी आवाज़ में साहित्य", newPassage: "नई रचना", listen: "पहले सुनें", stopListen: "सुनना रोकें",
    start: "रिकॉर्ड करना शुरू करें", finish: "रिकॉर्डिंग पूरी करें", ready: "तैयार होने पर शुरू करें", help: "पंक्तियाँ अपनी आवाज़ में पढ़ें",
    recording: "आपकी आवाज़ रिकॉर्ड हो रही है", recordingHelp: "आराम से और स्पष्ट पढ़ें", transcribing: "आपकी reading जाँची जा रही है…", transcribingHelp: "कुछ क्षण लग सकते हैं",
    profileTag: "स्कोर देखने से पहले", profileTitle: "अपनी जानकारी भरें", profileHelp: "अपना परिणाम देखने के लिए ये छोटे विवरण भरें।",
    name: "पूरा नाम", age: "आयु", phone: "फ़ोन नंबर", email: "ईमेल (वैकल्पिक)", place: "शहर / स्थान",
    consent: "मैं सहमत हूँ कि राजकमल मेरे स्कोर के लिए ये विवरण इस्तेमाल कर सकता है।",
    privacy: "आपका browser आवाज़ को अपनी speech सेवा पर भेज सकता है। यह ऐप सहमति के बाद आपके विवरण, पहचाना गया पाठ और स्कोर सहेजता है।",
    view: "मेरा स्कोर देखें", saving: "सहेजा जा रहा है…", result: "आपका परिणाम", great: "बहुत सुंदर पाठ!", score: "कुल स्कोर",
    accuracy: "शुद्धता", fluency: "प्रवाह", completion: "पूर्णता", speed: "गति", retry: "फिर पढ़ें", share: "परिणाम शेयर करें",
    unsupported: "इस browser में आवाज़ पहचान उपलब्ध नहीं है। इंटरनेट के साथ Chrome या Edge पर कोशिश करें।",
    recordingError: "माइक्रोफ़ोन की अनुमति दें और फिर कोशिश करें।", processingError: "रिकॉर्डिंग को पढ़ा नहीं जा सका। फिर से कोशिश करें।",
    voiceError: "Hindi आवाज़ उपलब्ध नहीं है। अपनी device voice settings जाँचें।", missing: "यह जानकारी भरें।",
    ageError: "5 से 120 के बीच आयु भरें।", phoneError: "मान्य फ़ोन नंबर भरें।", emailError: "मान्य ईमेल भरें।", copied: "परिणाम कॉपी हो गया है।",
  },
  en: {
    title: "Rajkamal Reader", motto: "Literature in your voice", newPassage: "New passage", listen: "Listen first", stopListen: "Stop listening",
    start: "Start recording", finish: "Finish recording", ready: "Ready when you are", help: "Read the passage aloud in your own voice",
    recording: "Your voice is being recorded", recordingHelp: "Read slowly and clearly", transcribing: "Checking your reading…", transcribingHelp: "This may take a few moments",
    profileTag: "BEFORE YOU VIEW YOUR SCORE", profileTitle: "Tell us about yourself", profileHelp: "Complete these short details to view your result.",
    name: "Full name", age: "Age", phone: "Phone number", email: "Email (optional)", place: "City / place",
    consent: "I agree that Rajkamal may use these details for my score.",
    privacy: "Your browser may send audio to its speech service. This app saves your details, recognized text and score after consent.",
    view: "View my score", saving: "Saving…", result: "YOUR RESULT", great: "A beautiful reading!", score: "TOTAL SCORE",
    accuracy: "Accuracy", fluency: "Fluency", completion: "Completion", speed: "Speed", retry: "Read again", share: "Share result",
    unsupported: "Speech recognition is unavailable in this browser. Try Chrome or Edge with an internet connection.",
    recordingError: "Allow microphone access and try again.", processingError: "We could not process this recording. Please try again.",
    voiceError: "A Hindi voice is unavailable. Check your device voice settings.", missing: "Complete this field.",
    ageError: "Enter an age from 5 to 120.", phoneError: "Enter a valid phone number.", emailError: "Enter a valid email.", copied: "Your result is copied and ready to share.",
  },
} as const;

const emptyScore: ReadingScore = { total: 0, accuracy: 0, fluency: 0, completion: 0, consistency: 0, wordsRead: 0, expectedWords: 0, wordsPerMinute: 0, xp: 0 };

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
  const [details, setDetails] = useState<Details>({ name: "", age: "", phone: "", email: "", place: "", consent: false });
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const recognition = useRef<SpeechRecognition | null>(null);
  const completedText = useRef("");
  const stoppedAt = useRef(0);
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
    const active = recognition.current;
    recognition.current = null;
    if (active) {
      active.onresult = null;
      active.onerror = null;
      active.onend = null;
      active.abort();
    }
    window.speechSynthesis?.cancel();
  }, []);

  function resetAttempt() {
    setStatus("ready"); setSeconds(0); setTranscript(""); setScore(emptyScore); setError(""); setErrors({});
  }

  function nextPassage() {
    if (busy) return;
    setIndex((value) => (value + 1) % passages.length);
    resetAttempt();
  }

  function startRecording() {
    if (recognition.current) return;
    setError("");
    const API = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!API) { setStatus("unsupported"); return; }

    window.speechSynthesis?.cancel();
    setSamplePlaying(false);
    const active = new API();
    recognition.current = active;
    completedText.current = "";
    stoppedAt.current = 0;
    startedAt.current = Date.now();
    attempts.current += 1;
    setTranscript("");
    setSeconds(0);
    active.lang = "hi-IN";
    active.continuous = true;
    active.interimResults = true;
    let failed = false;

    active.onresult = (event) => {
      if (recognition.current !== active) return;
      let final = "";
      let interim = "";
      // Rebuild from the session results, so repeated events cannot duplicate words.
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript + " ";
        else interim += result[0].transcript + " ";
      }
      completedText.current = final.trim();
      setTranscript((final + interim).trim());
    };
    active.onerror = (event) => {
      if (recognition.current !== active) return;
      failed = true;
      setError(event.error === "not-allowed" || event.error === "audio-capture"
        ? t.recordingError
        : language === "hi"
          ? "आवाज़ पहचानी नहीं जा सकी। इंटरनेट जाँचें और फिर कोशिश करें।"
          : "Speech recognition failed. Check your internet connection and try again.");
      recognition.current = null;
      active.abort();
      setStatus("ready");
    };
    active.onend = () => {
      if (recognition.current !== active) return;
      recognition.current = null;
      if (failed) return;
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
    };
    try {
      active.start();
      setStatus("recording");
    } catch {
      recognition.current = null;
      active.abort();
      setStatus("ready");
      setError(t.recordingError);
    }
  }

  function finishRecording() {
    const active = recognition.current;
    if (!active || stoppedAt.current) return;
    stoppedAt.current = Date.now();
    setStatus("transcribing");
    // Wait for the final result and end event before scoring.
    active.stop();
  }

  function listen() {
    const synth = window.speechSynthesis;
    if (!synth) { setError(t.voiceError); return; }
    if (samplePlaying) { synth.cancel(); setSamplePlaying(false); return; }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(passage.reference_text);
    utterance.lang = "hi-IN"; utterance.rate = 0.8;
    utterance.onend = () => setSamplePlaying(false);
    utterance.onerror = () => { setSamplePlaying(false); setError(t.voiceError); };
    synth.speak(utterance); setSamplePlaying(true);
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
    <header className="border-b border-stone-200 bg-[#fffcf7]/90 px-4 py-3 backdrop-blur sm:px-8"><div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Image src="/rajkamal_logo.svg" alt="Rajkamal Prakashan" width={131} height={40} priority className="h-8 w-auto max-w-32 object-contain sm:h-10 sm:max-w-44" /><div className="hidden border-l border-stone-300 pl-3 sm:block"><p className="serif text-sm font-bold">{t.title}</p><p className="text-[10px] font-bold tracking-[.14em] text-[#b42332]">{t.motto}</p></div></div>
      <button onClick={() => setLanguage(language === "hi" ? "en" : "hi")} className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-[#7e1421]"><Languages className="size-3.5" />{language === "hi" ? "English" : "हिंदी"}</button>
    </div></header>
    <section className="mx-auto max-w-4xl px-4 pt-7 sm:px-8 sm:pt-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-[.18em] text-[#b42332]">{language === "hi" ? "आज का अभ्यास" : "TODAY'S PRACTICE"}</p><h1 className="serif mt-1 text-2xl font-bold sm:text-3xl">{t.motto}</h1></div><button onClick={nextPassage} disabled={busy} className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold hover:border-[#b42332] hover:text-[#b42332] disabled:opacity-40"><RotateCcw className="size-4" />{t.newPassage}</button></div>
      <article className="overflow-hidden rounded-[1.6rem] border border-stone-200 bg-[#fffdf9] shadow-[0_16px_45px_rgba(72,44,26,.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 bg-[#fff7ec] px-5 py-4 sm:px-8"><div><div className="mb-2 flex gap-2"><span className="rounded-full bg-[#b42332] px-2.5 py-1 text-[10px] font-bold text-white">{language === "hi" ? "पाठ" : "PASSAGE"} {passage.sequence}/100</span><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-stone-600">{passage.difficulty_editorial}</span></div><h2 className="serif text-xl font-bold sm:text-2xl">{passage.title}</h2></div><button onClick={listen} disabled={busy} className="flex items-center gap-2 rounded-full px-2 py-2 text-xs font-bold text-[#7e1421] disabled:opacity-40"><Volume2 className={`size-4 ${samplePlaying ? "animate-pulse text-[#b42332]" : ""}`} />{samplePlaying ? t.stopListen : t.listen}</button></div>
        <div className="px-5 py-7 sm:px-8 sm:py-9"><div className="serif border-l-2 border-[#e5b043] pl-5 text-[1.3rem] leading-[2.1] text-stone-800 sm:text-[1.48rem] sm:leading-[2.2]">{passage.lines.map((line) => <p key={line}>{line}</p>)}</div><p className="mt-7 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-5 text-xs text-stone-500"><BookOpen className="size-4 text-[#b42332]" />Hindi reading passage · {passage.word_count_whitespace} {language === "hi" ? "शब्द" : "words"}</p></div>
      </article>
      <section className={`mt-5 rounded-[1.6rem] border p-5 sm:p-6 ${busy ? "border-[#b42332]/40 bg-[#7e1421] text-white" : "border-stone-200 bg-white"}`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><div className={`grid size-14 place-items-center rounded-full ${busy ? "bg-white/15" : "bg-[#fdf0ef] text-[#b42332]"}`}>{recording ? <Mic className="size-6" /> : <MicOff className="size-6" />}</div><div><p className={`text-sm font-bold ${busy ? "text-[#ffe8a7]" : "text-[#b42332]"}`}>{statusTitle}</p><p className={`mt-1 text-xs ${busy ? "text-white/70" : "text-stone-500"}`}>{statusHelp}</p></div></div><div className="flex items-center justify-between gap-4 sm:justify-end"><span className="flex items-center gap-2 font-mono text-xl font-bold"><Timer className="size-4" />{elapsed}</span>{recording ? <button onClick={finishRecording} className="rounded-full bg-[#e5b043] px-5 py-3 text-sm font-bold text-[#352311]">{t.finish}</button> : <button onClick={startRecording} disabled={status === "transcribing"} className="flex items-center gap-2 rounded-full bg-[#b42332] px-5 py-3 text-sm font-bold text-white hover:bg-[#7e1421] disabled:cursor-wait disabled:opacity-60"><Play className="size-4 fill-current" />{t.start}</button>}</div></div>
        {recording && transcript && <p className="mt-4 text-sm" translate="no">{transcript}</p>}
        {recording && <div className="mt-5 flex h-9 items-center justify-center gap-1.5">{Array.from({ length: 22 }).map((_, item) => <span key={item} className="audio-bar w-1 rounded-full bg-[#e5b043]" style={{ height: `${20 + ((item * 23) % 65)}%` }} />)}</div>}
        {error && <p className={`mt-4 flex items-center gap-2 text-xs font-medium ${busy ? "text-[#ffe8a7]" : "text-[#b42332]"}`}><Info className="size-4" />{error}</p>}
      </section>
      {status === "unsupported" && <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">{t.unsupported}</div>}
      {status === "details" && <section className="mt-5 rounded-[1.6rem] border border-[#e5b043]/70 bg-[#fffaf0] p-5 shadow-sm sm:p-7"><p className="text-xs font-bold tracking-[.16em] text-[#b42332]">{t.profileTag}</p><h2 className="serif mt-1 text-2xl font-bold">{t.profileTitle}</h2><p className="mt-2 text-sm text-stone-600">{t.profileHelp}</p><p className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-sm leading-6 text-stone-700">{transcript}</p><form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2"><FormField label={t.name} error={errors.name}><input value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} autoComplete="name" className={field} /></FormField><FormField label={t.age} error={errors.age}><input value={details.age} onChange={(event) => setDetails({ ...details, age: event.target.value })} type="number" min="5" max="120" className={field} /></FormField><FormField label={t.phone} error={errors.phone}><input value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" className={field} /></FormField><FormField label={t.email} error={errors.email}><input value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })} autoComplete="email" type="email" className={field} /></FormField><div className="sm:col-span-2"><FormField label={t.place} error={errors.place}><input value={details.place} onChange={(event) => setDetails({ ...details, place: event.target.value })} autoComplete="address-level2" className={field} /></FormField></div><label className="flex items-start gap-3 rounded-xl border border-[#eadabb] bg-white px-4 py-3 text-xs leading-5 text-stone-600 sm:col-span-2"><input checked={details.consent} onChange={(event) => setDetails({ ...details, consent: event.target.checked })} type="checkbox" className="mt-0.5 size-4 accent-[#b42332]" /><span>{t.consent}{errors.consent && <strong className="mt-1 block text-[#b42332]">{errors.consent}</strong>}</span></label><p className="text-xs leading-5 text-stone-500 sm:col-span-2"><Info className="mr-1 inline size-3.5" />{t.privacy}</p><button disabled={isSaving} className="flex items-center justify-center gap-2 rounded-full bg-[#b42332] px-5 py-3 text-sm font-bold text-white hover:bg-[#7e1421] disabled:cursor-wait disabled:opacity-60 sm:col-span-2"><Sparkles className="size-4" />{isSaving ? t.saving : t.view}</button></form></section>}
      {status === "result" && <section className="mt-5 rounded-[1.6rem] border border-[#e5b043]/70 bg-[#fffaf0] p-5 shadow-sm sm:p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="flex items-center gap-2 text-xs font-bold tracking-[.16em] text-[#b42332]"><Sparkles className="size-4" />{t.result}</p><h2 className="serif mt-2 text-3xl font-bold">{t.great}</h2></div><div className="rounded-2xl bg-[#b42332] px-6 py-4 text-center text-white"><p className="text-xs font-bold uppercase tracking-widest text-white/70">{t.score}</p><p className="serif text-4xl font-bold">{score.total}<span className="text-lg text-white/70">/100</span></p></div></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label={t.accuracy} value={`${score.accuracy}%`} /><Metric label={t.fluency} value={`${score.fluency}%`} /><Metric label={t.completion} value={`${score.completion}%`} /><Metric label={t.speed} value={`${score.wordsPerMinute} WPM`} /></div><div className="mt-6 flex flex-col gap-3 border-t border-[#eadabb] pt-5 sm:flex-row"><button onClick={resetAttempt} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#b42332] px-4 py-3 text-sm font-bold text-[#b42332]"><RotateCcw className="size-4" />{t.retry}</button><button onClick={share} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#b42332] px-4 py-3 text-sm font-bold text-white"><Share2 className="size-4" />{t.share}</button></div></section>}
    </section>
  </main>;
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-stone-700">{label}{children}{error && <span className="mt-1 block text-xs font-medium text-[#b42332]">{error}</span>}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#eadabb] bg-white px-4 py-3"><p className="text-xs font-semibold text-stone-500">{label}</p><p className="mt-1 text-xl font-bold text-stone-800">{value}</p></div>;
}
