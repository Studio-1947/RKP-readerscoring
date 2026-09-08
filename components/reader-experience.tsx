"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Award, BookOpen, Check, ChevronDown, CircleHelp, Flame, Gift, Headphones,
  Info, Mic, MicOff, Play, RotateCcw, Share2, Sparkles, Timer, Volume2,
} from "lucide-react";
import { ReadingScore, scoreReading } from "@/lib/scoring";

type Passage = {
  id: string;
  sequence: number;
  title: string;
  difficulty_editorial: string;
  genre: string;
  lines: string[];
  reference_text: string;
  word_count_whitespace: number;
};

type Props = { passages: Passage[] };
type SessionState = "ready" | "reading" | "result" | "unsupported";

const reward = (xp: number) => {
  if (xp >= 1200) return { name: "पुस्तक प्रेमी", discount: "15% off", next: "सप्ताह का शीर्ष पाठक" };
  if (xp >= 650) return { name: "कहानीकार", discount: "10% off", next: "550 XP to 15% off" };
  if (xp >= 250) return { name: "नव-पाठक", discount: "5% off", next: "400 XP to 10% off" };
  return { name: "आरंभ", discount: "—", next: "250 XP to unlock 5% off" };
};

const defaultScore: ReadingScore = {
  total: 0, accuracy: 0, fluency: 0, completion: 0, consistency: 0,
  wordsRead: 0, expectedWords: 0, wordsPerMinute: 0, xp: 0,
};

export default function ReaderExperience({ passages }: Props) {
  const [passageIndex, setPassageIndex] = useState(0);
  const [state, setState] = useState<SessionState>("ready");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [score, setScore] = useState<ReadingScore>(defaultScore);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [lifetimeXp, setLifetimeXp] = useState(180);
  const recognition = useRef<SpeechRecognition | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const animationFrame = useRef<number | null>(null);
  const startedAt = useRef<number>(0);
  const transcriptRef = useRef("");
  const keepListening = useRef(false);
  const selected = passages[passageIndex];
  const level = useMemo(() => reward(lifetimeXp), [lifetimeXp]);

  useEffect(() => {
    if (state !== "reading") return;
    const ticker = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => window.clearInterval(ticker);
  }, [state]);

  useEffect(() => () => stopAudioMeter(), []);

  function stopAudioMeter() {
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    mediaStream.current = null;
    setAudioLevel(0);
  }

  function startAudioMeter(stream: MediaStream) {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 64;
    context.createMediaStreamSource(stream).connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount);
    const readLevel = () => {
      analyser.getByteFrequencyData(values);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      setAudioLevel(Math.min(100, Math.round((average / 128) * 100)));
      animationFrame.current = requestAnimationFrame(readLevel);
    };
    readLevel();
  }

  async function startReading() {
    setError("");
    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechAPI) {
      setState("unsupported");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      mediaStream.current = stream;
      startAudioMeter(stream);
      setTranscript("");
      transcriptRef.current = "";
      setInterim("");
      setSeconds(0);
      startedAt.current = Date.now();
      setAttempts((current) => current + 1);
      keepListening.current = true;

      const speech = new SpeechAPI();
      recognition.current = speech;
      speech.lang = "hi-IN";
      speech.continuous = true;
      speech.interimResults = true;
      speech.onresult = (event) => {
        let finalText = "";
        let partialText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) finalText += result[0].transcript + " ";
          else partialText += result[0].transcript;
        }
        if (finalText) {
          transcriptRef.current += finalText;
          setTranscript(transcriptRef.current);
        }
        setInterim(partialText);
      };
      speech.onerror = (event) => {
        if (event.error !== "aborted") setError(event.error === "not-allowed" ? "माइक्रोफ़ोन की अनुमति दें और फिर शुरू करें।" : "आवाज़ को समझने में रुकावट आई। फिर से कोशिश करें।");
      };
      speech.onend = () => {
        if (keepListening.current) {
          try { speech.start(); } catch { /* browser is already restarting */ }
        }
      };
      speech.start();
      setState("reading");
    } catch {
      setError("माइक्रोफ़ोन नहीं खुल पाया। ब्राउज़र की mic permission जाँचें।");
    }
  }

  function finishReading() {
    keepListening.current = false;
    recognition.current?.stop();
    stopAudioMeter();
    const duration = Math.max(1, Math.floor((Date.now() - startedAt.current) / 1000));
    setSeconds(duration);
    const nextScore = scoreReading(selected.reference_text, transcriptRef.current, duration, attempts);
    setScore(nextScore);
    const newXp = lifetimeXp + nextScore.xp;
    setLifetimeXp(newXp);
    window.localStorage.setItem("rkp-reader-xp", String(newXp));
    setState("result");
  }

  function chooseNext() {
    const next = (passageIndex + 1) % passages.length;
    setPassageIndex(next);
    setTranscript(""); setInterim(""); setSeconds(0); setScore(defaultScore); setShowTranscript(false); setState("ready");
  }

  function listenToPassage() {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selected.reference_text);
    utterance.lang = "hi-IN";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }

  async function shareScore() {
    const copy = `मैंने राजकमल रीडर पर “${selected.title}” पढ़ा और ${score.total}/100 स्कोर किया। आप भी पढ़िए, बढ़िए, जीतिए!`;
    if (navigator.share) {
      await navigator.share({ title: "Rajkamal Reader", text: copy });
    } else {
      await navigator.clipboard.writeText(copy);
      setError("आपका परिणाम शेयर करने के लिए कॉपी हो गया है।");
    }
  }

  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remain = String(seconds % 60).padStart(2, "0");
  const isReading = state === "reading";

  return (
    <main className="paper-grain min-h-screen pb-10">
      <header className="border-b border-stone-200 bg-[#fffcf7]/90 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-[#b42332] text-lg font-bold text-white">र</div>
            <div><p className="serif text-lg font-bold leading-none">राजकमल रीडर</p><p className="mt-1 text-[10px] font-bold tracking-[.16em] text-[#b42332]">पढ़िए · बढ़िए · जीतिए</p></div>
          </div>
          <button className="flex items-center gap-2 rounded-full border border-[#e5b043]/50 bg-[#fff7dc] px-3 py-2 text-xs font-bold text-[#7e1421] sm:px-4">
            <Flame className="size-4 fill-[#e5b043] text-[#e5b043]" /> <span>3 दिन की लय</span>
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-6 lg:grid-cols-[1fr_310px] lg:px-8 lg:pt-10">
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold tracking-[.18em] text-[#b42332]">आज का अभ्यास</p><h1 className="serif mt-1 text-2xl font-bold sm:text-3xl">अपनी आवाज़ में साहित्य</h1></div>
            <button onClick={chooseNext} disabled={isReading} className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold transition hover:border-[#b42332] hover:text-[#b42332] disabled:opacity-40"><RotateCcw className="size-4" />नई रचना</button>
          </div>

          <article className="overflow-hidden rounded-[1.6rem] border border-stone-200 bg-[#fffdf9] shadow-[0_16px_45px_rgba(72,44,26,.08)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 bg-[#fff7ec] px-5 py-4 sm:px-8">
              <div><div className="mb-2 flex gap-2"><span className="rounded-full bg-[#b42332] px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">पाठ {selected.sequence}/100</span><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-stone-600">{selected.difficulty_editorial}</span></div><h2 className="serif text-xl font-bold sm:text-2xl">{selected.title}</h2></div>
              <button onClick={listenToPassage} disabled={isReading} className="flex items-center gap-2 rounded-full px-2 py-2 text-xs font-bold text-[#7e1421] hover:bg-white disabled:opacity-40"><Volume2 className="size-4" />पहले सुनें</button>
            </div>

            <div className="px-5 py-7 sm:px-8 sm:py-9">
              <div className="serif border-l-2 border-[#e5b043] pl-5 text-[1.3rem] leading-[2.1] text-stone-800 sm:text-[1.48rem] sm:leading-[2.2]">
                {selected.lines.map((line) => <p key={line}>{line}</p>)}
              </div>
              <div className="mt-7 flex items-center gap-2 border-t border-stone-100 pt-5 text-xs text-stone-500"><BookOpen className="size-4 text-[#b42332]" /> {selected.genre} · {selected.word_count_whitespace} शब्द · शांत जगह या headphones बेहतर हैं</div>
            </div>
          </article>

          <section className={`mt-5 rounded-[1.6rem] border p-5 transition sm:p-6 ${isReading ? "border-[#b42332]/40 bg-[#7e1421] text-white shadow-lg" : "border-stone-200 bg-white"}`}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className={`grid size-14 place-items-center rounded-full ${isReading ? "bg-white/15" : "bg-[#fdf0ef] text-[#b42332]"}`}>{isReading ? <Mic className="size-6" /> : <MicOff className="size-6" />}</div>
                <div><p className={`text-sm font-bold ${isReading ? "text-[#ffe8a7]" : "text-[#b42332]"}`}>{isReading ? "आपकी आवाज़ सुन रहे हैं" : "तैयार होने पर शुरू करें"}</p><p className={`mt-1 text-xs ${isReading ? "text-white/70" : "text-stone-500"}`}>{isReading ? "पंक्तियाँ आराम से और स्पष्ट पढ़ें" : "Mic permission देने के बाद आपकी reading score होगी"}</p></div>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end"><div className="flex items-center gap-2 font-mono text-xl font-bold"><Timer className="size-4" />{minutes}:{remain}</div>{isReading ? <button onClick={finishReading} className="rounded-full bg-[#e5b043] px-5 py-3 text-sm font-bold text-[#352311] hover:bg-[#f2c766]">पूरा करें</button> : <button onClick={startReading} className="flex items-center gap-2 rounded-full bg-[#b42332] px-5 py-3 text-sm font-bold text-white hover:bg-[#7e1421]"><Play className="size-4 fill-current" />पढ़ना शुरू करें</button>}</div>
            </div>
            {isReading && <div className="mt-5 flex h-9 items-center justify-center gap-1.5">{Array.from({ length: 24 }).map((_, index) => <span key={index} className="audio-bar w-1 rounded-full bg-[#e5b043]" style={{ height: `${20 + ((index * 23) % 65) + audioLevel / 5}%` }} />)}</div>}
            {(transcript || interim) && isReading && <p className="mt-4 rounded-xl bg-black/10 px-4 py-3 text-sm leading-6 text-white/90">{transcript}<span className="text-[#ffe8a7]">{interim}</span></p>}
            {error && <p className={`mt-4 flex items-center gap-2 text-xs font-medium ${isReading ? "text-[#ffe8a7]" : "text-[#b42332]"}`}><Info className="size-4" />{error}</p>}
          </section>

          {state === "unsupported" && <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"><b>इस browser में Hindi voice recognition उपलब्ध नहीं है।</b><br />Chrome या Edge (desktop/Android) पर खोलें. Production version में server-side Hindi speech-to-text जोड़ने पर यह limitation हटेगी।</div>}

          {state === "result" && <section className="mt-5 rounded-[1.6rem] border border-[#e5b043]/70 bg-[#fffaf0] p-5 shadow-sm sm:p-7">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="flex items-center gap-2 text-xs font-bold tracking-[.16em] text-[#b42332]"><Sparkles className="size-4" />आपका परिणाम</p><h2 className="serif mt-2 text-3xl font-bold">बहुत सुंदर पाठ!</h2><p className="mt-2 text-sm text-stone-600">+{score.xp} XP जोड़े गए हैं। हर रचना आपको और बेहतर बनाएगी।</p></div><div className="rounded-2xl bg-[#b42332] px-6 py-4 text-center text-white"><p className="text-xs font-bold uppercase tracking-widest text-white/70">कुल स्कोर</p><p className="serif text-4xl font-bold">{score.total}<span className="text-lg text-white/70">/100</span></p></div></div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="शुद्धता" value={`${score.accuracy}%`} /><Metric label="प्रवाह" value={`${score.fluency}%`} /><Metric label="पूर्णता" value={`${score.completion}%`} /><Metric label="गति" value={`${score.wordsPerMinute} WPM`} /></div>
            <button onClick={() => setShowTranscript(!showTranscript)} className="mt-5 flex items-center gap-2 text-xs font-bold text-[#7e1421]"><ChevronDown className={`size-4 transition ${showTranscript ? "rotate-180" : ""}`} />आपका transcript देखें</button>
            {showTranscript && <p className="mt-2 rounded-xl border border-stone-200 bg-white p-4 text-sm leading-7 text-stone-700">{transcript || "कोई transcript नहीं मिला। शांत जगह में फिर कोशिश करें।"}</p>}
            <div className="mt-6 flex flex-col gap-3 border-t border-[#eadabb] pt-5 sm:flex-row"><button onClick={startReading} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#b42332] px-4 py-3 text-sm font-bold text-[#b42332] hover:bg-[#fff1ee]"><RotateCcw className="size-4" />फिर पढ़ें</button><button onClick={shareScore} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#b42332] px-4 py-3 text-sm font-bold text-white hover:bg-[#7e1421]"><Share2 className="size-4" />अपना परिणाम शेयर करें</button></div>
          </section>}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-[1.5rem] bg-[#231b19] p-5 text-white"><p className="flex items-center gap-2 text-xs font-bold tracking-[.15em] text-[#e5b043]"><Award className="size-4" />आपकी पाठक यात्रा</p><div className="mt-5 flex items-end justify-between"><div><p className="serif text-2xl font-bold">{level.name}</p><p className="mt-1 text-xs text-white/60">{lifetimeXp} lifetime XP</p></div><span className="rounded-full bg-[#e5b043] px-3 py-1.5 text-xs font-bold text-[#382411]">स्तर 01</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#e5b043]" style={{ width: `${Math.min(100, (lifetimeXp / 650) * 100)}%` }} /></div><p className="mt-3 text-xs text-white/65">{level.next}</p></section>
          <section className="rounded-[1.5rem] border border-stone-200 bg-white p-5"><p className="flex items-center gap-2 text-xs font-bold tracking-[.15em] text-[#b42332]"><Gift className="size-4" />आपका पुरस्कार</p><div className="mt-4 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-full bg-[#fff0d2] text-[#b42332]"><Gift className="size-5" /></div><div><p className="font-bold">{level.discount}</p><p className="text-xs text-stone-500">अगला reward unlock करें</p></div></div><button className="mt-4 w-full rounded-xl border border-stone-200 py-2.5 text-xs font-bold text-stone-500">Rewards जल्द आ रहे हैं</button></section>
          <section className="rounded-[1.5rem] border border-[#e5b043]/40 bg-[#fff9e7] p-5"><p className="flex items-center gap-2 text-sm font-bold text-[#7e1421]"><Headphones className="size-4" />बेहतर score के लिए</p><ul className="mt-3 space-y-2 text-xs leading-5 text-stone-600"><li>• शांत जगह में पढ़ें</li><li>• speaker के बजाय headphones इस्तेमाल करें</li><li>• हर शब्द को स्पष्ट बोलें</li></ul></section>
          <p className="flex items-start gap-2 px-2 text-[11px] leading-4 text-stone-500"><CircleHelp className="mt-0.5 size-3.5 shrink-0" />यह demo score आपके browser में गणना करता है। Discount redemption के लिए server-verified attempts आवश्यक होंगे।</p>
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#eadabb] bg-white px-3 py-4 text-center"><p className="text-[10px] font-bold tracking-wide text-stone-500">{label}</p><p className="mt-1 text-lg font-bold text-[#7e1421]">{value}</p></div>;
}
