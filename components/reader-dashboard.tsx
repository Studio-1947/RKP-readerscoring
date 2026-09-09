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
  let streak = 1;
  for (let index = 1; index < days.length; index += 1) {
    const newer = new Date(`${days[index - 1]}T00:00:00Z`).getTime();
    const older = new Date(`${days[index]}T00:00:00Z`).getTime();
    if (newer - older !== 86_400_000) break;
    streak += 1;
  }
  return streak;
}

export function ReaderDashboard({ view, hindi, refresh, onPractice }: {
  view: "leaderboard" | "progress";
  hindi: boolean;
  refresh: string;
  onPractice: () => void;
}) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const supabase = createClient();
        const [{ data: leaderboard }, { data: auth }] = await Promise.all([
          supabase.rpc("practice_leaderboard"),
          supabase.auth.getUser(),
        ]);
        let history: Attempt[] = [];
        if (auth.user) {
          const { data } = await supabase
            .from("reading_attempts")
            .select("created_at,passage_title,total_score,accuracy,fluency,completion,words_per_minute")
            .order("created_at", { ascending: true })
            .limit(100);
          history = data ?? [];
        }
        if (!cancelled) {
          setLeaders(leaderboard ?? []);
          setAttempts(history);
        }
      } catch {
        if (!cancelled) {
          setLeaders([]);
          setAttempts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [refresh]);

  const summary = useMemo(() => {
    const latest = attempts.at(-1);
    const best = attempts.reduce((value, attempt) => Math.max(value, attempt.total_score), 0);
    const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.total_score, 0) / attempts.length) : 0;
    return { latest, best, average, streak: streakDays(attempts) };
  }, [attempts]);

  if (loading) return <section className="dashboard-empty">{hindi ? "डेटा लोड हो रहा है…" : "Loading your reading data…"}</section>;

  if (view === "leaderboard") {
    const average = leaders.length ? Math.round(leaders.reduce((sum, row) => sum + row.best_score, 0) / leaders.length) : 0;
    return <section className="dashboard-view">
      <ViewHeading eyebrow={hindi ? "साथ पढ़ें, आगे बढ़ें" : "READ TOGETHER, GROW TOGETHER"} title={hindi ? "लीडरबोर्ड" : "Leaderboard"} subtitle={hindi ? "हर सहभागी का सबसे अच्छा सत्यापित अभ्यास स्कोर।" : "Each participating reader’s best saved practice score."} />
      <div className="insight-grid">
        <Insight icon={<Users />} label={hindi ? "पाठक" : "Readers"} value={leaders.length} />
        <Insight icon={<Medal />} label={hindi ? "शीर्ष स्कोर" : "Top score"} value={leaders[0]?.best_score ?? 0} />
        <Insight icon={<BarChart3 />} label={hindi ? "औसत स्कोर" : "Average"} value={average} />
      </div>
      <div className="dashboard-card">
        <div className="card-heading"><h2>{hindi ? "सभी पाठक" : "All readers"}</h2><button onClick={() => downloadCsv("rajkamal-leaderboard.csv", [["Rank", "Reader", "Best score"], ...leaders.map((row, index) => [index + 1, row.reader_label, row.best_score])])}><Download />{hindi ? "डाउनलोड" : "Download"}</button></div>
        {!leaders.length ? <Empty hindi={hindi} onPractice={onPractice} /> : <ol className="leader-list">{leaders.map((row, index) => <li key={row.reader_label}><span className="rank">#{index + 1}</span><span className="avatar">{row.reader_label.at(-1)}</span><strong>{row.reader_label}</strong><b>{row.best_score}<small>/100</small></b></li>)}</ol>}
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

function Empty({ hindi, onPractice }: { hindi: boolean; onPractice: () => void }) {
  return <div className="empty-state"><p>{hindi ? "अभी कोई अभ्यास सहेजा नहीं गया है।" : "No saved practice yet."}</p><button onClick={onPractice}>{hindi ? "पढ़ना शुरू करें" : "Start reading"}</button></div>;
}
