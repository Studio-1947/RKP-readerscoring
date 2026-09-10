import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual component's recognition handler with fake browser events.
// These are lifecycle regression tests, not microphone/recognition-service E2E.
const source = readFileSync(new URL('../components/open-reader.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('reader.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'startBrowserRecognition') handler = node.getText(parsed);
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(handler);
const code = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function setup(supported = true) {
  const instances = [];
  const timers = [];
  class Recognition {
    constructor() { instances.push(this); }
    start() { this.onstart?.(); }
  }
  const ref = current => ({ current });
  const context = {
    window: supported ? { SpeechRecognition: Recognition } : {},
    language: 'en', t: { noSpeechHint: 'no speech', networkError: 'network', serviceBlocked: 'blocked' },
    browserRecognition: ref(null), browserFinalTranscript: ref(''), browserLatestTranscript: ref(''),
    recognitionFinish: ref(Promise.resolve()), resolveRecognitionFinish: ref(null),
    recognitionRetries: ref(0), recognitionRestart: ref(null), stoppedAt: ref(0),
    mediaRecorder: ref({ state: 'recording' }), micLog() {},
    setBrowserHint(value) { context.hint = value; }, setTranscript(value) { context.transcript = value; },
    setTimeout(fn) { timers.push(fn); return timers.length; },
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  context.startBrowserRecognition();
  return { context, instances, timers };
}
const result = (text, isFinal) => ({ isFinal, 0: { transcript: text } });

test('updates interim results without duplicating final words', () => {
  const { context, instances } = setup();
  instances[0].onresult({ results: [result('नमस्ते', true), result('दुनिया', false)] });
  instances[0].onresult({ results: [result('नमस्ते', true), result('दुनिया', true)] });
  assert.equal(context.transcript, 'नमस्ते दुनिया');
});
test('restarts after network failure and preserves final text', () => {
  const { context, instances, timers } = setup();
  instances[0].onresult({ results: [result('नमस्ते', true)] });
  instances[0].onerror({ error: 'network' });
  instances[0].onend(); timers.shift()();
  instances[1].onresult({ results: [result('दुनिया', true)] });
  assert.equal(context.browserLatestTranscript.current, 'नमस्ते दुनिया');
});
test('does not retry permission denial', () => {
  const { instances, timers } = setup();
  instances[0].onerror({ error: 'not-allowed' }); instances[0].onend();
  assert.equal(timers.length, 0);
});
test('bounds retries when no speech arrives', () => {
  const { instances, timers } = setup();
  for (let i = 0; i < 4; i++) {
    instances[i].onerror({ error: 'no-speech' }); instances[i].onend();
    timers.shift()?.();
  }
  assert.equal(instances.length, 4);
  assert.equal(timers.length, 0);
});
test('accepts last result before end and resolves finish without restarting', async () => {
  const { context, instances, timers } = setup();
  context.stoppedAt.current = 1;
  instances[0].onresult({ results: [result('अंतिम शब्द', true)] });
  instances[0].onend();
  await context.recognitionFinish.current;
  assert.equal(context.browserLatestTranscript.current, 'अंतिम शब्द');
  assert.equal(timers.length, 0);
});
test('unsupported browsers get an explicit message', () => {
  const { context, instances } = setup(false);
  assert.match(context.hint, /unavailable/);
  assert.equal(instances.length, 0);
});
