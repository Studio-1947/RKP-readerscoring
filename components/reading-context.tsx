"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function ScoreGuide({ hindi }: { hindi: boolean }) {
  const rows = hindi ? [
    ["शब्दों की शुद्धता", "65%", "पहचाने गए शब्दों का मूल पाठ से मिलान। छूटे, अतिरिक्त या बदले शब्द अंक घटाते हैं।"],
    ["पढ़ने की गति", "20%", "115 शब्द/मिनट पर अधिकतम अंक। हर शब्द/मिनट के अंतर पर इस माप से 1.45 अंक घटते हैं। पाँच से कम शब्दों पर शून्य।"],
    ["पाठ की मात्रा", "10%", "पहचाने गए शब्द ÷ पाठ के शब्द, अधिकतम 100%। यह सही शब्दों का माप नहीं है।"],
    ["प्रयास", "5%", "पहले प्रयास पर 100। हर दोबारा प्रयास पर 12 कम, न्यूनतम 50। पेज दोबारा खोलने पर रीसेट।"],
  ] : [
    ["Word accuracy", "65%", "Recognized words are compared with the passage. Missing, extra and replaced words reduce accuracy."],
    ["Reading pace", "20%", "Peaks at 115 words/minute. Each WPM away deducts 1.45 metric points. Fewer than five words earns zero."],
    ["Passage coverage", "10%", "Recognized word count divided by passage word count, capped at 100%. This does not measure correctness."],
    ["Attempts", "5%", "Starts at 100, drops 12 per retry, with a floor of 50. Resets when you reload the page."],
  ];
  return <details className="mt-5 rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
    <summary className="cursor-pointer text-sm font-semibold">{hindi ? "स्कोर कैसे बनता है?" : "How is the score calculated?"}</summary>
    <p className="mt-3 text-sm text-stone-600">{hindi ? "हर माप 0–100। भार के अनुसार जोड़कर निकटतम पूरे अंक में कुल स्कोर बनता है।" : "Each metric is 0–100. We multiply by these weights, add them and round to a whole-number score."}</p>
    <dl className="mt-4 divide-y divide-stone-100">{rows.map(([name, weight, explanation]) => <div key={name} className="py-3">
      <dt className="flex justify-between gap-3 text-sm font-semibold"><span>{name}</span><span className="text-[#b42332]">{weight}</span></dt>
      <dd className="mt-1 text-sm leading-6 text-stone-600">{explanation}</dd>
    </div>)}</dl>
    <p className="mt-3 text-xs leading-5 text-stone-500">{hindi ? "यह अभ्यास का अनुमान है, उच्चारण की जाँच नहीं। माइक्रोफ़ोन, इंटरनेट और browser की पहचान परिणाम को प्रभावित करते हैं।" : "This is a practice estimate, not a pronunciation assessment. Microphone quality, connection and browser recognition affect the result."}</p>
  </details>;
}

export function Leaderboard({ hindi, refresh }: { hindi: boolean; refresh: string }) {
  const [entries, setEntries] = useState<{ reader_label: string; best_score: number }[]>([]);
  const [state, setState] = useState("loading");
  useEffect(() => {
    let cancelled = false;
    async function read() {
      try {
        const { data, error } = await createClient().rpc("practice_leaderboard");
        if (cancelled) return;
        if (error) { setState("error"); return; }
        setEntries(data || []); setState("ready");
      } catch { if (!cancelled) setState("error"); }
    }
    void read();
    return () => { cancelled = true; };
  }, [refresh]);
  return <section className="mt-6 rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
    <h2 className="serif text-xl font-bold">{hindi ? "पाठक सूची" : "Reader leaderboard"}</h2>
    <p className="mt-2 text-xs leading-5 text-stone-500">{hindi ? "सभी पाठों में हर सहभागी का सर्वश्रेष्ठ स्कोर। बराबर स्कोर पर समान स्थान। browser स्कोर सत्यापित नहीं हैं।" : "One best score per participating reader across all passages. Equal scores share a rank. Browser scores are unverified."}</p>
    {state === "loading" ? <p className="mt-4 text-sm">{hindi ? "लोड हो रहा है…" : "Loading…"}</p>
      : state === "error" ? <p className="mt-4 text-sm">{hindi ? "सूची अभी उपलब्ध नहीं है। बाद में फिर देखें।" : "The leaderboard is temporarily unavailable."}</p>
      : !entries.length ? <p className="mt-4 text-sm text-stone-600">{hindi ? "अभी कोई सहभागी नहीं। पाठ पूरा करें और जुड़ें।" : "No entries yet. Complete a reading and opt in to join."}</p>
      : <ol className="mt-4 divide-y divide-stone-100">{entries.map((entry) => <li key={entry.reader_label} className="flex items-center gap-3 py-3 text-sm">
        <span className="w-7 font-semibold text-[#b42332]">{entries.findIndex(row => row.best_score === entry.best_score) + 1}</span>
        <span className="min-w-0 flex-1 truncate">{entry.reader_label}</span><span className="font-semibold tabular-nums">{entry.best_score}<span className="font-normal text-stone-400"> / 100</span></span>
      </li>)}</ol>}
  </section>;
}
