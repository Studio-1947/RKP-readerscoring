const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return values;
}

const env = { ...loadEnv(path.join(__dirname, '.env.local')), ...process.env };
const restUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;

async function request(endpoint, options = {}) {
  const response = await fetch(`${restUrl}/${endpoint}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(await response.text());
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function run() {
  console.log('Deleting existing Hindi Literature MCQ Quiz...');
  await request('admin_quizzes?title_en=eq.Hindi%20Literature%20MCQ%20Quiz', {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  console.log('Deleted.');
}

run().catch(console.error);
