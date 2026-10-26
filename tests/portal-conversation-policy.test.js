import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortalService} from '../lib/mora/portal/service.js';
import {MODEL} from '../lib/mora/portal/budget.js';
import {hydrateSimple,projectDecision,commitDecision} from '../lib/mora/simple/state.js';

function lamp(){
  const text='Meine Lampe geht nicht.',plan={intent:'issue',reply:'In welchem Raum?',actions:[],ask:{field:'location',ref:'new1'},updates:[{ref:'new1',quote:text,equipment:'light',defect:'geht nicht'}]};
  return commitDecision(projectDecision(hydrateSimple(null),text,plan),text,plan).state;
}
const roomPlan=reply=>({intent:'issue',reply,updates:[{ref:'active',quote:'wohnzimmer',location:'Wohnzimmer'}],actions:[]});
function fixture(outputs,requests=[]){return createPortalService({
  resolve:async()=>({ready:true,provider:'gateway',model:MODEL,createModel:()=>({})}),guard:async()=>{},
  generate:async options=>{requests.push(options);assert.ok(outputs.length,'No unbounded extra call');return {output:structuredClone(outputs.shift()),usage:{},finalStep:{providerMetadata:{}}};},
});}

test('an unrequested technical question without ask is rejected before display and repaired without losing the room',async()=>{
  const bad='Haben Sie das Leuchtmittel überprüft?',good='Sie können das Anliegen jetzt vorbereiten.';
  const requests=[],previous=lamp(),snapshot=structuredClone(previous);
  const result=await fixture([
    roomPlan(bad),{violations:[{kind:'unrequested_troubleshooting',quote:bad,reason:'Kunde möchte einen Defekt melden, keine Bauteile prüfen.'}]},
    roomPlan(good),{violations:[]},
  ],requests)('wohnzimmer',previous,['cases']);
  assert.equal(result.reply,good);assert.equal(result.modelCalls,4);assert.equal(result.repaired,true);
  assert.equal(result.state.issue.location,'Wohnzimmer');assert.equal(result.state.issue.equipment,'light');assert.deepEqual(previous,snapshot);
  const audit=JSON.parse(requests[1].messages[0].content);
  assert.equal(audit.currentFormReadiness.ready,true);assert.equal(audit.ask,undefined);assert.equal(audit.reply,bad);
  assert.ok(requests[2].instructions.includes('unrequested_troubleshooting'));
});

test('a repeated policy violation exhausts one repair without publishing the rejected response or facts',async()=>{
  const previous=lamp(),before=structuredClone(previous),bad=roomPlan('Welche Bauart ist es, und haben Sie das Bauteil geprüft?');
  const violation={violations:[{kind:'unnecessary_question',quote:bad.reply,reason:'Zwei technische Fragen statt einer ausreichenden Defektmeldung.'}]};
  await assert.rejects(fixture([bad,violation,bad,violation])('wohnzimmer',previous,['cases']),e=>e.modelCalls===4);
  assert.deepEqual(previous,before);
});

test('technical vocabulary in a requested explanation is not blocked by a word blacklist',async()=>{
  const reply='Ein Leuchtmittel ist der Teil einer Lampe, der Licht erzeugt, zum Beispiel eine Glühbirne.';
  const result=await fixture([{intent:'information',reply,updates:[],actions:[]}])('Was bedeutet Leuchtmittel?',hydrateSimple(null),[]);
  assert.equal(result.reply,reply);assert.equal(result.modelCalls,1);assert.equal(result.state.issues.length,0);
});
