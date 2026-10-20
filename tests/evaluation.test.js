// Mocked boundary checks; actual alternative-model evidence is stored separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvaluationHandler } from '../api/ai-evaluation.js';
import { emptyUnderstanding } from '../lib/mora/schema.js';
import { sealSession, readSession } from '../lib/mora/session.js';

const preview={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/mora-ai-2.0',MORA_AI_CREDIT_CHECK:'true',AI_GATEWAY_MODEL:'inception/mercury-2.5'};
async function call(handler,body,method='POST') {
  const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}};
  await handler({method,body},res);return res;
}
test('Evaluation never runs in production, main, or a non-authorized diagnostic environment',async()=>{
  let calls=0;
  for (const env of [{...preview,VERCEL_ENV:'production'},{...preview,VERCEL_GIT_COMMIT_REF:'main'},{...preview,MORA_AI_CREDIT_CHECK:'false'}]) {
    const result=await call(createEvaluationHandler({env,makeUnderstanding:()=>{calls++;}}),{model:'openai/gpt-6-luna',caseId:'01',turn:1});
    assert.equal(result.statusCode,404);
  }
  assert.equal(calls,0);
});
test('Evaluation accepts only fixed scenarios and an explicit model allowlist; arbitrary prompts and customer sessions are rejected',async()=>{
  let calls=0;const handler=createEvaluationHandler({env:preview,makeUnderstanding:()=>{calls++;}});
  for (const body of [
    {model:'attacker/paid-model',caseId:'01',turn:1},
    {model:'openai/gpt-6-luna',caseId:'S1',turn:1},
    {model:'openai/gpt-6-luna',caseId:'01',turn:1,message:'arbitrary customer text'},
    {model:'openai/gpt-6-luna',caseId:'01',turn:3},
  ]) assert.equal((await call(handler,body)).statusCode,400);
  const session=sealSession({version:2,history:[{role:'user',content:'Private customer message'}],actions:[],issues:[]});
  assert.equal((await call(handler,{model:'openai/gpt-6-luna',caseId:'01',turn:2,session})).statusCode,409);
  assert.equal(calls,0);
});
test('Synthetic evaluation keeps model selection local and binds every turn to its model and case',async()=>{
  const messages=[];const models=[];
  const handler=createEvaluationHandler({env:preview,makeUnderstanding:({env})=>{
    models.push(env.AI_GATEWAY_MODEL);
    return async message=>{messages.push(message);return {mode:'model',data:emptyUnderstanding({intent:'general',dialogue:{reply:'Synthetische Testantwort.',stage:'information',buttons:[]}})};};
  }});
  const first=await call(handler,{model:'openai/gpt-6-luna',caseId:'01',turn:1});
  assert.equal(first.statusCode,200);assert.equal(preview.AI_GATEWAY_MODEL,'inception/mercury-2.5');
  const session=first.body.session;assert.equal(readSession(session).evaluationRun.nextTurn,2);
  assert.equal((await call(handler,{model:'anthropic/claude-sonnet-5.5',caseId:'01',turn:2,session})).statusCode,409);
  assert.equal((await call(handler,{model:'openai/gpt-6-luna',caseId:'03',turn:2,session})).statusCode,409);
  const second=await call(handler,{model:'openai/gpt-6-luna',caseId:'01',turn:2,session});
  assert.equal(second.statusCode,200);assert.deepEqual(messages,['Meine Lampe geht nicht.','wohnzimmer']);
  assert.deepEqual(models,['openai/gpt-6-luna','openai/gpt-6-luna']);assert.equal(second.body.evaluation.synthetic,true);
});

test('Plain dialogue control contains no extraction schema or executable actions and cannot cross into structured sessions',async()=>{
  let calls=0;
  const handler=createEvaluationHandler({env:{...preview,AI_GATEWAY_API_KEY:'synthetic-test-credential'},generate:async options=>{
    calls++;assert.equal(options.model.modelId,'inception/mercury-2.5');assert.doesNotMatch(options.instructions,/KLEINE NOTIZEN|"updates"/);
    assert.equal(options.tools,undefined);assert.equal(options.reasoning,'high');
    return {text:'Synthetische Antwort für den Vertragscheck.',usage:{inputTokens:100,outputTokens:50},finalStep:{providerMetadata:{}}};
  }});
  const first=await call(handler,{model:'inception/mercury-2.5',caseId:'01',turn:1,mode:'dialogue_only'});
  assert.equal(first.statusCode,200);assert.deepEqual(first.body.actions,[]);assert.equal(first.body.evaluation.mode,'dialogue_only');
  assert.equal((await call(handler,{model:'inception/mercury-2.5',caseId:'01',turn:2,session:first.body.session})).statusCode,409);
  const second=await call(handler,{model:'inception/mercury-2.5',caseId:'01',turn:2,mode:'dialogue_only',session:first.body.session});
  assert.equal(second.statusCode,200);assert.equal(calls,2);assert.equal(preview.AI_GATEWAY_MODEL,'inception/mercury-2.5');
});
