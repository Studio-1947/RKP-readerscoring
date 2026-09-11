"use client";

import { useEffect, useState } from "react";
import { Award, BookOpen, LogOut, Medal, Trophy } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { loadSavedReaderDetails, updateLeaderboardOptIn, type ReaderDetails } from "@/lib/reader-storage";
import { Insight, ViewHeading } from "@/components/reader-dashboard";

type Summary = { bestPassageScore: number; passageAttempts: number; bestQuizScore: number; quizAttempts: number };
const emptySummary: Summary = { bestPassageScore: 0, passageAttempts: 0, bestQuizScore: 0, quizAttempts: 0 };

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function ReaderProfile({ hindi, refresh }: { hindi: boolean; refresh: string }) {
  const [details, setDetails] = useState<ReaderDetails | null>(null);
  const [summary, setSummary] = useState<Summary>(emptySummary);
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
        if (!saved) { setSummary(emptySummary); return; }
        const supabase = createClient();
        const [{ data: reading }, { data: quiz }] = await Promise.all([
          supabase.from("reading_attempts").select("total_score"),
          supabase.from("quiz_attempts").select("total_score"),
        ]);
        if (cancelled) return;
        setSummary({
          bestPassageScore: (reading ?? []).reduce((max, row) => Math.max(max, row.total_score), 0),
          passageAttempts: (reading ?? []).length,
          bestQuizScore: (quiz ?? []).reduce((max, row) => Math.max(max, row.total_score), 0),
          quizAttempts: (quiz ?? []).length,
        });
      } catch {
        if (!cancelled) setSummary(emptySummary);
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
    setSummary(emptySummary);
    setGeneration((value) => value + 1);
  }

  if (loading) return <section className="dashboard-empty" role="status"><span className="dashboard-spinner" aria-hidden="true" />{hindi ? "प्रोफ़ाइल लोड हो रही है…" : "Loading your profile…"}</section>;

  if (!details) return <section className="dashboard-view">
    <ViewHeading eyebrow={hindi ? "आपकी पहचान" : "YOUR IDENTITY"} title={hindi ? "प्रोफ़ाइल" : "Profile"} subtitle={hindi ? "पहला पाठ या क्विज़ पूरा करने के बाद आपकी प्रोफ़ाइल यहाँ दिखेगी।" : "Your profile appears here after your first reading or quiz."} />
    <div className="dashboard-card"><p>{hindi ? "अभी कोई प्रोफ़ाइल सेव नहीं है।" : "No profile saved yet."}</p></div>
  </section>;

  const overall = summary.passageAttempts && summary.quizAttempts
    ? Math.round((summary.bestPassageScore + summary.bestQuizScore) / 2)
    : summary.passageAttempts ? summary.bestPassageScore : summary.quizAttempts ? summary.bestQuizScore : 0;

  return <section className="dashboard-view">
    <ViewHeading eyebrow={hindi ? "आपकी पहचान" : "YOUR IDENTITY"} title={hindi ? "प्रोफ़ाइल" : "Profile"} subtitle={hindi ? "अपनी जानकारी और सभी स्कोर एक जगह देखें।" : "See your details and every score in one place."} />
    <div className="insight-grid">
      <Insight icon={<BookOpen />} label={hindi ? "पठन सर्वश्रेष्ठ" : "Passage best"} value={`${summary.bestPassageScore}/100`} />
      <Insight icon={<Award />} label={hindi ? "क्विज़ सर्वश्रेष्ठ" : "Quiz best"} value={`${summary.bestQuizScore}/100`} />
      <Insight icon={<Trophy />} label={hindi ? "कुल मिलाकर" : "Overall"} value={`${overall}/100`} />
    </div>
    <div className="dashboard-card">
      <div className="card-heading"><h2>{details.name}</h2></div>
      <dl className="profile-details">
        <div><dt>{hindi ? "आयु" : "Age"}</dt><dd>{details.age}</dd></div>
        <div><dt>{hindi ? "फ़ोन" : "Phone"}</dt><dd>{maskPhone(details.phone)}</dd></div>
        <div><dt>{hindi ? "शहर / स्थान" : "City / place"}</dt><dd>{details.place}</dd></div>
        {details.email && <div><dt>{hindi ? "ईमेल" : "Email"}</dt><dd>{details.email}</dd></div>}
        <div><dt>{hindi ? "पठन अभ्यास" : "Reading attempts"}</dt><dd>{summary.passageAttempts}</dd></div>
        <div><dt>{hindi ? "क्विज़ खेले" : "Quizzes played"}</dt><dd>{summary.quizAttempts}</dd></div>
      </dl>
      <label className="profile-toggle"><input type="checkbox" checked={details.leaderboardOptIn ?? false} disabled={savingOptIn} onChange={toggleOptIn} /><span>{hindi ? "मेरा स्कोर लीडरबोर्ड पर दिखाएँ" : "Show my score on the leaderboard"}</span></label>
      <button type="button" onClick={forgetMe} className="profile-forget"><LogOut className="size-4" />{hindi ? "इस डिवाइस पर भूल जाएँ" : "Forget me on this device"}</button>
    </div>
    <p className="profile-note"><Medal className="mr-1 inline size-3.5" />{hindi ? "यह जानकारी केवल इस डिवाइस के सत्र से जुड़ी है और नया पाठ या क्विज़ पूरा करने पर अपने-आप बनती है।" : "This is tied to this device's session and is created automatically when you complete a reading or quiz."}</p>
  </section>;
}
