"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, Download, Info, RotateCcw, Share2, X } from "lucide-react";
import { quizQuestions } from "@/lib/quiz-data";
import { loadSavedReaderDetails, saveQuizAttempt, type ReaderDetails } from "@/lib/reader-storage";
import { downloadScoreCard } from "@/lib/score-card";

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

function getReaderHandle(details: ReaderDetails) {
  if (details.username?.trim()) {
    const clean = details.username.trim().replace(/^@/, "");
    return `@${clean}`;
  }
  if (details.name?.trim()) {
    const clean = details.name.trim().toLowerCase().replace(/[^a-z0-9]/gi, "");
    return clean ? `@${clean}` : "@reader";
  }
  return "@reader";
}

export function QuizTab({ hindi }: { hindi: boolean }) {
  const questions = useMemo(() => shuffled(quizQuestions).slice(0, 8), []);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [stage, setStage] = useState<Stage>("answering");
  const [details, setDetails] = useState<ReaderDetails>(emptyDetails);
  const [errors, setErrors] = useState<Partial<Record<keyof ReaderDetails, string>>>( {});
  const [consent, setConsent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [userTouchedUsername, setUserTouchedUsername] = useState(false);

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
    const savedDetails = await loadSavedReaderDetails().catch(() => null);
    if (savedDetails) {
      setDetails(savedDetails);
      setIsSaving(true);
      try {
        await saveQuizAttempt({ details: savedDetails, answers });
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
      await saveQuizAttempt({ details, answers });
      setSaved(true);
    } catch {
      setSaveError(hindi ? "स्कोर सेव नहीं हो पाया। यह केवल आपकी स्क्रीन पर दिखाया जा रहा है।" : "We could not save this score. It is only shown on your screen.");
    } finally {
      setIsSaving(false);
      setStage("result");
    }
  }

  function downloadCard() {
    const { correct, total, score } = computeScore(answers);
    const handle = getReaderHandle(details);
    downloadScoreCard({
      readerName: details.name || (hindi ? "पाठक" : "Reader"),
      username: handle,
      kicker: hindi ? "हिंदी साहित्य क्विज़" : "HINDI LITERATURE QUIZ",
      title: hindi ? "8 प्रश्नों की चुनौती" : "8 Question Challenge",
      totalScore: score,
      metrics: [
        { label: hindi ? "सही उत्तर" : "CORRECT", value: `${correct}/${total}` },
        { label: hindi ? "शुद्धता दर" : "ACCURACY", value: `${score}%` },
      ],
      hindi,
      filename: "rajkamal-quiz-score.png",
    });
  }

  function downloadDetailingReport() {
    const { correct, total, score } = computeScore(answers);
    const readerName = details.name || (hindi ? "पाठक" : "Reader");
    const readerHandle = getReaderHandle(details);
    const dateStr = new Date().toLocaleDateString(hindi ? "hi-IN" : "en-IN");

    let content = `=========================================\n`;
    content += `RAJKAMAL QUIZ CLUB - QUIZ DETAILING REPORT\n`;
    content += `=========================================\n`;
    content += `Reader / पाठक: ${readerName} (${readerHandle})\n`;
    content += `Date / दिनांक: ${dateStr}\n`;
    content += `Score / कुल अंक: ${score}/100 (${correct}/${total} ${hindi ? "सही उत्तर" : "correct answers"})\n`;
    if (details.place) content += `Location / स्थान: ${details.place}\n`;
    content += `=========================================\n\n`;
    content += `QUESTION BREAKDOWN / प्रश्न विवरण:\n\n`;

    questions.forEach((q, idx) => {
      const userAnswerIdx = answers[q.id];
      const isCorrect = userAnswerIdx === q.correctIndex;
      const qText = hindi ? q.question.hi : q.question.en;
      const userPick = userAnswerIdx !== undefined ? (hindi ? q.options[userAnswerIdx].hi : q.options[userAnswerIdx].en) : (hindi ? "कोई उत्तर नहीं" : "No answer");
      const correctPick = hindi ? q.options[q.correctIndex].hi : q.options[q.correctIndex].en;

      content += `Q${idx + 1}: ${qText}\n`;
      content += `   Status / स्थिति: ${isCorrect ? "CORRECT / सही" : "INCORRECT / गलत"}\n`;
      content += `   Your Answer / आपका उत्तर: ${userPick}\n`;
      if (!isCorrect) {
        content += `   Correct Answer / सही उत्तर: ${correctPick}\n`;
      }
      content += `-----------------------------------------\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rajkamal-quiz-detailing-report.txt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function shareResult() {
    const { correct, total, score } = computeScore(answers);
    const handle = getReaderHandle(details);
    const message = hindi
      ? `मैंने (${handle}) राजकमल हिंदी साहित्य क्विज़ में ${score}/100 स्कोर किया (${correct}/${total} सही उत्तर)!`
      : `I (${handle}) scored ${score}/100 on the Rajkamal Hindi Literature Quiz (${correct}/${total} correct answers)!`;
    if (navigator.share) {
      await navigator.share({ title: "Rajkamal Quiz Club", text: message }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(message);
      setShareFeedback(hindi ? "परिणाम कॉपी हो गया है।" : "Your result is copied and ready to share.");
      window.setTimeout(() => setShareFeedback(""), 4000);
    }
  }

  function onNameChange(val: string) {
    const nextUsername = !userTouchedUsername ? (val.trim() ? `@${val.trim().toLowerCase().replace(/[^a-z0-9]/gi, "")}` : "") : (details.username ?? "");
    setDetails({ ...details, name: val, username: nextUsername });
  }

  function retry() {
    window.location.reload();
  }

  const field = "mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#b42332] focus:ring-2 focus:ring-[#b42332]/15 dark:border-[#68414a] dark:bg-[#2b1c20] dark:text-white dark:placeholder:text-[#c4b0b6]";

  if (stage === "result") {
    const { correct, total, score } = computeScore(answers);
    return <section className="padhaku-practice">
      <div className="padhaku-intro"><div><p className="padhaku-eyebrow">{hindi ? "क्विज़ परिणाम" : "QUIZ RESULT"}</p><h1>{hindi ? "शाबाश!" : "Well done!"}</h1></div></div>
      <div className="mt-5 rounded-xl border border-[#e5b043]/70 bg-[#fffaf0] p-5 sm:p-7">
        <section className="quiz-score-card">
          <div className="quiz-score-card-top"><span>RAJKAMAL</span><span>QUIZ CLUB</span></div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="quiz-score-card-chip" aria-hidden="true" />
            <div className="text-right">
              <small className="block text-[0.68rem] font-black uppercase tracking-widest text-[#ffe1a1]">
                {hindi ? "पाठक विवरण" : "READER DETAILS"}
              </small>
              <strong className="block text-base font-extrabold text-white">
                {details.name || (hindi ? "पाठक" : "Reader")}
              </strong>
              <span className="block text-xs font-bold text-[#ffe8a7]">
                {getReaderHandle(details)}
              </span>
            </div>
          </div>
          <div className="quiz-score-card-score">{score}<small>/100</small></div>
          <div className="quiz-score-card-bottom"><span>{hindi ? "हिंदी साहित्य क्विज़" : "Hindi Literature Quiz"}</span><strong>{correct}/{total} {hindi ? "सही उत्तर" : "correct answers"}</strong></div>
        </section>

        <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div><p className="text-xs font-bold tracking-[.16em] text-[#b42332]">{hindi ? "सही उत्तर" : "CORRECT ANSWERS"}</p><h2 className="serif mt-2 text-2xl font-bold">{correct}/{total}</h2></div>
          <div className="rounded-2xl bg-[#b42332] px-6 py-4 text-center text-white"><p className="text-xs font-bold uppercase tracking-widest text-white/70">{hindi ? "स्कोर" : "SCORE"}</p><p className="serif text-4xl font-bold">{score}<span className="text-lg text-white/70">/100</span></p></div>
        </div>

        {saveError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-[#b42332]" role="alert"><Info className="mr-1 inline size-4" />{saveError}</p>}
        {saved && !saveError && <p className="mt-4 text-sm text-stone-600">{hindi ? "आपका स्कोर सेव हो गया है और लीडरबोर्ड में जुड़ सकता है।" : "Your score was saved and may appear on the leaderboard."}</p>}
        {shareFeedback && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status"><Check className="mr-1 inline size-4 text-emerald-600" />{shareFeedback}</p>}

        <div className="mt-6 flex flex-col gap-3 border-t border-[#eadabb] pt-5 sm:flex-row">
          <button onClick={retry} disabled={isSaving} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#b42332] px-4 py-3 text-sm font-bold text-[#b42332] hover:bg-[#b42332]/5"><RotateCcw className="size-4" />{hindi ? "फिर से खेलें" : "Play again"}</button>
          <button onClick={downloadCard} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#b42332] px-4 py-3 text-sm font-bold text-[#b42332] hover:bg-[#b42332]/5"><Download className="size-4" />{hindi ? "स्कोर कार्ड डाउनलोड" : "Download score card"}</button>
          <button onClick={shareResult} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#b42332] px-4 py-3 text-sm font-bold text-white hover:bg-[#7e1421]"><Share2 className="size-4" />{hindi ? "परिणाम शेयर करें" : "Share result"}</button>
        </div>

        {/* Detailed Question Review / Quiz Detailing */}
        <div className="mt-8 border-t border-[#eadabb] pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="serif text-xl font-bold text-stone-900">{hindi ? "क्विज़ विवरण (प्रश्न समीक्षा)" : "Quiz Detailing (Question Review)"}</h2>
              <p className="mt-0.5 text-xs font-semibold text-stone-500">{hindi ? `${questions.length} में से ${correct} सही उत्तर` : `${correct} of ${questions.length} correct`}</p>
            </div>
            <button onClick={downloadDetailingReport} className="flex items-center gap-2 rounded-full border border-[#b42332] bg-white px-4 py-2 text-xs font-bold text-[#b42332] shadow-sm hover:bg-[#b42332]/5">
              <Download className="size-3.5" />
              {hindi ? "विवरण रिपोर्ट डाउनलोड करें (.txt)" : "Download detailing report (.txt)"}
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {questions.map((item, qIdx) => {
              const userAnswer = answers[item.id];
              const isCorrect = userAnswer === item.correctIndex;
              return (
                <div key={item.id} className={`rounded-xl border p-4 sm:p-5 transition-colors ${isCorrect ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${isCorrect ? "bg-emerald-600" : "bg-rose-600"}`}>
                        {qIdx + 1}
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-stone-900">
                          {hindi ? item.question.hi : item.question.en}
                        </h3>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shrink-0 ${isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {isCorrect ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                      {isCorrect ? (hindi ? "सही" : "Correct") : (hindi ? "गलत" : "Incorrect")}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {item.options.map((opt, optIdx) => {
                      const wasSelected = userAnswer === optIdx;
                      const isCorrectOpt = optIdx === item.correctIndex;
                      let badgeStyle = "border-stone-200 bg-white text-stone-700";
                      if (isCorrectOpt) {
                        badgeStyle = "border-emerald-500 bg-emerald-100/80 text-emerald-900 font-bold ring-1 ring-emerald-500";
                      } else if (wasSelected && !isCorrectOpt) {
                        badgeStyle = "border-rose-400 bg-rose-100/80 text-rose-900 font-bold";
                      }

                      return (
                        <div key={optIdx} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${badgeStyle}`}>
                          <span>{hindi ? opt.hi : opt.en}</span>
                          {isCorrectOpt && (
                            <span className="ml-2 flex items-center text-xs text-emerald-700 font-semibold">
                              <Check className="mr-1 size-3.5" />
                              {hindi ? "सही उत्तर" : "Correct"}
                            </span>
                          )}
                          {wasSelected && !isCorrectOpt && (
                            <span className="ml-2 flex items-center text-xs text-rose-700 font-semibold">
                              <X className="mr-1 size-3.5" />
                              {hindi ? "आपका उत्तर" : "Your pick"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>;
  }

  if (stage === "profile") {
    return <section className="padhaku-practice">
      <div className="padhaku-intro"><div><p className="padhaku-eyebrow">{hindi ? "अपना स्कोर सेव करें" : "SAVE YOUR SCORE"}</p><h1>{hindi ? "लीडरबोर्ड में शामिल हों" : "Join the leaderboard"}</h1></div></div>
      <form onSubmit={submitProfile} className="mt-5 max-w-xl rounded-xl border border-[#e5b043]/70 bg-[#fffaf0] p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-stone-700">{hindi ? "पूरा नाम *" : "Full name *"}<input autoFocus required value={details.name} onChange={(e) => onNameChange(e.target.value)} className={field} />{errors.name && <span className="mt-1 block text-xs font-medium text-[#b42332]">{errors.name}</span>}</label>
          <label className="block text-sm font-semibold text-stone-700">{hindi ? "यूज़रनेम / हैंडल (स्वचालित)" : "Username / handle (auto)"}<input placeholder="@username" value={details.username ?? ""} onChange={(e) => { setUserTouchedUsername(true); setDetails({ ...details, username: e.target.value }); }} className={field} /></label>
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
