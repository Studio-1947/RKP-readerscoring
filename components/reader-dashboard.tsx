"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, BarChart3, BookOpen, Download, Flame, Medal, TrendingUp, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type Attempt = {
  created_at: string;
  passage_title: string;
  total_score: number;
  accuracy: number;
  fluency: number;
  completion: number;
  words_per_minute: number;
};

type Leader = { reader_label: string; best_score: number };

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = "\uFEFF" + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function streakDays(attempts: Attempt[]) {
  const days = [...new Set(attempts.map((attempt) => attempt.created_at.slice(0, 10)))].sort().reverse();
  if (!days.length) return 0;
  const cursor = new Date();
  const today = cursor.toISOString().slice(0, 10);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  const yesterday = cursor.toISOString().slice(0, 10);
  if (days[0] !== today && days[0] !== yesterday) return 0;
  let streak = 1;
  for (let index = 1; index < days.length; index += 1) {
    const newer = new Date(`${days[index - 1]}T00:00:00Z`).getTime();
    const older = new Date(`${days[index]}T00:00:00Z`).getTime();
    if (newer - older !== 86_400_000) break;
    streak += 1;
  }
  return streak;
}

function periodDays(attempts: Attempt[]) {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const uniqueDates = [...new Set(attempts.map(attempt => attempt.created_at.slice(0, 10)))].map(value => new Date(`${value}T00:00:00Z`));
  return { weekly: uniqueDates.filter(date => date >= monday && date <= now).length, monthly: uniqueDates.filter(date => date >= monthStart && date <= now).length };
}

export function ReaderDashboard({ view, hindi, refresh, onPractice }: {
  view: "leaderboard" | "progress";
  hindi: boolean;
  refresh: string;
  onPractice: () => void;
}) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [quizLeaders, setQuizLeaders] = useState<Leader[]>([]);
  const [overallLeaders, setOverallLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const supabase = createClient();
        const [
          { data: leaderboard, error: leaderboardError },
          { data: quizLeaderboard, error: quizError },
          { data: overallLeaderboard, error: overallError },
          { data: auth, error: authError },
        ] = await Promise.all([
          supabase.rpc("practice_leaderboard"),
          supabase.rpc("quiz_leaderboard"),
          supabase.rpc("overall_leaderboard"),
          supabase.auth.getUser(),
        ]);
        if (leaderboardError) throw leaderboardError;
        if (quizError) throw quizError;
        if (overallError) throw overallError;
        if (authError && authError.name !== "AuthSessionMissingError") throw authError;
        let history: Attempt[] = [];
        if (auth.user) {
          const { data, error: historyError } = await supabase
            .from("reading_attempts")
            .select("created_at,passage_title,total_score,accuracy,fluency,completion,words_per_minute")
            .order("created_at", { ascending: true })
            .limit(100);
          if (historyError) throw historyError;
          history = data ?? [];
        }
        if (!cancelled) {
          setLeaders(leaderboard ?? []);
          setQuizLeaders(quizLeaderboard ?? []);
          setOverallLeaders(overallLeaderboard ?? []);
          setAttempts(history);
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setLeaders([]);
          setQuizLeaders([]);
          setOverallLeaders([]);
          setAttempts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [refresh, reloadKey]);

  const summary = useMemo(() => {
    const latest = attempts.at(-1);
    const best = attempts.reduce((value, attempt) => Math.max(value, attempt.total_score), 0);
    const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.total_score, 0) / attempts.length) : 0;
    return { latest, best, average, streak: streakDays(attempts), ...periodDays(attempts) };
  }, [attempts]);

  if (loading) return <section className="dashboard-empty" role="status"><span className="dashboard-spinner" aria-hidden="true" />{hindi ? "डेटा लोड हो रहा है…" : "Loading your reading data…"}</section>;
  if (loadError) return <section className="dashboard-empty" role="alert"><p>{hindi ? "रीडिंग डेटा अभी उपलब्ध नहीं है। कृपया दोबारा कोशिश करें।" : "Reading data is temporarily unavailable. Please try again."}</p><button onClick={() => setReloadKey(value => value + 1)}>{hindi ? "फिर कोशिश करें" : "Try again"}</button></section>;

  if (view === "leaderboard") {
    const average = leaders.length ? Math.round(leaders.reduce((sum, row) => sum + row.best_score, 0) / leaders.length) : 0;
    return <section className="dashboard-view">
      <ViewHeading eyebrow={hindi ? "साथ पढ़ें, आगे बढ़ें" : "READ TOGETHER, GROW TOGETHER"} title={hindi ? "लीडरबोर्ड" : "Leaderboard"} subtitle={hindi ? "हर सहभागी का सबसे अच्छा सत्यापित अभ्यास स्कोर।" : "Each participating reader’s best saved practice score."} />
      <div className="insight-grid">
        <Insight icon={<Users />} label={hindi ? "पाठक" : "Readers"} value={leaders.length} />
        <Insight icon={<Medal />} label={hindi ? "शीर्ष स्कोर" : "Top score"} value={leaders[0]?.best_score ?? 0} />
        <Insight icon={<BarChart3 />} label={hindi ? "औसत स्कोर" : "Average"} value={average} />
      </div>
      <div className="leaderboard-grid">
        <LeaderboardChart hindi={hindi} title={hindi ? "पठन स्कोर" : "Passage reading"} chartClass="" leaders={leaders} filename="rajkamal-reading-leaderboard.csv" empty={hindi ? "अभी कोई सत्यापित पठन स्कोर नहीं है।" : "No verified reading scores yet."} onPractice={onPractice} />
        <LeaderboardChart hindi={hindi} title={hindi ? "क्विज़ स्कोर" : "Quiz"} chartClass="chart-quiz" leaders={quizLeaders} filename="rajkamal-quiz-leaderboard.csv" empty={hindi ? "अभी कोई क्विज़ स्कोर नहीं है।" : "No quiz scores yet."} onPractice={onPractice} />
        <LeaderboardChart hindi={hindi} title={hindi ? "कुल मिलाकर" : "Overall"} chartClass="chart-overall" leaders={overallLeaders} filename="rajkamal-overall-leaderboard.csv" empty={hindi ? "अभी कोई कुल स्कोर नहीं है।" : "No combined scores yet."} onPractice={onPractice} />
      </div>
    </section>;
  }

  const recent = attempts.slice(-7);
  const nextReward = summary.streak < 21 ? 21 : summary.streak < 100 ? 100 : 365;
  return <section className="dashboard-view">
    <ViewHeading eyebrow={hindi ? "हर अभ्यास मायने रखता है" : "EVERY PRACTICE COUNTS"} title={hindi ? "मेरी प्रगति" : "My progress"} subtitle={hindi ? "अपनी पढ़ने की आदत और सुधार को समझें।" : "Understand your reading habit and improvement."} />
    <div className="progress-summary">
      <Insight icon={<Award />} label={hindi ? "सर्वश्रेष्ठ" : "Best score"} value={`${summary.best}/100`} />
      <Insight icon={<BookOpen />} label={hindi ? "पूरे पाठ" : "Lessons"} value={attempts.length} />
      <Insight icon={<Flame />} label={hindi ? "मौजूदा स्ट्रीक" : "Current streak"} value={`${summary.streak} ${hindi ? "दिन" : "days"}`} />
      <Insight icon={<TrendingUp />} label={hindi ? "औसत" : "Average"} value={`${summary.average}/100`} />
    </div>
    <section className="reward-panel">
      <div><p>{hindi ? "राजकमल रीडिंग रिवार्ड्स" : "RAJKAMAL READING REWARDS"}</p><h2>{hindi ? `${summary.streak} दिन की स्ट्रीक` : `${summary.streak}-day streak`}</h2><span>{hindi ? `${nextReward - summary.streak} दिन और पढ़ें और अगला रिवार्ड अनलॉक करें।` : `Read ${nextReward - summary.streak} more days to unlock the next reward.`}</span></div>
      <div className="streak-periods dashboard-periods"><article><b>{summary.weekly}/7</b><span>{hindi ? "इस हफ्ते सक्रिय दिन" : "Active days this week"}</span></article><article><b>{summary.monthly}</b><span>{hindi ? "इस महीने सक्रिय दिन" : "Active days this month"}</span></article></div>
      <div className="reward-track"><span style={{ width: `${Math.min(100, summary.streak / nextReward * 100)}%` }} /></div>
      <div className="reward-levels">{[21, 100, 365].map((days) => <article key={days} className={summary.streak >= days ? "unlocked" : ""}><b>{days}</b><span>{hindi ? "दिन" : "days"}</span><small>{days === 21 ? (hindi ? "पहला पुस्तक ऑफ़र" : "First book offer") : days === 100 ? (hindi ? "विशेष पाठक ऑफ़र" : "Special reader offer") : (hindi ? "वार्षिक सम्मान" : "Annual recognition")}</small></article>)}</div>
    </section>
    <div className="progress-grid">
      <section className="dashboard-card"><div className="card-heading"><h2>{hindi ? "स्कोर की यात्रा" : "Score journey"}</h2><button onClick={() => downloadCsv("my-reading-progress.csv", [["Date", "Passage", "Score", "Accuracy", "Fluency", "Completion", "WPM"], ...attempts.map((row) => [row.created_at, row.passage_title, row.total_score, row.accuracy, row.fluency, row.completion, row.words_per_minute])])}><Download />CSV</button></div>{!recent.length ? <Empty hindi={hindi} onPractice={onPractice} /> : <div className="score-chart">{recent.map((row) => <div key={row.created_at} style={{ height: `${Math.max(8, row.total_score)}%` }}><span>{row.total_score}</span></div>)}</div>}</section>
      <section className="dashboard-card"><h2>{hindi ? "हाल के अभ्यास" : "Recent practice"}</h2>{!recent.length ? <Empty hindi={hindi} onPractice={onPractice} /> : <ul className="recent-list">{[...recent].reverse().map((row) => <li key={row.created_at}><span><strong>{row.passage_title}</strong><small>{new Date(row.created_at).toLocaleDateString(hindi ? "hi-IN" : "en-IN")}</small></span><b>{row.total_score}/100</b></li>)}</ul>}</section>
    </div>
  </section>;
}

function ViewHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="view-heading"><div><p>{eyebrow}</p><h1>{title}</h1><span>{subtitle}</span></div></div>;
}

function Insight({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <article className="insight-card"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

function LeaderboardChart({ hindi, title, chartClass, leaders, filename, empty, onPractice }: {
  hindi: boolean;
  title: string;
  chartClass: string;
  leaders: Leader[];
  filename: string;
  empty: string;
  onPractice: () => void;
}) {
  const top = leaders.slice(0, 8);
  return <div className="dashboard-card">
    <div className="card-heading"><h2>{title}</h2><button onClick={() => downloadCsv(filename, [["Rank", "Reader", "Score"], ...leaders.map((row, index) => [index + 1, row.reader_label, row.best_score])])}><Download />{hindi ? "डाउनलोड" : "CSV"}</button></div>
    {!leaders.length ? <Empty hindi={hindi} onPractice={onPractice} /> : <>
      <div className="mini-chart">{top.map((row) => <div key={row.reader_label} className={chartClass} style={{ height: `${Math.max(6, row.best_score)}%` }}><span>{row.best_score}</span></div>)}</div>
      <ol className="mini-leader-list">{leaders.slice(0, 5).map((row, index) => <li key={`${index}-${row.reader_label}`}><span className="rank">#{index + 1}</span><strong>{row.reader_label}</strong><b>{row.best_score}</b></li>)}</ol>
    </>}
  </div>;
}

function Empty({ hindi, onPractice }: { hindi: boolean; onPractice: () => void }) {
  return <div className="empty-state"><p>{hindi ? "अभी कोई अभ्यास सहेजा नहीं गया है।" : "No saved practice yet."}</p><button onClick={onPractice}>{hindi ? "पढ़ना शुरू करें" : "Start reading"}</button></div>;
}
