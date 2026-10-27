// Mock transports exercise the real installed SDK and native reducers.
// They do not count as real model quality tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MockLanguageModelV4} from 'ai/test';
import {createCompactPortalAgent,compactSchema,decodeCompactPlan} from '../lib/mora/portal/compact-agent.js';
import {createAgentTurn} from '../lib/mora/portal/agent.js';
import {z} from 'zod';
import {hydrateSimple,beginPreparation,acceptReceipt} from '../lib/mora/simple/state.js';
import {portalCaseFields} from '../assets/mora-portal-map.js';
import {portalActionState} from '../lib/mora/portal/action-state.js';
import {AGENT_MODEL} from '../lib/mora/portal/budget.js';

const empty=()=>hydrateSimple(null);
const plan=(reply,updates=[],extra={})=>({reply,topic:updates.length?'issue':'information',updates,focus:null,next:{type:'none'},...extra});
const wirePlan=p=>p?.updates?{...p,updates:p.updates.map(u=>{
 const changes=new Map();
 for(const field of ['equipment','defect','location','count','since','extent','details','cause','risk'])if(u[field]!=null)changes.set(field,{field,status:'known',value:String(u[field]),quote:u.quote});
 for(const status of ['unknown','uncertain'])for(const x of u[status]||[])changes.set(x.field,{field:x.field,status,value:status==='uncertain'&&u[x.field]!=null?String(u[x.field]):null,quote:x.quote});
 for(const field of u.clearFields||[])changes.set(field,{field,status:'clear',value:null,quote:u.quote});
 return {ref:u.ref,quote:u.quote,correction:u.correction||false,changes:[...changes.values()]};
}),next:{action:null,ref:null,target:null,requestQuote:null,...p.next}}:p;
function sdk(outputs,guard=async()=>{}) {
  let n=0;
  const model=new MockLanguageModelV4({modelId:AGENT_MODEL,doGenerate:async()=>{
    assert.ok(n<outputs.length,'Unexpected extra generation');const value=outputs[n++];if(value instanceof Error)throw value;
    return {content:[{type:'text',text:typeof value==='string'?value:JSON.stringify(wirePlan(value))}],finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:100,noCache:100,cacheRead:0},outputTokens:{total:30,text:30,reasoning:0}},warnings:[]};
  }});
  return {model,converse:createCompactPortalAgent({resolve:async()=>({ready:true,provider:'gateway',model:AGENT_MODEL,createModel:()=>model}),guard})};
}
async function turn(state,message,p){const a=sdk([p]);return a.converse(message,state,['cases']);}
const lamp=async()=> (await turn(empty(),'Eine Lampe im Wohnzimmer ist kaputt.',plan('Das tut mir leid.',[{ref:'new1',quote:'Eine Lampe im Wohnzimmer ist kaputt.',equipment:'light',defect:'kaputt',location:'Wohnzimmer',count:1}]))).state;

test('compact response and extraction share exactly one real SDK generation',async()=>{
  let guards=0;const a=sdk([plan('Wo steht die Lampe?',[{ref:'new1',quote:'lampe kaputt',equipment:'light',defect:'kaputt'}])],async()=>{guards++;});
  const r=await a.converse('lampe kaputt',empty(),['cases']);
  assert.equal(r.modelCalls,1);assert.equal(a.model.doGenerateCalls.length,1);assert.equal(guards,1);
  assert.equal(r.reply,'Wo steht die Lampe?');assert.equal(r.state.issue.equipment,'light');
  assert.ok(!a.model.doGenerateCalls[0].tools?.length);
  assert.equal(r.state.issue.location,null);assert.equal(r.state.issue.count,null);
});
test('short replies and correction keep the same issue and native mapping',async()=>{
  let s=(await turn(empty(),'lampe kaputt',plan('Wo ist die Lampe?',[{ref:'new1',quote:'lampe kaputt',equipment:'light',defect:'kaputt'}]))).state;
  const id=s.issue.id;
  s=(await turn(s,'wohnzimmer',plan('Alles klar.',[{ref:'active',quote:'wohnzimmer',location:'Wohnzimmer'}],{focus:'active'}))).state;
  s=(await turn(s,'Eine. Beginn unbekannt.',plan('Das genügt.',[{ref:'active',quote:'Eine. Beginn unbekannt.',count:1,unknown:[{field:'since',quote:'unbekannt'}]}],{focus:'active'}))).state;
  s=(await turn(s,'Nein, Schlafzimmer.',plan('Dann im Schlafzimmer.',[{ref:'active',quote:'Nein, Schlafzimmer.',location:'Schlafzimmer',correction:true}],{focus:'active'}))).state;
  assert.equal(s.issue.id,id);assert.equal(s.issues.length,1);assert.equal(s.issue.count,1);assert.equal(s.issue.fieldFacts.since.status,'unknown');
  const f=portalCaseFields(s.issue);assert.equal(f.unit,'Schlafzimmer');assert.match(f.title,/Lampe \/ Leuchte/);assert.doesNotMatch(f.description,/Wohnzimmer/);
});
test('uncertainty preserves last confirmed count and source',async()=>{
  const s=(await turn(await lamp(),'Vielleicht zwei.',plan('Sie sind sich noch nicht sicher.',[{ref:'active',quote:'Vielleicht zwei.',count:2,uncertain:[{field:'count',quote:'Vielleicht zwei.'}]}],{focus:'active'}))).state;
  assert.equal(s.issue.count,1);assert.equal(s.issue.fieldFacts.count.status,'uncertain');assert.equal(s.issue.fieldFacts.count.candidate,2);
});
test('two issues stay separate across topic changes',async()=>{
  const message='Lampe im Bad kaputt. Heizung im Flur kalt.';
  const s=(await turn(empty(),message,plan('Das sind zwei Anliegen.',[{ref:'new1',quote:'Lampe im Bad kaputt.',equipment:'light',defect:'kaputt',location:'Bad'},{ref:'new2',quote:'Heizung im Flur kalt.',equipment:'heater',defect:'kalt',location:'Flur'}],{focus:'new2'}))).state;
  assert.equal(s.issues.length,2);assert.equal(s.issue.location,'Flur');
  const general=(await turn(s,'Was ist eine Pauschale?',plan('Ein vereinbarter fester Betrag.'))).state;
  assert.equal(general.issues.length,2);assert.equal(portalActionState(general).controls.save,null);
  const resumed=(await turn(general,'Zurück zur Lampe.',plan('Was möchten Sie ergänzen?',[],{topic:'issue',focus:'other1'}))).state;
  assert.equal(resumed.issue.equipment,'light');assert.equal(resumed.issue.location,'Bad');
});
test('combined facts and preparation request use one call and only issue a UI request',async()=>{
  const text='Eine Lampe im Bad ist kaputt. Bitte vorbereiten.';
  const p=plan('Ich öffne die Angaben.',[{ref:'new1',quote:'Eine Lampe im Bad ist kaputt.',equipment:'light',defect:'kaputt',location:'Bad'}],{focus:'new1',next:{type:'form',action:'prepare',ref:'new1',requestQuote:'Bitte vorbereiten.'}});
  const a=sdk([p]);const r=await a.converse(text,empty(),['cases']);
  assert.equal(r.modelCalls,1);assert.equal(r.requestedAction,'prepare');assert.equal(r.reply,'');assert.equal(r.state.issue.preparation.status,'not_prepared');
});
test('saved draft correction keeps the receipt and creates an update instead of a new record',async()=>{
  let s=await lamp();const op=beginPreparation(s);acceptReceipt(s,{...op,status:'portal_received'});
  s=(await turn(s,'Nein, Bad.',plan('Dann im Bad.',[{ref:'active',quote:'Nein, Bad.',location:'Bad',correction:true}],{focus:'active'}))).state;
  const a=portalActionState(s);assert.equal(a.hasStoredDraft,true);assert.equal(a.formSaved,false);assert.equal(a.controls.save.operation,'update');assert.equal(s.issue.id,op.issueId);
});
test('invalid source cannot change facts or execute an action; no automatic paid repair',async()=>{
  const s=await lamp(),a=sdk([plan('Alles klar.',[{ref:'active',quote:'not said',location:'Küche'}],{focus:'active'})]);
  await assert.rejects(a.converse('Nein, Bad.',s,['cases']),e=>e.modelCalls===1&&e.conversationState.issue.location==='Wohnzimmer');
  assert.equal(a.model.doGenerateCalls.length,1);
});
test('unavailable or unrequested operations fail closed while valid facts survive',async()=>{
  const p=plan('Ich öffne das Formular.',[],{topic:'issue',focus:'active',next:{type:'form',action:'prepare',ref:'active',requestQuote:'Bitte vorbereiten.'}});
  const a=sdk([p]);await assert.rejects(a.converse('Hallo',await lamp(),['cases']),e=>e.modelCalls===1&&e.diagnostic.reason==='invalid_open_form');
  const s=await lamp();s.safety={hazard:'electric'};
  await assert.rejects(sdk([p]).converse('Bitte vorbereiten.',s,['cases']),e=>e.conversationState.safety.hazard==='electric');
});
test('rare ambiguous success claim is reviewed at most once with the same low-cost model',async()=>{
  const a=sdk([plan('Das Anliegen wurde an MORADA gesendet.'),{allowed:false}]);
  await assert.rejects(a.converse('Bitte senden.',empty(),['cases']),e=>e.modelCalls===2&&e.diagnostic.reason==='unconfirmed_success');
  assert.equal(a.model.doGenerateCalls.length,2);
});
test('budget boundary stops before inference and malformed output never launches a second generation',async()=>{
  const a=sdk([],async()=>{throw Object.assign(Error('budget'),{code:'PREVIEW_CREDIT_BOUNDARY'});});
  await assert.rejects(a.converse('Hallo',empty(),['cases']),e=>e.code==='PREVIEW_CREDIT_BOUNDARY'&&e.modelCalls===0);assert.equal(a.model.doGenerateCalls.length,0);
  const b=sdk(['not json']);await assert.rejects(b.converse('Hallo',empty(),['cases']),e=>e.modelCalls===1);assert.equal(b.model.doGenerateCalls.length,1);
});
test('provider schema stays identical when existing issue references change',async()=>{
 const a=compactSchema(createAgentTurn(empty(),'Hallo',['cases']));
 const b=compactSchema(createAgentTurn(await lamp(),'Nein, Bad.',['cases']));
 assert.deepEqual(z.toJSONSchema(a),z.toJSONSchema(b));
});
test('wire decoder rejects duplicate fields, unsupported values and fabricated field quotes',()=>{
 const good=wirePlan(plan('Alles klar.',[{ref:'new1',quote:'Eine Lampe ist kaputt.',equipment:'light',count:1}]));
 assert.equal(decodeCompactPlan(good).updates[0].count,1);
 const duplicate=structuredClone(good);duplicate.updates[0].changes.push(duplicate.updates[0].changes[0]);assert.throws(()=>decodeCompactPlan(duplicate));
 const unsupported=structuredClone(good);unsupported.updates[0].changes[0].quote='not said';assert.throws(()=>decodeCompactPlan(unsupported));
 const inconsistent=structuredClone(good);inconsistent.next.action='prepare';assert.throws(()=>decodeCompactPlan(inconsistent));
});
test('future forwarding promises also trigger the bounded effect check',async()=>{
 const a=sdk([plan('Prüfen Sie das Formular, damit wir den Fall weiterleiten können.'),{allowed:false}]);
 await assert.rejects(a.converse('Wohnzimmer',await lamp(),['cases']),e=>e.modelCalls===2&&e.diagnostic.reason==='unconfirmed_success');
});
