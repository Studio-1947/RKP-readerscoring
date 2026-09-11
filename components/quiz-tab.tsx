"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, Info, RotateCcw, X } from "lucide-react";
import { quizId, quizQuestions, quizTitle } from "@/lib/quiz-data";
import { loadSavedReaderDetails, saveQuizAttempt, type ReaderDetails } from "@/lib/reader-storage";

type Stage = "answering" | "profile" | "result";

const emptyDetails: ReaderDetails = { name: "", age: "", phone: "", email: "", place: "", leaderboardOptIn: true };

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function QuizTab({ hindi }: { hindi: boolean }) {
  const questions = useMemo(() => shuffled(quizQuestions).slice(0, 8), []);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [stage, setStage] = useState<Stage>("answering");
  const [details, setDetails] = useState<ReaderDetails>(emptyDetails);
  const [errors, setErrors] = useState<Partial<Record<keyof ReaderDetails, string>>>({});
  const [consent, setConsent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  function computeScore(finalAnswers: Record<string, number>) {
    const correct = questions.filter((item) => finalAnswers[item.id] === item.correctIndex).length;
    return { correct, total: questions.length, score: Math.round((correct / questions.length) * 100) };
  }

  function pickAnswer(optionIndex: number) {
    if (revealed) return;
    setSelected(optionIndex);
    setRevealed(true);
    setAnswers((current) => ({ ...current, [question.id]: optionIndex }));
  }

  async function goNext() {
    if (!revealed) return;
    if (!isLast) {
      setIndex((value) => value + 1);
      setSelected(null);
      setRevealed(false);
      return;
    }
    const { correct, score } = computeScore(answers);
    const saved = await loadSavedReaderDetails().catch(() => null);
    if (saved) {
      setDetails(saved);
      setIsSaving(true);
      try {
        await saveQuizAttempt({ details: saved, quizId, quizTitle: quizTitle.hi, correctCount: correct, totalQuestions: questions.length, totalScore: score });
        setSaved(true);
      } catch {
        setSaveError(hindi ? "स्कोर सेव नहीं हो पाया। यह केवल आपकी स्क्रीन पर दिखाया जा रहा है।" : "We could not save this score. It is only shown on your screen.");
      } finally {
        setIsSaving(false);
      }
      setStage("result");
    } else {
      setStage("profile");
    }
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Partial<Record<keyof ReaderDetails, string>> = {};
    if (!details.name.trim()) next.name = hindi ? "यह जानकारी भरें।" : "Complete this field.";
    const age = Number(details.age);
    if (!Number.isInteger(age) || age < 5 || age > 120) next.age = hindi ? "5 से 120 के बीच आयु भरें।" : "Enter an age from 5 to 120.";
    if (details.phone.replace(/\D/g, "").length < 10) next.phone = hindi ? "मान्य फ़ोन नंबर भरें।" : "Enter a valid phone number.";
    if (!details.place.trim()) next.place = hindi ? "यह जानकारी भरें।" : "Complete this field.";
    setErrors(next);
    if (Object.keys(next).length || !consent) {
      if (!consent) setSaveError(hindi ? "जारी रखने के लिए सहमति दें।" : "Please provide consent to continue.");
      return;
    }
    setSaveError("");
    setIsSaving(true);
    const { correct, score } = computeScore(answers);
    try {
      await saveQuizAttempt({ details, quizId, quizTitle: quizTitle.hi, correctCount: correct, totalQuestions: questions.length, totalScore: score });
      setSaved(true);
    } catch {
      setSaveError(hindi ? "स्कोर सेव नहीं हो पाया। यह केवल आपकी स्क्रीन पर दिखाया जा रहा है।" : "We could not save this score. It is only shown on your screen.");
    } finally {
      setIsSaving(false);
      setStage("result");
    }
  }

  function retry() {
    window.location.reload();
  }

  const field = "mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 outline-none focus:border-[#b42332] focus:ring-2 focus:ring-[#b42332]/15";

  if (stage === "result") {
    const { correct, total, score } = computeScore(answers);
    return <section className="padhaku-practice">
      <div className="padhaku-intro"><div><p className="padhaku-eyebrow">{hindi ? "क्विज़ परिणाम" : "QUIZ RESULT"}</p><h1>{hindi ? "शाबाश!" : "Well done!"}</h1></div></div>
      <div className="mt-5 rounded-xl border border-[#e5b043]/70 bg-[#fffaf0] p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div><p className="text-xs font-bold tracking-[.16em] text-[#b42332]">{hindi ? "सही उत्तर" : "CORRECT ANSWERS"}</p><h2 className="serif mt-2 text-2xl font-bold">{correct}/{total}</h2></div>
          <div className="rounded-2xl bg-[#b42332] px-6 py-4 text-center text-white"><p className="text-xs font-bold uppercase tracking-widest text-white/70">{hindi ? "स्कोर" : "SCORE"}</p><p className="serif text-4xl font-bold">{score}<span className="text-lg text-white/70">/100</span></p></div>
        </div>
        {saveError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-[#b42332]" role="alert"><Info className="mr-1 inline size-4" />{saveError}</p>}
        {saved && !saveError && <p className="mt-4 text-sm text-stone-600">{hindi ? "आपका स्कोर सेव हो गया है और लीडरबोर्ड में जुड़ सकता है।" : "Your score was saved and may appear on the leaderboard."}</p>}
        <button onClick={retry} disabled={isSaving} className="mt-6 flex items-center justify-center gap-2 rounded-full border border-[#b42332] px-4 py-3 text-sm font-bold text-[#b42332]"><RotateCcw className="size-4" />{hindi ? "फिर से खेलें" : "Play again"}</button>
      </div>
    </section>;
  }

  if (stage === "profile") {
    return <section className="padhaku-practice">
      <div className="padhaku-intro"><div><p className="padhaku-eyebrow">{hindi ? "अपना स्कोर सेव करें" : "SAVE YOUR SCORE"}</p><h1>{hindi ? "लीडरबोर्ड में शामिल हों" : "Join the leaderboard"}</h1></div></div>
      <form onSubmit={submitProfile} className="mt-5 max-w-xl rounded-xl border border-[#e5b043]/70 bg-[#fffaf0] p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-stone-700">{hindi ? "पूरा नाम" : "Full name"}<input autoFocus value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} className={field} />{errors.name && <span className="mt-1 block text-xs font-medium text-[#b42332]">{errors.name}</span>}</label>
          <label className="block text-sm font-semibold text-stone-700">{hindi ? "आयु" : "Age"}<input value={details.age} onChange={(e) => setDetails({ ...details, age: e.target.value })} type="number" min="5" max="120" className={field} />{errors.age && <span className="mt-1 block text-xs font-medium text-[#b42332]">{errors.age}</span>}</label>
          <label className="block text-sm font-semibold text-stone-700">{hindi ? "फ़ोन नंबर" : "Phone number"}<input value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} inputMode="tel" className={field} />{errors.phone && <span className="mt-1 block text-xs font-medium text-[#b42332]">{errors.phone}</span>}</label>
          <label className="block text-sm font-semibold text-stone-700">{hindi ? "शहर / स्थान" : "City / place"}<input value={details.place} onChange={(e) => setDetails({ ...details, place: e.target.value })} className={field} />{errors.place && <span className="mt-1 block text-xs font-medium text-[#b42332]">{errors.place}</span>}</label>
          <label className="flex items-start gap-3 rounded-xl border border-[#eadabb] bg-white px-4 py-3 text-xs leading-5 text-stone-600 sm:col-span-2"><input checked={consent} onChange={(e) => setConsent(e.target.checked)} type="checkbox" className="mt-0.5 size-4 accent-[#b42332]" /><span>{hindi ? "मैं सहमत हूँ कि राजकमल मेरे स्कोर के लिए ये विवरण इस्तेमाल कर सकता है।" : "I agree that Rajkamal may use these details for my score."}</span></label>
          <label className="flex items-start gap-3 text-xs leading-5 text-stone-600 sm:col-span-2"><input type="checkbox" checked={details.leaderboardOptIn ?? true} onChange={(e) => setDetails({ ...details, leaderboardOptIn: e.target.checked })} className="mt-0.5 size-4 accent-[#b42332]" /><span>{hindi ? "अपना स्कोर लीडरबोर्ड में दिखाएँ।" : "Show my score on the leaderboard."}</span></label>
        </div>
        {saveError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-[#b42332]" role="alert"><Info className="mr-1 inline size-4" />{saveError}</p>}
        <button disabled={isSaving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#b42332] px-5 py-3 text-sm font-bold text-white hover:bg-[#7e1421] disabled:cursor-wait disabled:opacity-60 sm:w-auto">{isSaving ? (hindi ? "सहेजा जा रहा है…" : "Saving…") : (hindi ? "स्कोर देखें" : "View my score")}</button>
      </form>
    </section>;
  }

  return <section className="quiz-fullscreen">
    <div className="quiz-progress"><div style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
    <div className="quiz-body">
      <p className="quiz-counter">{hindi ? `प्रश्न ${index + 1} / ${questions.length}` : `QUESTION ${index + 1} / ${questions.length}`}</p>
      <h1 className="quiz-question">{hindi ? question.question.hi : question.question.en}</h1>
      <div className="quiz-options">
        {question.options.map((option, optionIndex) => {
          const isSelected = selected === optionIndex;
          const isCorrectOption = optionIndex === question.correctIndex;
          let stateClass = "";
          if (revealed && isCorrectOption) stateClass = "quiz-option-correct";
          else if (revealed && isSelected) stateClass = "quiz-option-wrong";
          else if (isSelected) stateClass = "quiz-option-selected";
          return <button type="button" key={optionIndex} disabled={revealed} onClick={() => pickAnswer(optionIndex)} className={`quiz-option ${stateClass}`}>
            <span>{hindi ? option.hi : option.en}</span>
            {revealed && isCorrectOption && <Check className="size-5 shrink-0" />}
            {revealed && isSelected && !isCorrectOption && <X className="size-5 shrink-0" />}
          </button>;
        })}
      </div>
      {revealed && <p className={`quiz-feedback ${selected === question.correctIndex ? "quiz-feedback-correct" : "quiz-feedback-wrong"}`}>{selected === question.correctIndex ? (hindi ? "सही जवाब!" : "Correct!") : (hindi ? "गलत जवाब।" : "Not quite.")}</p>}
    </div>
    <button onClick={goNext} disabled={!revealed} className="quiz-next">{isLast ? (hindi ? "क्विज़ पूरा करें" : "Finish quiz") : (hindi ? "अगला सवाल" : "Next question")}</button>
  </section>;
}
