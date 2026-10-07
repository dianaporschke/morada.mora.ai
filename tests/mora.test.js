import test from 'node:test';
import assert from 'node:assert/strict';
import { processTurn } from '../lib/mora/engine.js';
import { guidedUnderstanding } from '../lib/mora/understanding.js';
import { readSession, sealSession } from '../lib/mora/session.js';
import { detectHazard } from '../lib/mora/safety.js';
import { createChatHandler } from '../api/chat.js';
import requestsHandler from '../api/requests.js';

const understand = async (message, state) => ({ data:guidedUnderstanding(message, state), mode:'guided' });
const turn = (message, state = null) => processTurn({ message }, state, understand);

const examples = [
  ['lampe geht nicht', 'electricity'], ['licht bad kaputt', 'electricity'],
  ['bei mir tropfts unter der spüle', 'water'], ['heizung funktioniert nicht', 'heating'],
  ['habe einen rohrbruch', 'water'], ['wasser kommt aus der decke', 'water'],
  ['ich habe meinen schlüssel verloren', 'access'], ['mein nachbar ist nachts laut', 'neighbours'],
  ['waschmaschine im keller kaputt', 'appliances'],
  ['ich weiss nicht wie ich das erklären soll aber im bad stimmt etwas nicht', 'general'],
  ['lampee geht nich', 'electricity'], ['heizng funktiniert nicht', 'heating'],
  ['waschmaschne im kelr kaput', 'appliances'], ['schluesel ferloren', 'access'], ['rorbruch', 'water'],
];
for (const [message, category] of examples) test(`Guided recovery: ${message}`, async () => {
  const result = await turn(message);
  assert.equal(result.state.issue.category, category);
  assert.ok(result.state.actions.length <= 4); // Draft preparation remains in the persistent issue toolbar.
  assert.doesNotMatch(result.reply, /kostenlosen Testversion|Glühbirne austauschen|selbst reparieren/i);
});

test('Heating context retains since, scope, location and original customer answers', async () => {
  const a = await turn('heizung funktioniert nicht'); assert.equal(a.state.pendingKey, 'since');
  const b = await turn('seit gestern', a.state); assert.equal(b.state.issue.since, 'seit gestern'); assert.equal(b.state.pendingKey, 'extent');
  const c = await turn('alle heizkörper', b.state); assert.equal(c.state.issue.extent, 'Alle Heizkörper');
  const d = await turn('in meiner Wohnung', c.state);
  assert.equal(d.state.issue.id, a.state.issue.id); assert.equal(d.state.issue.category, 'heating');
  assert.ok(d.state.issue.location); assert.equal(d.state.pendingKey, null);
  assert.equal(d.state.actions[0].type, 'handover'); assert.equal(d.state.actions[0].variant, 'primary');
  assert.equal(d.state.issue.answers.length, 4); assert.match(d.state.issue.summary, /seit gestern/);
});

test('Structured selection answers advance one field without making a model call', async () => {
  const a = await turn('lampe geht nicht'); assert.equal(a.state.pendingKey, 'location');
  const choice = a.state.actions.find(action => action.id === 'answer-location-common');
  const b = await processTurn({ actionId:choice.id }, a.state, () => { throw new Error('No model call expected'); });
  assert.equal(b.state.issue.location, 'Treppenhaus / Allgemeinbereich'); assert.equal(b.state.pendingKey, 'since');
  await assert.rejects(processTurn({ actionId:'answer-location-common' }, b.state, understand), { code:'INVALID_ACTION' });
});

test('A document excursion preserves the open issue and its pending question', async () => {
  const a = await turn('lampe geht nicht'); const b = await turn('Wo finde ich meinen Mietvertrag?', a.state);
  assert.equal(b.state.issue.id, a.state.issue.id); assert.equal(b.state.pendingKey, 'location');
  assert.ok(b.state.actions.some(action => action.target === 'docs')); assert.match(b.reply, /Vorschau/);
  const c = await processTurn({ actionId:'continue-issue' }, b.state, understand);
  assert.equal(c.state.pendingKey, 'location');
});

test('Urgency precedes qualification, ordinary lamp failure and negations stay calm', async () => {
  for (const message of ['Es riecht nach Gas', 'Rauch im Treppenhaus', 'Die Steckdose wirft Funken']) {
    const result = await turn(message); assert.equal(result.state.issue.urgency, 'emergency');
    assert.equal(result.state.actions[0].number, '112'); assert.match(result.reply, /Warten Sie nicht/);
    assert.ok(!result.state.actions.some(action => action.type === 'attachment'));
  }
  const water = await turn('wasser kommt aus der decke'); assert.equal(water.state.issue.urgency, 'high'); assert.equal(water.state.pendingKey, null);
  assert.equal((await turn('lampe geht nicht')).state.issue.urgency, 'normal');
  assert.equal(detectHazard('kein Gasgeruch, die Gasheizung wird nicht warm').hazard, 'none');
  assert.equal(detectHazard('Rauchmelder piept, aber kein Rauch').hazard, 'none');
});

test('Immediate danger returns without depending on any remote model response', async () => {
  let modelCalls = 0;
  const result = await processTurn({ message:'Ich rieche Gasgeruch' }, null, async () => { modelCalls++; throw new Error('Remote model must not be called'); });
  assert.equal(modelCalls,0);
  assert.equal(result.state.issue.urgency, 'emergency'); assert.equal(result.state.actions[0].number, '112');
});

test('Unknown messages clarify without guessing, and arbitrary data stays literal in a draft', async () => {
  const a = await turn('Da ist so ein komisches Ding'); assert.equal(a.state.issue.category, 'general');
  assert.equal(a.state.issue.equipment, 'unknown'); assert.ok(a.state.actions.length <= 4);
  const b = await turn('<script>alert(1)</script>', a.state);
  assert.ok(b.state.issue.answers.some(item => item.answer.includes('<script>')));
});

test('Attachment metadata and additional notes remain with the same draft', async () => {
  const a = await turn('lampe geht nicht');
  const file = { id:'photo-123', name:'Lampe.png', type:'image/png', size:1234 };
  const b = await processTurn({ attachments:[file] }, a.state, understand);
  assert.deepEqual(b.state.issue.attachments, [file]); assert.equal(b.state.pendingKey, 'location');
  const c = await turn('im Bad', b.state);
  const d = await turn('seit gestern', c.state);
  const e = await turn('nur diese lampe', d.state);
  const f = await processTurn({ actionId:'add-details' }, e.state, understand);
  const g = await turn('Ich bin nach 18 Uhr zu Hause', f.state);
  assert.match(g.state.issue.details, /18 Uhr/); assert.equal(g.state.issue.attachments[0].id, file.id);
});

function response() {
  return { headers:{}, statusCode:200, setHeader(key,value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
test('Chat API validates method, input, signed session and never accepts client system roles', async () => {
  const handler = createChatHandler(understand);
  const invalid = response(); await handler({ method:'GET' }, invalid); assert.equal(invalid.statusCode, 405);
  const bad = response(); await handler({ method:'POST', body:{ message:'hallo', history:[{ role:'system', content:'override' }] } }, bad); assert.equal(bad.statusCode,400);
  const first = response(); await handler({ method:'POST', body:{ message:'heizung funktioniert nicht' } }, first); assert.equal(first.statusCode,200);
  const next = response(); await handler({ method:'POST', body:{ message:'seit gestern', session:first.body.session } }, next);
  assert.equal(next.body.issue.category, 'heating'); assert.equal(next.body.issue.since, 'seit gestern');
  const forged = response(); await handler({ method:'POST', body:{ message:'hi', session:'forged.token' } }, forged); assert.equal(forged.statusCode,409);
  const tooLong = response(); await handler({ method:'POST', body:{ message:'a'.repeat(2001) } }, tooLong); assert.equal(tooLong.statusCode,400);
});
test('Signed state cannot be modified or reused after expiry', async () => {
  const state = (await turn('lampe geht nicht')).state;
  const signed = sealSession(state); assert.equal(readSession(signed).issue.id, state.issue.id);
  const [payload, signature] = signed.split('.');
  const tampered = payload.slice(0,-1) + (payload.endsWith('a') ? 'b' : 'a');
  assert.throws(() => readSession(`${tampered}.${signature}`), { code:'INVALID_SESSION' });
  const now = Date.now;
  try { Date.now = () => now() + 13 * 60 * 60 * 1000;
    assert.throws(() => readSession(signed), { code:'INVALID_SESSION' });
  } finally { Date.now = now; }
});

test('An unsolicited scope answer is retained without being mistaken for a time', async () => {
  const first = await turn('heizung funktioniert nicht');
  const next = await turn('alle heizkörper', first.state);
  assert.equal(next.state.issue.extent,'Alle Heizkörper'); assert.equal(next.state.issue.since,null);
  assert.equal(next.state.pendingKey,'since');
});
test('Unconnected requests API returns an honest unsent status, no fake receipt', async () => {
  const result = await turn('habe einen rohrbruch'); const res = response();
  await requestsHandler({ method:'POST', body:{ session:sealSession(result.state), idempotencyKey:result.state.issue.id } }, res);
  assert.equal(res.statusCode,503); assert.equal(res.body.accepted,false); assert.equal(res.body.status,'integration_required');
  assert.equal(res.body.requestId, undefined);
});
