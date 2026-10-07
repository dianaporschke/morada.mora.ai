import test from 'node:test';
import assert from 'node:assert/strict';
import { processTurn } from '../lib/mora/engine.js';
import { guidedUnderstanding } from '../lib/mora/guided.js';
import { emptyUnderstanding } from '../lib/mora/schema.js';
import { validateActions } from '../lib/mora/actions.js';

const understand = async (message,state) => ({ data:guidedUnderstanding(message,state), mode:'guided' });
const turn = (message,state=null) => processTurn({message},state,understand);

test('A/E: socket scope uses matching options and accepts room-wide free text', async () => {
  const a = await turn('Steckdose geht nicht');
  assert.equal(a.state.issue.equipment,'socket'); assert.match(a.reply,/Steckdose/); assert.doesNotMatch(a.reply,/Lampe|Leuchte/);
  assert.equal(a.state.actions.length,3);
  const b = await turn('Im ganzen Wohnzimmer geht keine',a.state);
  assert.equal(b.state.issue.id,a.state.issue.id); assert.match(b.state.issue.location,/Wohnzimmer/i); assert.match(b.state.issue.extent,/ganzen Wohnzimmer/i);
  const c = await turn('Seit gestern',b.state); assert.equal(c.state.pendingKey,null); assert.match(c.state.issue.since,/gestern/);
  assert.deepEqual(c.state.actions.map(x=>x.type),['handover','add_details']);
});
test('B: complete description does not re-ask count, time or location',async()=>{
  const a=await turn('Seit gestern funktionieren drei Steckdosen im Wohnzimmer nicht');
  assert.equal(a.state.issue.count,3); assert.match(a.state.issue.location,/Wohnzimmer/); assert.match(a.state.issue.since,/gestern/);
  assert.equal(a.state.pendingKey,null); assert.doesNotMatch(a.reply,/Seit wann besteht|Wie viele|Wo befinden/);
});
test('C: out-of-order heater scope remains distinct from beginning',async()=>{
  let a=await turn('Heizung kaputt'); const id=a.state.issue.id;
  a=await turn('Alle',a.state); assert.equal(a.state.issue.extent,'Alle Heizkörper'); assert.equal(a.state.issue.since,null);
  a=await turn('Seit gestern',a.state); assert.equal(a.state.issue.id,id); assert.match(a.state.issue.since,/gestern/);
  assert.equal(a.state.issue.extent,'Alle Heizkörper'); assert.doesNotMatch(a.reply,/Seit wann|einzelnen Heizkörper/);
});
test('D/H: knowledge has no actions or issue mutation; document excursion can resume',async()=>{
  const k=await turn('Was bedeutet Mietkaution?'); assert.equal(k.state.issue,null); assert.deepEqual(k.state.actions,[]); assert.match(k.reply,/Sicherheit/);
  const a=await turn('Steckdose kaputt'); const b=await turn('Was bedeutet Mietkaution?',a.state);
  assert.deepEqual({...b.state.issue, updatedAt:null},{...a.state.issue, updatedAt:null}); assert.equal(b.state.pendingKey,'extent'); assert.deepEqual(b.state.actions,[]);
  const c=await turn('Wo finde ich meinen Mietvertrag?',b.state); assert.equal(c.state.issue.id,a.state.issue.id);
  assert.match(c.reply,/Vorschau/); assert.ok(c.state.actions.some(x=>x.target==='docs'));
  const d=await processTurn({actionId:'continue-issue'},c.state,understand); assert.match(d.reply,/Steckdose/);
});
test('F: two problems have separate IDs, locations, follow-ups and photos',async()=>{
  let a=await turn('Heizung kaputt und im Bad tropft Wasser'); assert.equal(a.state.issues.length,2);
  const heat=a.state.issues.find(x=>x.equipment==='heater'), water=a.state.issues.find(x=>x.category==='water');
  assert.notEqual(heat.id,water.id); assert.equal(heat.location,null); assert.match(water.location,/Bad/);
  a=await processTurn({attachments:[{id:'heat-photo',name:'Heizung.png',type:'image/png',size:100}]},a.state,understand);
  a=await processTurn({actionId:`switch-${water.id}`},a.state,understand);
  assert.equal(a.state.issue.id,water.id); assert.deepEqual(a.state.issue.attachments,[]);
  a=await turn('Seit heute',a.state); assert.match(a.state.issue.since,/heute/);
  const heater=a.state.issues.find(x=>x.id===heat.id); assert.equal(heater.since,null); assert.equal(heater.attachments.length,1);
  await assert.rejects(processTurn({actionId:'switch-fake'},a.state,understand),{code:'INVALID_ACTION'});
});
test('G: socket sparks and burnt smell bypass remote model and preserve the fixture',async()=>{
  const a=await processTurn({message:'Aus der Steckdose kommen Funken und es riecht verbrannt'},null,async()=>{throw new Error('Must not call model');});
  assert.equal(a.state.issue.urgency,'emergency'); assert.equal(a.state.actions[0].number,'112'); assert.match(a.reply,/Abstand|Gefahrenbereich/);
  assert.equal(a.state.issue.equipment,'socket'); assert.equal(a.state.pendingKey,null);
});
test('I: unidentified noisy fixture under Lavabo gets a clarification, no fabricated diagnosis',async()=>{
  const a=await turn('Unter dem Lavabo macht das Ding Geräusche');
  assert.equal(a.state.issue.equipment,'unknown'); assert.match(a.reply,/beschreiben|Geräusch/); assert.doesNotMatch(a.reply,/Siphon|Pumpe|Rohrbruch/);
});
test('K: count corrections update same issue and retain original evidence',async()=>{
  let a=await turn('Eine Steckdose'); const id=a.state.issue.id;
  a=await turn('Nein, zwei',a.state); assert.equal(a.state.issue.id,id); assert.equal(a.state.issue.count,2);
  assert.match(a.state.issue.summary,/Anzahl: 2/); assert.equal(a.state.issue.corrections.length,1);
  let b=await turn('Eine Steckdose'); b=await turn('Moment, die zweite daneben auch',b.state); assert.equal(b.state.issue.count,2);
});
test('LLM output cannot supply arbitrary actions, target outside signed state, or unsafe navigation',async()=>{
  const a=await turn('Steckdose kaputt');
  const bad=emptyUnderstanding({intent:'issue',targetIssueId:'another-customer-id',category:'electricity',equipment:'socket',count:100,confidence:'clear'});
  const b=await processTurn({message:'anderes Anliegen'},a.state,async()=>({data:bad,mode:'model'}));
  assert.equal(b.state.issue.count,null); assert.match(b.reply,/Welches/);
  assert.throws(()=>validateActions([{id:'evil',type:'navigate',label:'Öffnen',variant:'primary',target:'https://evil.invalid'}],a.state));
  assert.throws(()=>validateActions(Array(5).fill(a.state.actions[0]),a.state));
});
test('LLM contract supports new equipment and multiple independently extracted issues',async()=>{
  const main=emptyUnderstanding({intent:'issue',category:'electricity',equipment:'socket',description:'Dose ohne Strom',defect:'Kein Strom',count:2,location:'Wohnzimmer',since:'seit gestern',confidence:'clear'});
  const patch=Object.fromEntries(['category','subcategory','description','equipment','defect','count','location','since','extent','details','urgency','hazard'].map(key=>[key,emptyUnderstanding({category:'heating',equipment:'heater',description:'kalt',location:'Bad'})[key]]));
  main.additionalIssues=[patch];
  const a=await processTurn({message:'Die beiden Anschlüsse tun nichts, im Bad bleibt es zudem kalt'},null,async()=>({data:main,mode:'model'}));
  assert.equal(a.understanding,'model'); assert.equal(a.state.issues.length,2); assert.equal(a.state.issues[0].count,2); assert.equal(a.state.issues[1].count,null);
});

test('A correction of the fixture replaces the same issue instead of inventing a second problem',async()=>{
  let a=await turn('Heizung kaputt'); const id=a.state.issue.id;
  a=await turn('Nein, die Steckdose ist kaputt',a.state);
  assert.equal(a.state.issues.length,1); assert.equal(a.state.issue.id,id); assert.equal(a.state.issue.equipment,'socket');
});
test('Urgent issue can accept extra details from a safe place without dropping safety',async()=>{
  let a=await turn('Wasser kommt aus der Decke');
  a=await processTurn({actionId:'add-details'},a.state,understand);
  assert.equal(a.state.pendingKey,'additional'); assert.match(a.reply,/sicheren Ort/);
  a=await turn('Ich bin ab 18 Uhr zu Hause',a.state);
  assert.match(a.state.issue.details,/18 Uhr/); assert.equal(a.state.issue.urgency,'high');
});

test('A clear correction of an alleged hazard can restore normal qualification',async()=>{
  let a=await turn('Die Steckdose wirft Funken');
  a=await turn('Nein, sie wirft keine Funken. Sie geht nur nicht.',a.state);
  assert.equal(a.state.issue.urgency,'normal'); assert.equal(a.state.issue.hazard,'none');
  let b=await turn('Die Steckdose wirft Funken'); b=await turn('Wo ist mein Mietvertrag?',b.state);
  assert.equal(b.state.issue.urgency,'emergency');
});
test('Model-detected danger overrides contradictory information intent and normal urgency',async()=>{
  const data=emptyUnderstanding({intent:'appointments',hazard:'gas',urgency:'normal',description:'Verdächtiges Zischen',confidence:'clear'});
  const a=await processTurn({message:'Kann ich wegen des Zischens in der Leitung den Termin ändern?'},null,async()=>({data,mode:'model'}));
  assert.equal(a.state.issue.hazard,'gas'); assert.equal(a.state.issue.urgency,'emergency'); assert.equal(a.state.actions[0].number,'112');
});
