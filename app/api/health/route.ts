import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const urlLen = url ? url.length : 0;
  const keyLen = key ? key.length : 0;
  const urlHost = url ? new URL(url).hostname : "NONE";

  let rpcResult = null;
  let rpcError = null;

  if (url && key) {
    try {
      const supabase = createClient(url, key);
      const { data, error } = await supabase.rpc("practice_leaderboard");
      rpcResult = data;
      rpcError = error;
    } catch (err) {
      rpcError = String(err);
    }
  }

  return Response.json({
    supabaseConfigured: Boolean(url && key && urlLen > 5 && keyLen > 10),
    urlHost,
    urlLength: urlLen,
    keyLength: keyLen,
    rpcResult,
    rpcError,
  });
}

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(url, key);

  try {
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError || !authData.user) {
      return Response.json({ stage: "auth", error: authError?.message || "No user returned" }, { status: 500 });
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabase.from("reader_profiles").upsert({
      id: userId,
      full_name: "Rajkamal Reader",
      age: 25,
      phone: "9876543210",
      email: "reader@rajkamal.in",
      place: "New Delhi",
      consented_at: new Date().toISOString(),
      leaderboard_opt_in: true,
    });

    if (profileError) {
      return Response.json({ stage: "profile", error: profileError.message }, { status: 500 });
    }

    const { error: attemptError } = await supabase.from("reading_attempts").insert({
      reader_id: userId,
      passage_id: "test-passage-1",
      passage_title: "गोदान",
      passage_sequence: 1,
      transcript: "होरी ने देखा कि सहसा सड़क पर दूर से एक गाड़ी आती हुई दिखाई दी।",
      duration_seconds: 25,
      accuracy: 96,
      fluency: 92,
      completion: 100,
      words_per_minute: 135,
      total_score: 95,
      scoring_source: "server",
    });

    if (attemptError) {
      return Response.json({ stage: "attempt", error: attemptError.message }, { status: 500 });
    }

    const { data: leaderboard, error: lbError } = await supabase.rpc("practice_leaderboard");

    return Response.json({
      success: true,
      userId,
      leaderboard,
      lbError,
    });
  } catch (err) {
    return Response.json({ stage: "catch", error: String(err) }, { status: 500 });
  }
}

