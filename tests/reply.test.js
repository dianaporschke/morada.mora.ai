import test from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV4 } from 'ai/test';
import { generateNaturalReply, canComposeReply } from '../lib/mora/reply.js';
import { processTurn } from '../lib/mora/engine.js';
import { emptyUnderstanding } from '../lib/mora/schema.js';
import { createChatHandler } from '../api/chat.js';
import { readSession } from '../lib/mora/session.js';
import { modelUnavailable } from '../lib/mora/provider.js';

const understand = async () => ({mode:'model',data:emptyUnderstanding({intent:'issue',category:'heating',equipment:'heater',confidence:'clear',location:'Küche',question:'since',clarification:'Seit wann bleibt der Heizkörper in der Küche kalt?'})});
const response = output => new MockLanguageModelV4({doGenerate:async options => ({
  content:[{type:'text',text:JSON.stringify(output)}],finishReason:{unified:'stop',raw:'stop'},
  usage:{inputTokens:{total:200,noCache:200,cacheRead:0,cacheWrite:0},outputTokens:{total:60,text:60,reasoning:0}},warnings:[],
})});
async function invoke(handler, body) {
  let status, data;
  await handler({method:'POST',body}, {setHeader() {},status(value) {status=value; return this;},json(value) {data=value; return this;}});
  return {status,data};
}

test('Natural wording uses the SDK schema and cannot change the pending question or actions', async () => {
  const turn = await processTurn({message:'Der Heizkörper in der Küche wird nicht warm.'}, null, understand);
  const originalActions = structuredClone(turn.state.actions);
  const result = await generateNaturalReply(turn, response({reply:'Seit wann bleibt der Heizkörper in Ihrer Küche kalt?',questionKey:'since'}));
  assert.equal(result.reply, 'Seit wann bleibt der Heizkörper in Ihrer Küche kalt?');
  assert.equal(result.usage.inputTokens, 200); assert.deepEqual(turn.state.actions, originalActions);
  await assert.rejects(generateNaturalReply(turn, response({reply:'Wo ist die Heizung?',questionKey:'location'})), error => error.type === 'invalid_model_output');
  await assert.rejects(generateNaturalReply(turn, response({reply:'Geändert',questionKey:'since',actions:[{type:'submit'}]})));
});

test('Natural wording stays off by default; enabling it signs the displayed wording and retains facts', async () => {
  let compositions = 0;
  const compose = async () => {compositions++; return 'Seit wann bleibt Ihr Heizkörper kalt?';};
  const original = await invoke(createChatHandler(understand, {env:{},compose}), {message:'Der Heizkörper in der Küche wird nicht warm.'});
  assert.equal(original.status, 200); assert.equal(original.data.responseMode, 'engine'); assert.equal(compositions, 0);
  const natural = await invoke(createChatHandler(understand, {env:{MORA_AI_NATURAL_REPLIES:'true'},compose}), {message:'Der Heizkörper in der Küche wird nicht warm.'});
  assert.equal(natural.status, 200); assert.equal(natural.data.responseMode, 'model'); assert.equal(compositions, 1);
  const state = readSession(natural.data.session);
  assert.equal(state.history.at(-1).content, natural.data.reply); assert.equal(state.pendingKey, 'since');
  assert.equal(state.issue.location, 'Küche'); assert.deepEqual(natural.data.actions, original.data.actions);
  assert.equal(natural.data.capabilities.submitRequest, false);
});

test('AI-required failures return a diagnostic 503, no forged model result or new session', async () => {
  const unavailable = {provider:'gateway',model:'openai/test',status:403,reason:'no_providers_available'};
  const failed = await invoke(createChatHandler(async () => {throw modelUnavailable(unavailable);}), {message:'Meine Heizung bleibt kalt.'});
  assert.equal(failed.status, 503); assert.equal(failed.data.code, 'MODEL_UNAVAILABLE');
  assert.deepEqual(failed.data.modelAvailability, unavailable); assert.equal(failed.data.session, undefined);
  const composeFailure = await invoke(createChatHandler(understand, {env:{MORA_AI_NATURAL_REPLIES:'true'},compose:async () => {throw modelUnavailable(unavailable);}}), {message:'Heizung kaputt'});
  assert.equal(composeFailure.status, 503); assert.equal(composeFailure.data.session, undefined);
});

test('Safety and validated selections remain available independently of the language model', async () => {
  let remoteCalls = 0;
  const handler = createChatHandler(async () => {remoteCalls++; throw new Error('Must not run');},
    {env:{MORA_AI_NATURAL_REPLIES:'true'},compose:async () => {remoteCalls++; throw new Error('Must not run');}});
  const danger = await invoke(handler, {message:'Ich rieche Gasgeruch.'});
  assert.equal(danger.status, 200); assert.equal(danger.data.responseMode, 'safety'); assert.equal(remoteCalls, 0);
  assert.equal(danger.data.actions[0].number, '112');
  const light = async () => ({mode:'model',data:emptyUnderstanding({intent:'issue',category:'electricity',equipment:'light',confidence:'clear',question:'location'})});
  const basic = await invoke(createChatHandler(light, {env:{}}), {message:'Lampe kaputt'});
  const input = {session:basic.data.session,actionId:basic.data.actions.find(item => item.type === 'select').id};
  const selected = await invoke(handler, input);
  assert.equal(selected.status, 200); assert.equal(selected.data.issue.id, basic.data.issue.id);
  assert.ok(selected.data.issue.location); assert.equal(selected.data.responseMode, 'engine');
  assert.equal(remoteCalls, 0);
  assert.equal(canComposeReply({understanding:'guided',state:{issues:[]}}), false);
  assert.equal(canComposeReply({understanding:'model',state:{issues:[{hazard:'gas',urgency:'emergency'}]}}), false);
});
