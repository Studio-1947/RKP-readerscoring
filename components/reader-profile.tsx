"use client";

import { useEffect, useState } from "react";
import { Award, BookOpen, Download, LogOut, Medal, Trophy } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { loadSavedReaderDetails, updateLeaderboardOptIn, type ReaderDetails } from "@/lib/reader-storage";
import { downloadScoreCard } from "@/lib/score-card";
import { Insight, ViewHeading } from "@/components/reader-dashboard";

type ReadingRow = { created_at: string; passage_title: string; total_score: number; accuracy: number; fluency: number; words_per_minute: number };
type QuizRow = { created_at: string; quiz_title: string; total_score: number; correct_count: number; total_questions: number };

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function ReaderProfile({ hindi, refresh }: { hindi: boolean; refresh: string }) {
  const [details, setDetails] = useState<ReaderDetails | null>(null);
  const [readingHistory, setReadingHistory] = useState<ReadingRow[]>([]);
  const [quizHistory, setQuizHistory] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOptIn, setSavingOptIn] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const saved = await loadSavedReaderDetails();
        if (cancelled) return;
        setDetails(saved);
        if (!saved) { setReadingHistory([]); setQuizHistory([]); return; }
        const supabase = createClient();
        const [{ data: reading }, { data: quiz }] = await Promise.all([
          supabase.from("reading_attempts").select("created_at,passage_title,total_score,accuracy,fluency,words_per_minute").order("created_at", { ascending: false }),
          supabase.from("quiz_attempts").select("created_at,quiz_title,total_score,correct_count,total_questions").order("created_at", { ascending: false }),
        ]);
        if (cancelled) return;
        setReadingHistory(reading ?? []);
        setQuizHistory(quiz ?? []);
      } catch {
        if (!cancelled) { setReadingHistory([]); setQuizHistory([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [refresh, generation]);

  async function toggleOptIn() {
    if (!details) return;
    const next = !(details.leaderboardOptIn ?? false);
    setSavingOptIn(true);
    try {
      await updateLeaderboardOptIn(next);
      setDetails({ ...details, leaderboardOptIn: next });
    } catch {
      // Keep the previous value shown; the reader can retry the toggle.
    } finally {
      setSavingOptIn(false);
    }
  }

  async function forgetMe() {
    await createClient().auth.signOut({ scope: "local" });
    setDetails(null);
    setReadingHistory([]);
    setQuizHistory([]);
    setGeneration((value) => value + 1);
  }

  function downloadReadingCard(row: ReadingRow) {
    downloadScoreCard({
      readerName: details?.name ?? (hindi ? "पाठक" : "Reader"),
      kicker: hindi ? "हिंदी साहित्यिक पाठ" : "HINDI LITERARY PASSAGE",
      title: row.passage_title,
      totalScore: row.total_score,
      metrics: [
        { label: hindi ? "शुद्धता" : "ACCURACY", value: `${row.accuracy}%` },
        { label: hindi ? "प्रवाह" : "FLUENCY", value: `${row.fluency}%` },
        { label: hindi ? "गति" : "SPEED", value: `${row.words_per_minute} WPM` },
      ],
      hindi,
      filename: "rajkamal-reading-score.png",
    });
  }

  function downloadQuizCard(row: QuizRow) {
    downloadScoreCard({
      readerName: details?.name ?? (hindi ? "पाठक" : "Reader"),
      kicker: hindi ? "हिंदी साहित्य क्विज़" : "HINDI LITERATURE QUIZ",
      totalScore: row.total_score,
      metrics: [
        { label: hindi ? "सही उत्तर" : "CORRECT", value: `${row.correct_count}/${row.total_questions}` },
      ],
      hindi,
      filename: "rajkamal-quiz-score.png",
    });
  }

  if (loading) return <section className="dashboard-empty" role="status"><span className="dashboard-spinner" aria-hidden="true" />{hindi ? "प्रोफ़ाइल लोड हो रही है…" : "Loading your profile…"}</section>;

  if (!details) return <section className="dashboard-view">
    <ViewHeading eyebrow={hindi ? "आपकी पहचान" : "YOUR IDENTITY"} title={hindi ? "प्रोफ़ाइल" : "Profile"} subtitle={hindi ? "पहला पाठ या क्विज़ पूरा करने के बाद आपकी प्रोफ़ाइल यहाँ दिखेगी।" : "Your profile appears here after your first reading or quiz."} />
    <div className="dashboard-card"><p>{hindi ? "अभी कोई प्रोफ़ाइल सेव नहीं है।" : "No profile saved yet."}</p></div>
  </section>;

  const bestPassageScore = readingHistory.reduce((max, row) => Math.max(max, row.total_score), 0);
  const bestQuizScore = quizHistory.reduce((max, row) => Math.max(max, row.total_score), 0);
  const overall = readingHistory.length && quizHistory.length
    ? Math.round((bestPassageScore + bestQuizScore) / 2)
    : readingHistory.length ? bestPassageScore : quizHistory.length ? bestQuizScore : 0;

  return <section className="dashboard-view">
    <ViewHeading eyebrow={hindi ? "आपकी पहचान" : "YOUR IDENTITY"} title={hindi ? "प्रोफ़ाइल" : "Profile"} subtitle={hindi ? "अपनी जानकारी और सभी स्कोर एक जगह देखें।" : "See your details and every score in one place."} />
    <div className="insight-grid">
      <Insight icon={<BookOpen />} label={hindi ? "पठन सर्वश्रेष्ठ" : "Passage best"} value={`${bestPassageScore}/100`} />
      <Insight icon={<Award />} label={hindi ? "क्विज़ सर्वश्रेष्ठ" : "Quiz best"} value={`${bestQuizScore}/100`} />
      <Insight icon={<Trophy />} label={hindi ? "कुल मिलाकर" : "Overall"} value={`${overall}/100`} />
    </div>
    <div className="dashboard-card">
      <p className="profile-name-label">{hindi ? "नाम" : "NAME"}</p>
      <div className="card-heading"><h2 className="profile-name">{details.name}</h2></div>
      <dl className="profile-details">
        <div><dt>{hindi ? "आयु" : "Age"}</dt><dd>{details.age}</dd></div>
        <div><dt>{hindi ? "फ़ोन" : "Phone"}</dt><dd>{maskPhone(details.phone)}</dd></div>
        <div><dt>{hindi ? "शहर / स्थान" : "City / place"}</dt><dd>{details.place}</dd></div>
        {details.email && <div><dt>{hindi ? "ईमेल" : "Email"}</dt><dd>{details.email}</dd></div>}
        <div><dt>{hindi ? "पठन अभ्यास" : "Reading attempts"}</dt><dd>{readingHistory.length}</dd></div>
        <div><dt>{hindi ? "क्विज़ खेले" : "Quizzes played"}</dt><dd>{quizHistory.length}</dd></div>
      </dl>
      <label className="profile-toggle"><input type="checkbox" checked={details.leaderboardOptIn ?? false} disabled={savingOptIn} onChange={toggleOptIn} /><span>{hindi ? "मेरा स्कोर लीडरबोर्ड पर दिखाएँ" : "Show my score on the leaderboard"}</span></label>
      <button type="button" onClick={forgetMe} className="profile-forget"><LogOut className="size-4" />{hindi ? "इस डिवाइस पर भूल जाएँ" : "Forget me on this device"}</button>
    </div>

    <div className="dashboard-card mt-5">
      <div className="card-heading"><h2>{hindi ? "पठन इतिहास" : "Reading history"}</h2></div>
      {!readingHistory.length ? <p className="profile-empty-history">{hindi ? "अभी कोई पठन अभ्यास नहीं है।" : "No reading attempts yet."}</p> : <ul className="history-list">
        {readingHistory.map((row) => <li key={row.created_at}>
          <span><strong>{row.passage_title}</strong><small>{new Date(row.created_at).toLocaleDateString(hindi ? "hi-IN" : "en-IN")}</small></span>
          <b>{row.total_score}/100</b>
          <button type="button" className="history-download" aria-label={hindi ? "स्कोर कार्ड डाउनलोड करें" : "Download score card"} onClick={() => downloadReadingCard(row)}><Download className="size-4" /></button>
        </li>)}
      </ul>}
    </div>

    <div className="dashboard-card mt-5">
      <div className="card-heading"><h2>{hindi ? "क्विज़ इतिहास" : "Quiz history"}</h2></div>
      {!quizHistory.length ? <p className="profile-empty-history">{hindi ? "अभी कोई क्विज़ नहीं खेला गया।" : "No quizzes played yet."}</p> : <ul className="history-list">
        {quizHistory.map((row) => <li key={row.created_at}>
          <span><strong>{row.quiz_title}</strong><small>{new Date(row.created_at).toLocaleDateString(hindi ? "hi-IN" : "en-IN")} · {row.correct_count}/{row.total_questions} {hindi ? "सही" : "correct"}</small></span>
          <b>{row.total_score}/100</b>
          <button type="button" className="history-download" aria-label={hindi ? "स्कोर कार्ड डाउनलोड करें" : "Download score card"} onClick={() => downloadQuizCard(row)}><Download className="size-4" /></button>
        </li>)}
      </ul>}
    </div>

    <p className="profile-note"><Medal className="mr-1 inline size-3.5" />{hindi ? "यह जानकारी केवल इस डिवाइस के सत्र से जुड़ी है और नया पाठ या क्विज़ पूरा करने पर अपने-आप बनती है।" : "This is tied to this device's session and is created automatically when you complete a reading or quiz."}</p>
  </section>;
}
