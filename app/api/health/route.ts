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
