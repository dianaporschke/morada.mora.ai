import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadinessHandler } from '../api/ai-readiness.js';
import { resolveProvider, safeGenerationId, logModelUsage } from '../lib/mora/provider.js';
import { estimateTokenCost, conversationProfiles } from '../lib/mora/costs.js';
import { createUnderstandingService } from '../lib/mora/understanding.js';
import { processTurn } from '../lib/mora/engine.js';
import { emptyUnderstanding } from '../lib/mora/schema.js';
import { modelContext } from '../lib/mora/context.js';

async function invoke(handler, method='GET') {
  let status, body;
  await handler({method}, {setHeader(){},status(value){status=value;return this;},json(value){body=value;return this;}});
  return {status,body};
}
const preview = {VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/mora-ai-2.0',MORA_AI_CREDIT_CHECK:'true',MORA_AI_ENABLED:'false'};

test('Disabled AI never generates, including when valid-looking credentials exist', async () => {
  for (const provider of ['gateway','openai']) {
    const env = {MORA_AI_ENABLED:'false',MORA_AI_REQUIRED:'true',MORA_AI_PROVIDER:provider,AI_GATEWAY_API_KEY:'synthetic',OPENAI_API_KEY:'synthetic'};
    const selection = await resolveProvider(env);
    assert.equal(selection.ready,false); assert.equal(selection.availability.reason,'inference_disabled');
    assert.equal(selection.createModel,null);
    let calls = 0;
    const understand = createUnderstandingService({env,generate:async()=>{calls++;}});
    await assert.rejects(understand('Meine Steckdose funktioniert nicht.',null),{code:'MODEL_UNAVAILABLE'});
    assert.equal(calls,0);
  }
});

test('Credit audit is unavailable in production, other branches and without explicit opt-in', async () => {
  for (const env of [{...preview,VERCEL_ENV:'production'},{...preview,VERCEL_GIT_COMMIT_REF:'alex-portal'},{...preview,MORA_AI_CREDIT_CHECK:'false'}]) {
    let calls=0;
    const result = await invoke(createReadinessHandler({env,readCredits:async()=>{calls++;}}));
    assert.equal(result.status,404); assert.equal(calls,0);
  }
});

test('Read-only credit audit caches concurrent requests; balance does not prove free usage', async () => {
  let calls=0, clock=100000, logged;
  const handler = createReadinessHandler({env:preview,now:()=>clock,log:(message,data)=>{logged=data;},
    readCredits:async()=>{calls++;return {balance:'5.00',totalUsed:'1.25',secret:'private'};}});
  const results = await Promise.all([invoke(handler),invoke(handler)]);
  assert.equal(calls,1); assert.equal(results[0].status,200);
  assert.equal(results[0].body.freeUseVerified,false); assert.equal(results[0].body.inferenceEnabled,false);
  assert.equal(logged.balanceUsd,5); assert.equal(logged.totalUsedUsd,1.25);
  assert.ok(!JSON.stringify(results).includes('1.25')); assert.ok(!JSON.stringify(logged).includes('private'));
  assert.equal((await invoke(handler,'POST')).status,405); assert.equal(calls,1);
  clock+=61000; await invoke(handler); assert.equal(calls,2);
});

test('Credit failure returns safe machine codes and never exposes provider bodies', async () => {
  const result = await invoke(createReadinessHandler({env:preview,log(){},readCredits:async()=>{
    throw {statusCode:403,data:{error:{type:'customer_verification_required',message:'SECRET_CUSTOMER_BODY'}}};
  }}));
  assert.equal(result.status,503); assert.equal(result.body.reason,'customer_verification_required');
  assert.ok(!JSON.stringify(result).includes('SECRET_CUSTOMER_BODY')); assert.equal(result.body.inferenceStarted,false);
});

test('Costs count reasoning once, unknown usage stays unknown, metadata logs exclude secrets', t => {
  assert.equal(estimateTokenCost('openai/gpt-6-luna',conversationProfiles.average),0.0104);
  assert.equal(estimateTokenCost('gpt-6.1-sol',{inputTokens:80000,outputTokens:10000,outputTokenDetails:{reasoningTokens:2000}}),0.26);
  assert.equal(estimateTokenCost('other/model',{inputTokens:5,outputTokens:8}),null);
  assert.equal(estimateTokenCost('gpt-6-luna',{}),null);
  assert.equal(safeGenerationId({gateway:{generationId:'secret ?key=private'}}),null);
  let entry;
  t.mock.method(console,'info',(message,data)=>{entry=data;});
  logModelUsage('reply',{provider:'gateway',model:'openai/gpt-6-luna'},conversationProfiles.average,200,
    {gateway:{generationId:'gen_synthetic123',asyncJob:{webhookSigningSecret:'private'}}});
  assert.equal(entry.generationId,'gen_synthetic123'); assert.equal(entry.estimatedTokenCostUsd,0.0104);
  assert.ok(!JSON.stringify(entry).includes('private'));
});

test('Model-declared unknown fields survive context and suppress repeated questions; later facts replace them', async () => {
  const model = patch => async()=>({mode:'model',data:emptyUnderstanding({intent:'issue',confidence:'clear',...patch})});
  let turn = await processTurn({message:'Meine Steckdose funktioniert nicht.'},null,
    model({category:'electricity',equipment:'socket',location:'Wohnzimmer',extent:'Eine Steckdose',question:'since'}));
  assert.equal(turn.state.pendingKey,'since');
  turn = await processTurn({message:'Nein, ich meinte die im Schlafzimmer. Weiss nicht seit wann.'},turn.state,
    model({correction:true,location:'Schlafzimmer',unknownFields:['since'],question:'since'}));
  assert.equal(turn.state.issue.location,'Schlafzimmer'); assert.equal(turn.state.issue.since,null);
  assert.equal(turn.state.pendingKey,null);
  assert.deepEqual(modelContext(turn.state).activeIssue.unknownFields,['since']);
  turn = await processTurn({message:'Jetzt fällt es mir ein: seit gestern.'},turn.state,model({since:'seit gestern'}));
  assert.equal(turn.state.issue.since,'seit gestern'); assert.deepEqual(turn.state.issue.unknownFields,[]);
});
