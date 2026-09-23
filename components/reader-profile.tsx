"use client";

import { useEffect, useState } from "react";
import { Award, BookOpen, Download, LogOut, Medal, Pencil, Trophy } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { deleteReaderData, loadSavedReaderDetails, saveReaderProfile, updateLeaderboardOptIn, type ReaderDetails } from "@/lib/reader-storage";
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
  const [editing, setEditing] = useState(false);

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
    if (!window.confirm(hindi ? "क्या आप अपनी प्रोफ़ाइल और सभी स्कोर स्थायी रूप से हटाना चाहते हैं?" : "Permanently delete your profile and all scores?")) return;
    try { await deleteReaderData(); }
    finally { await createClient().auth.signOut({ scope: "local" }); }
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

  if (!details || editing) return <ProfileEditor hindi={hindi} initial={details} onSaved={(saved) => { setDetails(saved); setEditing(false); setGeneration((value) => value + 1); }} onCancel={details ? () => setEditing(false) : undefined} />;

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
    <section className="reader-club-card">
      <div className="reader-card-orb reader-card-orb-one" /><div className="reader-card-orb reader-card-orb-two" />
      <div className="reader-card-top"><span>RAJKAMAL</span><span>READER CLUB</span></div>
      <div className="reader-card-chip" aria-hidden="true"><i /><i /><i /></div>
      <div className="reader-card-number">{details.phone ? `•••• •••• ${details.phone.replace(/\D/g, "").slice(-4)}` : "•••• •••• ••••"}</div>
      <div className="reader-card-bottom"><div><small>{hindi ? "पाठक" : "READER"}</small><strong>{details.name || (hindi ? "पाठक" : "Reader")}</strong></div><div><small>{hindi ? "सदस्य" : "MEMBER SINCE"}</small><strong>{details.memberSince ? new Date(details.memberSince).toLocaleDateString(hindi ? "hi-IN" : "en-IN", { month: "short", year: "numeric" }) : "—"}</strong></div></div>
      <p className="reader-card-email">{details.email || (hindi ? "अपनी प्रोफ़ाइल में ईमेल जोड़ें" : "Add your email in Profile")}</p>
    </section>
    <div className="dashboard-card profile-details-card">
      <div className="card-heading"><h2>{hindi ? "प्रोफ़ाइल विवरण" : "Profile details"}</h2><button onClick={() => setEditing(true)}><Pencil className="size-4" />{hindi ? "बदलें" : "Edit"}</button></div>
      <dl className="profile-details"><div><dt>{hindi ? "आयु" : "Age"}</dt><dd>{details.age || "—"}</dd></div><div><dt>{hindi ? "फ़ोन" : "Phone"}</dt><dd>{details.phone ? maskPhone(details.phone) : "—"}</dd></div><div><dt>{hindi ? "शहर / स्थान" : "City / place"}</dt><dd>{details.place || "—"}</dd></div><div><dt>{hindi ? "पठन अभ्यास" : "Reading attempts"}</dt><dd>{readingHistory.length}</dd></div><div><dt>{hindi ? "क्विज़ खेले" : "Quizzes played"}</dt><dd>{quizHistory.length}</dd></div></dl>
      <div className="profile-favorites"><div><h3>{hindi ? "पसंदीदा लेखक" : "Favourite authors"}</h3><p>{details.favoriteAuthors?.length ? details.favoriteAuthors.join(" · ") : (hindi ? "अभी नहीं जोड़ा गया" : "Not added yet")}</p></div><div><h3>{hindi ? "पसंदीदा किताबें" : "Favourite books"}</h3><p>{details.favoriteBooks?.length ? details.favoriteBooks.join(" · ") : (hindi ? "अभी नहीं जोड़ा गया" : "Not added yet")}</p></div></div>
      <label className="profile-toggle"><input type="checkbox" checked={details.leaderboardOptIn ?? false} disabled={savingOptIn} onChange={toggleOptIn} /><span>{hindi ? "मेरा स्कोर लीडरबोर्ड पर दिखाएँ" : "Show my score on the leaderboard"}</span></label>
      <button type="button" onClick={forgetMe} className="profile-forget"><LogOut className="size-4" />{hindi ? "मेरा डेटा हटाएँ" : "Delete my data"}</button>
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

function ProfileEditor({ hindi, initial, onSaved, onCancel }: { hindi: boolean; initial: ReaderDetails | null; onSaved: (details: ReaderDetails) => void; onCancel?: () => void }) {
  const [details, setDetails] = useState<ReaderDetails>(initial ?? { name: "", username: "", age: "", phone: "", email: "", place: "", leaderboardOptIn: true, favoriteAuthors: [], favoriteBooks: [] });
  const [authors, setAuthors] = useState((initial?.favoriteAuthors ?? []).join(", "));
  const [books, setBooks] = useState((initial?.favoriteBooks ?? []).join(", "));
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const field = "mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#b42332] focus:ring-2 focus:ring-[#b42332]/15 dark:border-[#68414a] dark:bg-[#2b1c20] dark:text-white dark:placeholder:text-[#c4b0b6]";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
    const favoriteAuthors = list(authors); const favoriteBooks = list(books);
    if (!details.name.trim()) { setError(hindi ? "कृपया अपना पूरा नाम भरें।" : "Please enter your full name."); return; }
    if ((details.age && (!Number.isInteger(Number(details.age)) || Number(details.age) < 5 || Number(details.age) > 120)) || (details.phone && details.phone.replace(/\D/g, "").length < 10) || favoriteAuthors.length > 4 || favoriteBooks.length > 4) { setError(hindi ? "आयु 5 से 120 के बीच रखें, फोन नंबर मान्य रखें, और अधिकतम 4 लेखक व 4 किताबें जोड़ें।" : "Use a valid age/phone number and add at most four authors and four books."); return; }
    const saved = { ...details, favoriteAuthors, favoriteBooks }; setSaving(true); setError("");
    try { await saveReaderProfile(saved); onSaved(saved); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save your profile."); } finally { setSaving(false); }
  }
  return <section className="dashboard-view"><ViewHeading eyebrow={hindi ? "आपकी पहचान" : "YOUR IDENTITY"} title={hindi ? "प्रोफ़ाइल विवरण" : "Profile details"} subtitle={hindi ? "जो जानकारी चाहें जोड़ें या बदलें—पसंदीदा लेखक और किताबें सहित।" : "Add or update any details, including favourite authors and books."} /><form onSubmit={submit} className="dashboard-card profile-editor"><div className="grid gap-4 sm:grid-cols-2"><label>{hindi ? "पूरा नाम *" : "Full name *"}<input required value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} className={field} /></label><label>{hindi ? "यूज़रनेम / हैंडल" : "Username / handle"}<input placeholder="@username" value={details.username ?? ""} onChange={(e) => setDetails({ ...details, username: e.target.value })} className={field} /></label><label>{hindi ? "आयु" : "Age"}<input type="number" min="5" max="120" value={details.age} onChange={(e) => setDetails({ ...details, age: e.target.value })} className={field} /></label><label>{hindi ? "फ़ोन" : "Phone"}<input inputMode="tel" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} className={field} /></label><label className="sm:col-span-2">Email<input type="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} className={field} /></label><label className="sm:col-span-2">{hindi ? "शहर / स्थान" : "City / place"}<input value={details.place} onChange={(e) => setDetails({ ...details, place: e.target.value })} className={field} /></label><label className="sm:col-span-2">{hindi ? "पसंदीदा लेखक (अधिकतम 4, कॉमा से अलग करें)" : "Favourite authors (up to 4, comma separated)"}<input value={authors} onChange={(e) => setAuthors(e.target.value)} className={field} placeholder="Premchand, Mahadevi Verma" /></label><label className="sm:col-span-2">{hindi ? "पसंदीदा किताबें (अधिकतम 4, कॉमा से अलग करें)" : "Favourite books (up to 4, comma separated)"}<input value={books} onChange={(e) => setBooks(e.target.value)} className={field} placeholder="Godaan, Madhushala" /></label></div>{error && <p className="mt-4 text-sm text-[#b42332]" role="alert">{error}</p>}<div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={saving} className="rounded-full bg-[#b42332] px-6 py-3 font-bold text-white hover:bg-[#7e1421] disabled:opacity-60">{saving ? "Saving…" : (hindi ? "प्रोफ़ाइल सहेजें" : "Save profile")}</button>{onCancel && <button type="button" onClick={onCancel} disabled={saving} className="rounded-full border border-stone-300 bg-white px-6 py-3 font-bold text-stone-700 hover:bg-stone-50 dark:border-[#56353c] dark:bg-[#24191c] dark:text-[#f4e9e8] dark:hover:bg-[#332126]">{hindi ? "रद्द करें" : "Cancel"}</button>}</div></form></section>;
}
