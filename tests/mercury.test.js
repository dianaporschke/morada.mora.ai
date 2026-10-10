import test from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV4 } from 'ai/test';
import { generateUnderstandingResult } from '../lib/mora/understanding.js';
import { generateNaturalReply } from '../lib/mora/reply.js';
import { emptyUnderstanding } from '../lib/mora/schema.js';
import { processTurn } from '../lib/mora/engine.js';
import { estimateTokenCost } from '../lib/mora/costs.js';
import { classifyModelError } from '../lib/mora/provider.js';

function mercury(output, inspect = () => {}) {
  return new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async options => {
    inspect(options);
    return {content:[{type:'text',text:JSON.stringify(output)}],
      finishReason:{unified:'stop',raw:'stop'},
      usage:{inputTokens:{total:200,noCache:200,cacheRead:0,cacheWrite:0},outputTokens:{total:100,text:100,reasoning:0}},warnings:[]};
  }});
}

test('Mercury uses supported JSON mode with the complete schema in system instructions', async () => {
  let calls = 0;
  const expected = emptyUnderstanding({intent:'issue',confidence:'clear',category:'electricity',equipment:'socket',location:'Schlafzimmer'});
  const result = await generateUnderstandingResult('Steckdose im Schlafzimmer kaputt', null, mercury(expected, options => {
    calls++;
    assert.equal(options.responseFormat.type, 'json');
    assert.equal(options.responseFormat.schema, undefined);
    assert.equal(options.tools, undefined);
    assert.equal(options.providerOptions.inception.reasoningEffort,'low');
    assert.match(JSON.stringify(options.prompt), /unknownFields/);
    assert.match(JSON.stringify(options.prompt), /additionalProperties/);
    assert.match(JSON.stringify(options.prompt), /Steckdose im Schlafzimmer kaputt/);
  }));
  assert.deepEqual(result.data, expected); assert.equal(calls, 1);
  assert.equal(result.usage.inputTokens, 200);
  assert.equal(estimateTokenCost('inception/mercury-2.5',result.usage),0.000023);
});

test('A Gateway-wrapped local timeout is distinguished from provider 500 errors', () => {
  const selection = {provider:'gateway',model:'inception/mercury-2.5'};
  const error = Object.assign(new Error('Wrapped transport error'),{type:'response_error',statusCode:500,cause:new DOMException('Deadline reached','TimeoutError')});
  assert.equal(classifyModelError(error,selection).reason,'model_timeout');
  delete error.cause;
  assert.equal(classifyModelError(error,selection).reason,'response_error');
});

test('Mercury JSON cannot add executable actions and invalid usage remains accounted', async () => {
  await assert.rejects(generateUnderstandingResult('Hey',null,mercury({...emptyUnderstanding(),actions:[{type:'submit'}]})),
    error => error.type === 'invalid_model_output' && error.usage.inputTokens === 200);
});

test('Mercury JSON reply retains the question contract and does not mutate portal actions', async () => {
  const turn = await processTurn({message:'Meine Steckdose funktioniert nicht.'},null,async () => ({mode:'model',data:emptyUnderstanding({intent:'issue',confidence:'clear',category:'electricity',equipment:'socket',question:'location',clarification:'In welchem Raum ist die defekte Steckdose?'})}));
  const actions = structuredClone(turn.state.actions);
  const result = await generateNaturalReply(turn,mercury({reply:'In welchem Raum ist die defekte Steckdose?',questionKey:'location'}));
  assert.equal(result.reply,'In welchem Raum ist die defekte Steckdose?');
  assert.deepEqual(turn.state.actions,actions);
  await assert.rejects(generateNaturalReply(turn,mercury({reply:'Seit wann?',questionKey:'since'})),error => error.type === 'invalid_model_output');
});
