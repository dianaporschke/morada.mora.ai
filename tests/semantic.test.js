import test from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV4 } from 'ai/test';
import { extractUnderstanding, generateUnderstanding } from '../lib/mora/understanding.js';
import { processTurn } from '../lib/mora/engine.js';
import { emptyUnderstanding } from '../lib/mora/schema.js';

test('SDK structured output contract passes signed context to the model and validates the result', async () => {
  let captured;
  const expected = emptyUnderstanding({ equipment:'heater', intent:'issue', newIssue:false, confidence:'clear', category:'heating', subcategory:null,
    description:null, location:null, since:'seit gestern', extent:null, details:null, urgency:'normal', hazard:'none' });
  const model = new MockLanguageModelV4({ doGenerate:async options => {
    captured = options;
    return { content:[{type:'text',text:JSON.stringify(expected)}], finishReason:{unified:'stop',raw:'stop'},
      usage:{ inputTokens:{total:100,noCache:100,cacheRead:0,cacheWrite:0}, outputTokens:{total:80,text:80,reasoning:0} }, warnings:[] };
  } });
  const state = { history:[{role:'user',content:'Meine Heizung funktioniert nicht.'},{role:'assistant',content:'Seit wann?'}],
    issue:{id:'issue1',category:'heating',description:'Meine Heizung funktioniert nicht.'}, pendingKey:'since' };
  const result = await generateUnderstanding('seit gestern', state, model);
  assert.equal(result.since,'seit gestern'); assert.equal(result.category,'heating');
  assert.match(JSON.stringify(captured.prompt), /Meine Heizung funktioniert nicht/);
  assert.match(JSON.stringify(captured.prompt), /pendingQuestion/);
  assert.equal(captured.responseFormat.type,'json');
  assert.ok(captured.responseFormat.schema);
});

test('A semantic paraphrase without any original keyword gets the same qualification flow', async () => {
  const data = emptyUnderstanding({ equipment:'light', intent:'issue', newIssue:false, confidence:'clear', category:'electricity', subcategory:'Beleuchtung',
    description:'Beleuchtung fällt aus', location:'Flur', since:null, extent:null, details:null, urgency:'normal', hazard:'none' });
  const result = await processTurn({message:'Wenn ich den Schalter im Flur drücke bleibt es dunkel'}, null, async () => ({data,mode:'model'}));
  assert.equal(result.state.issue.category,'electricity'); assert.equal(result.state.issue.location,'Flur');
  assert.equal(result.state.pendingKey,'since'); assert.equal(result.understanding,'model');
});

test('Provider refusal keeps context usable, avoids repeated slow calls, and retries after the cooldown', async t => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;
  const originalOidc = process.env.VERCEL_OIDC_TOKEN;
  process.env.OPENAI_API_KEY = 'test-only-key';
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  let requests = 0;
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return new Response(JSON.stringify({ error:{ message:'Test provider refusal', type:'insufficient_quota', code:'insufficient_quota' } }), {
      status:429, headers:{ 'Content-Type':'application/json' },
    });
  });
  try {
    const first = await extractUnderstanding('heizung funktioniert nicht', null);
    assert.equal(first.mode, 'guided');
    assert.equal(first.availability.reason, 'insufficient_quota');
    const state = { issue:{ category:'heating' }, pendingKey:'since' };
    const second = await extractUnderstanding('seit gestern', state);
    assert.equal(requests, 1);
    assert.equal(second.data.category, 'heating');
    assert.equal(second.data.since, 'seit gestern');
    now += 61_000;
    await extractUnderstanding('alle heizkörper', { ...state, pendingKey:'extent' });
    assert.equal(requests, 2);
  } finally {
    for (const [key, value] of Object.entries({ OPENAI_API_KEY:originalKey, AI_GATEWAY_API_KEY:originalGatewayKey, VERCEL_OIDC_TOKEN:originalOidc })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
