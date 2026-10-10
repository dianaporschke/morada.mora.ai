import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProvider, classifyModelError, safeUsage } from '../lib/mora/provider.js';
import { modelContext } from '../lib/mora/context.js';
import { createUnderstandingService, generateUnderstanding } from '../lib/mora/understanding.js';
import { emptyUnderstanding } from '../lib/mora/schema.js';

test('Explicit OpenAI selection bypasses Vercel OIDC and does not switch provider automatically', async () => {
  let oidcReads = 0;
  const selection = await resolveProvider({MORA_AI_PROVIDER:'openai', OPENAI_API_KEY:'test', VERCEL_OIDC_TOKEN:'test-oidc'}, async () => {oidcReads++; return 'token';});
  assert.equal(selection.provider, 'openai'); assert.equal(selection.model, 'gpt-5.4-mini');
  assert.equal(selection.ready, true); assert.equal(oidcReads, 0);
  const unavailable = await resolveProvider({MORA_AI_PROVIDER:'openai', AI_GATEWAY_API_KEY:'test'}, async () => 'token');
  assert.equal(unavailable.ready, false); assert.equal(unavailable.availability.reason, 'missing_credentials');
});

test('Auto retains existing Gateway preference, and request-scoped OIDC is recognised', async () => {
  const selection = await resolveProvider({OPENAI_API_KEY:'test'}, async () => 'oidc-token');
  assert.equal(selection.provider, 'gateway'); assert.equal(selection.model, 'openai/gpt-6-luna');
  assert.equal(selection.ready, true);
  const direct = await resolveProvider({OPENAI_API_KEY:'test'}, async () => {throw new Error('No OIDC');});
  assert.equal(direct.provider, 'openai');
  assert.ok(!JSON.stringify(selection).includes('oidc-token'));
});

test('Gateway SDK labels an OIDC token as OIDC rather than an API key', async t => {
  const saved = Object.fromEntries(['AI_GATEWAY_API_KEY','VERCEL_OIDC_TOKEN','VERCEL_OIDC_TOKEN_FILE'].map(key => [key,process.env[key]]));
  delete process.env.AI_GATEWAY_API_KEY; delete process.env.VERCEL_OIDC_TOKEN_FILE;
  process.env.VERCEL_OIDC_TOKEN = `e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic`;
  const authMethods = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    authMethods.push(new Headers(options?.headers).get('ai-gateway-auth-method'));
    return new Response(JSON.stringify({error:{type:'no_providers_available',message:'Synthetic refusal'}}),
      {status:403,headers:{'Content-Type':'application/json'}});
  });
  try {
    const selection = await resolveProvider();
    assert.equal(selection.provider, 'gateway');
    await assert.rejects(generateUnderstanding('Synthetische Anfrage', null, selection.createModel()));
    assert.ok(authMethods.length > 0); assert.ok(authMethods.every(method => method === 'oidc'));
  } finally {
    for (const [key,value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('Invalid provider/model configuration and absent credentials never call a model', async () => {
  for (const env of [{MORA_AI_PROVIDER:'other'}, {MORA_AI_PROVIDER:'gateway',AI_GATEWAY_MODEL:'unqualified'}, {MORA_AI_PROVIDER:'openai',OPENAI_MODEL:'bad model'}, {MORA_AI_PROVIDER:'openai'}]) {
    const selection = await resolveProvider(env, async () => {throw new Error('No OIDC');});
    assert.equal(selection.ready, false); assert.equal(selection.createModel, null);
    assert.ok(selection.availability.reason);
  }
});

test('Provider diagnostics preserve precise machine codes and exclude secrets and customer data', () => {
  const selection = {provider:'gateway',model:'openai/test'};
  const error = {statusCode:403, message:'payment method customer-private secret-key',
    responseBody:JSON.stringify({error:{type:'no_providers_available',message:'private'}})};
  assert.deepEqual(classifyModelError(error, selection), {...selection,status:403,reason:'no_providers_available'});
  for (const [error, reason] of [
    [{statusCode:429},'rate_limit_or_quota'], [{statusCode:429,data:{error:{code:'insufficient_quota'}}},'insufficient_quota'],
    [{statusCode:401},'authentication_failed'], [{statusCode:404},'model_not_found'],
    [{name:'TimeoutError'},'model_timeout'], [{name:'AI_NoObjectGeneratedError'},'invalid_model_output'],
    [{statusCode:403,type:'PRIVATE DATA <secret>'},'access_denied'],
  ]) assert.equal(classifyModelError(error, selection).reason, reason);
  assert.deepEqual(safeUsage({inputTokens:100,outputTokens:50,raw:{secret:'key'},inputTokenDetails:{cacheReadTokens:12},outputTokenDetails:{reasoningTokens:20}}),
    {inputTokens:100,outputTokens:50,cachedInputTokens:12,reasoningTokens:20});
});

test('Cooldown is isolated by provider/model; strict mode fails instead of pretending guided output is AI', async t => {
  t.mock.method(console, 'warn', () => {});
  const env = {MORA_AI_REQUIRED:'false',model:'model-a'};
  let calls = 0, clock = 1000;
  const understand = createUnderstandingService({env, now:() => clock, log() {},
    resolve:async () => ({provider:'gateway',model:env.model,ready:true,createModel:() => ({})}),
    generate:async () => {calls++; throw {statusCode:403,data:{error:{type:'no_providers_available'}}};},
  });
  assert.equal((await understand('heizung kaputt', null)).mode, 'guided');
  await understand('seit gestern', {issue:{category:'heating'},pendingKey:'since'});
  assert.equal(calls, 1);
  env.MORA_AI_REQUIRED = 'true';
  await assert.rejects(understand('nochmals', null), error => error.code === 'MODEL_UNAVAILABLE' && error.availability.reason === 'no_providers_available');
  assert.equal(calls, 1);
  env.model = 'model-b'; await assert.rejects(understand('nochmals', null), {code:'MODEL_UNAVAILABLE'}); assert.equal(calls, 2);
  clock += 61000; await assert.rejects(understand('nochmals', null), {code:'MODEL_UNAVAILABLE'}); assert.equal(calls, 3);
});

test('Strict mode requires credentials, and successful generation reports actual usage', async () => {
  let generated = 0;
  const missing = createUnderstandingService({env:{MORA_AI_REQUIRED:'true'},
    resolve:async () => ({ready:false,availability:{reason:'missing_credentials'}}),
    generate:async () => {generated++;},
  });
  await assert.rejects(missing('Hallo', null), {code:'MODEL_UNAVAILABLE'}); assert.equal(generated, 0);
  let logged;
  const model = createUnderstandingService({env:{}, resolve:async () => ({ready:true,provider:'openai',model:'test',createModel:() => ({})}),
    generate:async () => ({data:emptyUnderstanding({intent:'knowledge',answer:'Allgemeine Erklärung'}),usage:{inputTokens:300,outputTokens:80}}),
    log:(operation, selection, usage) => {logged={operation,provider:selection.provider,usage};},
  });
  const result = await model('Eine Wissensfrage', null);
  assert.equal(result.mode, 'model'); assert.equal(result.usage.inputTokens, 300);
  assert.equal(logged.operation, 'understanding');
});

test('Bounded context retains signed facts while excluding photos, archives and excess history', () => {
  const state = {issue:{id:'a',equipment:'heater',count:2,details:'confirmed',attachments:[{name:'PRIVATE.jpg'}],answers:[{answer:'ARCHIVE'}]},
    history:Array.from({length:24}, (_, i) => ({role:i % 2 ? 'assistant' : 'user',content:`${i} ` + 'x'.repeat(1990)})),
    pendingKey:'since', issues:[{id:'a',category:'heating',location:'Küche',attachments:[{name:'PRIVATE.jpg'}]}]};
  const context = modelContext(state);
  assert.ok(context.history.reduce((n, item) => n + item.content.length, 0) <= 12000);
  assert.equal(context.activeIssue.count, 2); assert.equal(context.pendingQuestion, 'since');
  assert.equal(context.knownIssues[0].location, 'Küche');
  assert.ok(!JSON.stringify(context).includes('PRIVATE')); assert.ok(!JSON.stringify(context).includes('ARCHIVE'));
  assert.match(context.history.at(-1).content, /^23 /);
});
