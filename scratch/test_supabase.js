const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const lines = env.split('\n');
const envMap = {};
lines.forEach(l => {
  const parts = l.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    envMap[k] = v;
  }
});

const url = envMap.NEXT_PUBLIC_SUPABASE_URL;
const key = envMap.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || envMap.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', url);
console.log('KEY:', key ? key.slice(0, 20) + '...' : 'NONE');

if (!url || !key) {
  console.error('Supabase URL or Key missing!');
  process.exit(1);
}

const supabase = createClient(url, key);

async function testSupabase() {
  console.log('\n--- 1. Testing practice_leaderboard RPC ---');
  const { data: lb, error: lbErr } = await supabase.rpc('practice_leaderboard');
  console.log('Leaderboard Data:', lb, 'Error:', lbErr);

  console.log('\n--- 2. Testing Anonymous Auth ---');
  const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
  console.log('Auth User ID:', authData?.user?.id, 'Error:', authErr);

  if (authData?.user) {
    const userId = authData.user.id;
    console.log('\n--- 3. Testing reader_profiles Upsert ---');
    const { data: pData, error: pErr } = await supabase.from('reader_profiles').upsert({
      id: userId,
      full_name: 'Raj Test Reader',
      age: 28,
      phone: '9876543210',
      email: 'test@example.com',
      place: 'New Delhi',
      consented_at: new Date().toISOString(),
      leaderboard_opt_in: true
    }).select();
    console.log('Profile Upsert Res:', pData, 'Error:', pErr);

    console.log('\n--- 4. Testing reading_attempts Insert ---');
    const { data: aData, error: aErr } = await supabase.from('reading_attempts').insert({
      reader_id: userId,
      passage_id: 'test-1',
      passage_title: 'राजकमल परीक्षण',
      passage_sequence: 1,
      transcript: 'यह एक परीक्षण पाठ है।',
      duration_seconds: 15,
      accuracy: 98,
      fluency: 95,
      completion: 100,
      words_per_minute: 130,
      total_score: 96,
      scoring_source: 'server'
    }).select();
    console.log('Attempt Insert Res:', aData, 'Error:', aErr);

    console.log('\n--- 5. Re-testing practice_leaderboard RPC after insert ---');
    const { data: lb2, error: lbErr2 } = await supabase.rpc('practice_leaderboard');
    console.log('Updated Leaderboard Data:', lb2, 'Error:', lbErr2);
  }
}

testSupabase();
