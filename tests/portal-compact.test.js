// Mock transports exercise the real installed SDK and native reducers.
// They do not count as real model quality tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MockLanguageModelV4} from 'ai/test';
import {createCompactPortalAgent,compactSchema,decodeCompactPlan,evidenceRepairSchema} from '../lib/mora/portal/compact-agent.js';
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
 for(const field of ['equipment','defect','location','count','since','extent','details','cause'])if(u[field]!=null)changes.set(field,{field,status:'known',value:String(u[field]),quote:u.quote});
 for(const status of ['unknown','uncertain'])for(const x of u[status]||[])changes.set(x.field,{field:x.field,status,value:status==='uncertain'&&u[x.field]!=null?String(u[x.field]):null,quote:x.quote});
 for(const field of u.clearFields||[])changes.set(field,{field,status:'clear',value:null,quote:u.quote});
 return {ref:u.ref,quote:u.quote,correction:u.correction||false,risk:u.risk||'none',changes:[...changes.values()]};
}),next:p.next.type==='form'?{type:p.next.action,ref:p.next.ref||null,requestQuote:p.next.requestQuote}:p.next}:p;
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

test('emergency role rejection retains heater facts without a second paid call or invented danger',async()=>{
  const initial='heizung gehen nicht';
  const s=(await turn(empty(),initial,plan('In welchem Raum?', [{ref:'new1',quote:initial,equipment:'heater',defect:'funktioniert nicht'}]))).state;
  const text='heizung in wohnzimmer nur 1 heizung';
  const a=sdk([plan('Falls Wasser austritt, es nach Gas riecht oder Sie eine Gefahr bemerken, schützen Sie bitte zuerst sich und andere und melden Sie sich sofort bei mir.',[{ref:'active',quote:text,location:'Wohnzimmer',count:1}],{focus:'active'})]);
  await assert.rejects(a.converse(text,s,['cases']),e=>{
    assert.equal(e.diagnostic.reason,'unsupported_emergency_role');assert.equal(e.modelCalls,1);
    assert.equal(e.conversationState.issue.id,s.issue.id);assert.equal(e.conversationState.issue.equipment,'heater');
    assert.equal(e.conversationState.issue.location,'Wohnzimmer');assert.equal(e.conversationState.issue.count,1);
    assert.equal(e.conversationState.safety,null);assert.ok(portalActionState(e.conversationState).controls.save);
    assert.ok(e.toolEvents.some(t=>t.tool==='record_issues'&&t.ok));return true;
  });
  assert.equal(a.model.doGenerateCalls.length,1);
});

test('real danger preserves safety and blocks inappropriate conversational routing',async()=>{
  const message='Jetzt riecht es nach Gas.';
  const a=sdk([plan('Wenden Sie sich sofort an mich.',[{ref:'new1',quote:message,equipment:'Heizung',details:message,risk:'gas'}])]);
  await assert.rejects(a.converse(message,empty(),['cases']),e=>{
    assert.equal(e.diagnostic.reason,'unsupported_emergency_role');assert.equal(e.conversationState.safety.hazard,'gas');
    assert.equal(portalActionState(e.conversationState).controls.save,null);return true;
  });
});

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
test('lamp symptoms retain their reported precision in memory, subsequent model context and portal mapping',async()=>{
  for(const defect of ['geht nicht','geht gar nicht','funktioniert nicht','Lampe funktioniert nicht.','Lampe lässt sich nicht einschalten.']){
    const text='Meine Lampe: '+defect;
    let s=(await turn(empty(),text,plan('In welchem Raum?',[{ref:'new1',quote:text,equipment:'light',defect}]))).state;
    const id=s.issue.id;
    assert.equal(s.issue.defect,defect,'No local rewriting into a more specific fault');
    assert.equal(createAgentTurn(s,'wohnzimmer',['cases']).snapshot().issues[0].defect,defect);
    s=(await turn(s,'wohnzimmer',plan('Sie können fortfahren.',[{ref:'active',quote:'wohnzimmer',location:'Wohnzimmer'}],{focus:'active'}))).state;
    s=(await turn(s,'Nein, Schlafzimmer.',plan('Dann im Schlafzimmer.',[{ref:'active',quote:'Nein, Schlafzimmer.',location:'Schlafzimmer',correction:true}],{focus:'active'}))).state;
    assert.equal(s.issue.id,id);assert.equal(s.issue.defect,defect);assert.equal(s.issue.fieldFacts.defect.value,defect);
    const mapped=portalCaseFields(s.issue);assert.equal(mapped.unit,'Schlafzimmer');assert.ok(mapped.description.includes(defect));
    if(!defect.includes('einschalten'))assert.doesNotMatch(mapped.description,/einschalten/);
  }
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
test('invalid source cannot change facts after one bounded correction',async()=>{
  const s=await lamp(),bad=plan('Alles klar.',[{ref:'active',quote:'not said',location:'Küche'}],{focus:'active'}),a=sdk([bad,bad]);
  await assert.rejects(a.converse('Nein, Bad.',s,['cases']),e=>e.modelCalls===2&&e.conversationState.issue.location==='Wohnzimmer');
  assert.equal(a.model.doGenerateCalls.length,2);
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
 const inconsistent=structuredClone(good);inconsistent.next.type='prepare';assert.throws(()=>decodeCompactPlan(inconsistent),e=>e.diagnostic.detail==='incomplete_form_action');
});
test('future forwarding promises also trigger the bounded effect check',async()=>{
 const a=sdk([plan('Prüfen Sie das Formular, damit wir den Fall weiterleiten können.'),{allowed:false}]);
 await assert.rejects(a.converse('Wohnzimmer',await lamp(),['cases']),e=>e.modelCalls===2&&e.diagnostic.reason==='unconfirmed_success');
});

test('inactive action metadata cannot run an operation or discard valid facts',async()=>{
 const w=wirePlan(plan('Alles klar.',[{ref:'new1',quote:'Eine Lampe ist kaputt.',equipment:'light',count:1}]));
 w.next={type:'none',action:'prepare',ref:'active',target:'cases',requestQuote:'unused'};
 assert.equal(compactSchema().safeParse(w).success,false,'Conflicting action metadata is not part of the provider contract');
 assert.deepEqual(decodeCompactPlan(w).next,{type:'none'});
});

test('danger classification is separate from unknown and corrected customer fields',async()=>{
 const message='Kein Rauch, keine Funken und kein Brandgeruch.';
 const w=wirePlan(plan('Alles klar.',[{ref:'active',quote:message,risk:'none',details:message}],{focus:'active'}));
 assert.equal(compactSchema().safeParse(w).success,true);
 const r=await sdk([JSON.stringify(w)]).converse(message,await lamp(),['cases']);
 assert.equal(r.state.safety,null);assert.equal(r.state.issue.details,message);
 const danger=structuredClone(w);danger.updates[0].risk='electric';
 const previouslyDangerous=await lamp();previouslyDangerous.safety={hazard:'electric',urgency:'emergency'};
 const preserved=await sdk([JSON.stringify(w)]).converse(message,previouslyDangerous,['cases']);
 assert.equal(preserved.state.safety.hazard,'electric');
 assert.equal(compactSchema().safeParse({...w,updates:[{...w.updates[0],changes:[{field:'risk',status:'unknown',value:null,quote:message}]}]}).success,false);
});

test('stale display focus cannot discard the current room correction',async()=>{
 const s=await lamp(),id=s.issue.id;
 const r=await turn(s,'Nein, Schlafzimmer.',plan('Dann im Schlafzimmer.',[{ref:'active',quote:'Nein, Schlafzimmer.',location:'Schlafzimmer',correction:true}],{focus:'new1'}));
 assert.equal(r.state.issue.id,id);assert.equal(r.state.issue.location,'Schlafzimmer');assert.equal(r.state.issues.length,1);
 assert.equal(r.requestedAction,null);assert.ok(r.toolEvents.some(e=>e.tool==='focus_hint'));
 assert.equal(portalCaseFields(r.state.issue).unit,'Schlafzimmer');
});

test('invalid display hint never moves facts to a different existing issue',async()=>{
 const s=(await turn(empty(),'Lampe im Bad kaputt. Heizung im Flur kalt.',plan('Zwei Anliegen.',[
  {ref:'new1',quote:'Lampe im Bad kaputt.',equipment:'light',defect:'kaputt',location:'Bad'},
  {ref:'new2',quote:'Heizung im Flur kalt.',equipment:'heater',defect:'kalt',location:'Flur'},
 ],{focus:'new2'}))).state;
 const ids=s.issues.map(i=>i.id);
 const r=await turn(s,'Die Lampe ist im Schlafzimmer.',plan('Dann im Schlafzimmer.',[{ref:'other1',quote:'Die Lampe ist im Schlafzimmer.',location:'Schlafzimmer',correction:true}],{focus:'new4'}));
 assert.deepEqual(r.state.issues.map(i=>i.id),ids);
 assert.equal(r.state.issues.find(i=>i.equipment==='light').location,'Schlafzimmer');
 assert.equal(r.state.issues.find(i=>i.equipment==='heater').location,'Flur');
});

test('exact later field evidence extends the source span without inventing text',async()=>{
 const message='Die Lampe ist kaputt. Den Beginn weiss ich nicht.';
 const w=wirePlan(plan('Das ist in Ordnung.',[{ref:'active',quote:'Die Lampe ist kaputt.',unknown:[{field:'since',quote:'Den Beginn weiss ich nicht.'}]}],{focus:'active'}));
 const r=await sdk([JSON.stringify(w)]).converse(message,await lamp(),['cases']);
 assert.equal(r.state.issue.fieldFacts.since.status,'unknown');assert.equal(r.state.issue.since,null);
 assert.equal(r.state.issue.location,'Wohnzimmer');
 const forged=structuredClone(w);forged.updates[0].changes[0].quote='Seit gestern';
 assert.throws(()=>decodeCompactPlan(forged,message),e=>e.diagnostic.detail==='field_quote_not_in_message');
});

test('source coverage cannot cross into a second issue or choose ambiguous evidence',async()=>{
 const message='Lampe im Bad kaputt. Heizung im Flur kalt.';
 const w=wirePlan(plan('Zwei Anliegen.',[
  {ref:'new1',quote:'Lampe im Bad kaputt.',equipment:'light',defect:'kaputt',location:'Bad'},
  {ref:'new2',quote:'Heizung im Flur kalt.',equipment:'heater',defect:'kalt',location:'Flur'},
 ]));
 w.updates[0].changes.find(c=>c.field==='location').quote='im Flur';
 await assert.rejects(sdk([JSON.stringify(w)]).converse(message,empty(),['cases']),e=>e.conversationState.issues.length===0&&e.diagnostic.reason==='invalid_record_issues');
 const ambiguous=wirePlan(plan('Unbekannt.',[{ref:'new1',quote:'Lampe kaputt.',unknown:[{field:'since',quote:'Unbekannt.'}]}]));
 assert.throws(()=>decodeCompactPlan(ambiguous,'Lampe kaputt. Unbekannt. Heizung kalt. Unbekannt.'),e=>e.diagnostic.detail==='ambiguous_field_quote');
});

test('form operation carries one typed intent and no contradictory navigation fields',()=>{
 const p=wirePlan(plan('Ich öffne die Angaben.',[],{topic:'issue',focus:'active',next:{type:'form',action:'prepare',ref:'active',requestQuote:'Bitte vorbereiten.'}}));
 assert.equal(compactSchema().safeParse(p).success,true);
 assert.deepEqual(decodeCompactPlan(p).next,{type:'form',action:'prepare',ref:'active',requestQuote:'Bitte vorbereiten.'});
 const bad=structuredClone(p);bad.next.target='cases';assert.equal(compactSchema().safeParse(bad).success,false);
 const missing=structuredClone(p);delete missing.next.requestQuote;assert.equal(compactSchema().safeParse(missing).success,false);
});

test('repeated confirmed facts with their original quote cannot block preparation',async()=>{
 const s=await lamp(),id=s.issue.id;
 const p=plan('Ich öffne die Angaben.',[{ref:'active',quote:'Eine Lampe im Wohnzimmer ist kaputt.',equipment:'light',defect:'kaputt',location:'Wohnzimmer',count:1}],{focus:'active',next:{type:'form',action:'prepare',ref:'active',requestQuote:'Bitte vorbereiten.'}});
 const r=await turn(s,'Bitte vorbereiten.',p);
 assert.equal(r.requestedAction,'prepare');assert.equal(r.state.issue.id,id);assert.equal(r.state.issue.revision,s.issue.revision);
 assert.ok(!r.toolEvents.some(e=>e.tool==='record_issues'));assert.equal(r.state.issue.preparation.status,'not_prepared');
});

test('no-op removal cannot hide changed values, another issue, or new uncertainty',async()=>{
 const s=await lamp();
 const changed=plan('Ich öffne die Angaben.',[{ref:'active',quote:'Old quote',equipment:'light',location:'Küche'}],{next:{type:'form',action:'prepare',ref:'active',requestQuote:'Bitte vorbereiten.'}});
 await assert.rejects(turn(s,'Bitte vorbereiten.',changed),e=>e.conversationState.issue.location==='Wohnzimmer'&&e.toolEvents.length===0);
 const duplicate=plan('Alles klar.',[{ref:'new1',quote:'Old quote',equipment:'light',location:'Wohnzimmer'}]);
 await assert.rejects(turn(s,'Bitte vorbereiten.',duplicate),e=>e.conversationState.issues.length===1);
 const unsure=await turn(s,'Vielleicht doch eine.',plan('Die Anzahl ist noch unsicher.',[{ref:'active',quote:'Vielleicht doch eine.',count:1,uncertain:[{field:'count',quote:'Vielleicht doch eine.'}]}],{focus:'active'}));
 assert.equal(unsure.state.issue.fieldFacts.count.status,'uncertain');assert.equal(unsure.state.issue.count,1);
});

test('navigation grammar only admits current portal destinations for each access',async()=>{
 for(const available of [['tenantSupport','tenantDocuments'],['ownerCases','ownerDocuments'],['cases','documents'],['cases','tasks']]){
  const t=createAgentTurn(empty(),'Wo sehe ich meine Anliegen?',available);
  const schema=compactSchema(t);
  const json=JSON.stringify(z.toJSONSchema(schema));
  for(const target of available){
   const p=plan('Über diesen Button gelangen Sie zur Ansicht.',[],{next:{type:'view',target}});
   assert.equal(schema.safeParse(p).success,true);
   const a=sdk([p]);const result=await a.converse('Wo sehe ich meine Anliegen?',empty(),available);
   assert.deepEqual(result.navigation,[target]);assert.equal(result.modelCalls,1);
   assert.equal(t.schemas.show_view.safeParse({target}).success,true);
  }
  for(const target of ['tenantSupport','ownerCases','cases','missing-view'].filter(x=>!available.includes(x))){
   assert.equal(schema.safeParse(plan('Ansicht',[],{next:{type:'view',target}})).success,false);
   assert.equal(t.schemas.show_view.safeParse({target}).success,false);
   assert.ok(!json.includes('"'+target+'"'));
   assert.equal((await t.tools.show_view.execute({target},{})).ok,false);
  }
 }
});

test('no available navigation omits view action without blocking an ordinary answer',async()=>{
 const t=createAgentTurn(empty(),'Hallo',[]);
 const schema=compactSchema(t);
 assert.doesNotThrow(()=>z.toJSONSchema(schema));
 assert.equal(schema.safeParse(plan('Guten Tag.')).success,true);
 assert.equal(schema.safeParse(plan('Ansicht',[],{next:{type:'view',target:'cases'}})).success,false);
 const r=await sdk([plan('Guten Tag.')]).converse('Hallo',empty(),[]);
 assert.deepEqual(r.navigation,[]);assert.equal(r.modelCalls,1);
});

test('one evidence correction recovers the screenshot lamp without losing facts or duplicating issues',async()=>{
 const message='Seit gestern funktioniert eine Lampe im Wohnzimmer nicht.';
 const good=wirePlan(plan('Das ist ärgerlich.',[{ref:'new1',quote:message,equipment:'light',defect:'funktioniert nicht',location:'Wohnzimmer',since:'Seit gestern',count:1}]));
 const bad=structuredClone(good);bad.updates[0].changes.find(c=>c.field==='defect').quote='Lampe funktioniert nicht';
 const corrected={...good,updates:good.updates.map(({quote,changes,...u})=>({...u,source:'p0',changes:changes.map(({quote,...c})=>({...c,source:'p0'}))}))};
 const a=sdk([JSON.stringify(bad),JSON.stringify(corrected)]);
 const r=await a.converse(message,empty(),['cases']);
 assert.equal(r.modelCalls,2);assert.equal(r.repaired,true);assert.equal(r.repairScope,'source_evidence');
 assert.equal(r.state.issues.length,1);assert.equal(r.state.issue.defect,'funktioniert nicht');
 const mapped=portalCaseFields(r.state.issue);assert.equal(mapped.unit,'Wohnzimmer');assert.match(mapped.description,/Seit gestern/);
 const next=await turn(r.state,'Nein, Schlafzimmer.',plan('Alles klar.',[{ref:'active',quote:'Nein, Schlafzimmer.',location:'Schlafzimmer',correction:true}]));
 assert.equal(next.state.issue.id,r.state.issue.id);assert.equal(next.state.issue.defect,'funktioniert nicht');assert.equal(next.state.issue.since,'Seit gestern');
 assert.equal(portalCaseFields(next.state.issue).unit,'Schlafzimmer');
});

test('repeated invalid evidence stops after one correction and cannot mutate prior facts',async()=>{
 const state=await lamp(),before=JSON.stringify(state);
 const bad=wirePlan(plan('Alles klar.',[{ref:'active',quote:'Nein, Schlafzimmer.',location:'Küche',correction:true}]));
 bad.updates[0].changes[0].quote='Küche';
 const a=sdk([JSON.stringify(bad),JSON.stringify(bad)]);
 await assert.rejects(a.converse('Nein, Schlafzimmer.',state,['cases']),e=>e.modelCalls===2&&e.conversationState.issue.location==='Wohnzimmer');
 assert.equal(JSON.stringify(state),before);assert.equal(a.model.doGenerateCalls.length,2);
});

test('evidence correction obeys the existing cost guard before its second call',async()=>{
 let guards=0;
 const bad=wirePlan(plan('Antwort',[{ref:'new1',quote:'invented',equipment:'light'}]));
 const a=sdk([JSON.stringify(bad)],async()=>{if(++guards===2)throw Object.assign(Error('budget'),{code:'PREVIEW_CREDIT_BOUNDARY'});});
 await assert.rejects(a.converse('Lampe kaputt',empty(),['cases']),e=>e.code==='PREVIEW_CREDIT_BOUNDARY'&&e.modelCalls===1&&e.conversationState.issues.length===0);
 assert.equal(a.model.doGenerateCalls.length,1);
});

test('repair grammar only permits literal original passages, including punctuation and long text',()=>{
 const message='Seit gestern funktioniert eine Lampe im Wohnzimmer nicht.';
 const good=wirePlan(plan('Antwort',[{ref:'new1',quote:message,defect:'funktioniert nicht'}]));
 const repair=evidenceRepairSchema(compactSchema(),message,good),schema=repair.schema;
 const corrected={...good,updates:good.updates.map(({quote,changes,...u})=>({...u,source:'p0',changes:changes.map(({quote,...c})=>({...c,source:'p0'}))}))};
 assert.equal(schema.safeParse(corrected).success,true);
 assert.deepEqual(repair.restore(corrected),good);
 const bad=structuredClone(good);bad.updates[0].changes[0].quote='Lampe funktioniert nicht';
 assert.equal(schema.safeParse(bad).success,false);
 const long='A'.repeat(700)+'. Zweites Anliegen!';
 const longRepair=evidenceRepairSchema(compactSchema(),long,{updates:[]});
 for(const text of Object.values(longRepair.sources))assert.ok(long.includes(text));
 const json=z.toJSONSchema(longRepair.schema);
 const enums=[];function walk(x){if(!x||typeof x!=='object')return;if(x.enum&&x.enum.some(v=>v==='p0'))enums.push(x.enum);Object.values(x).forEach(walk);}walk(json);
 assert.ok(enums.length);for(const values of enums)for(const value of values)assert.ok(Object.hasOwn(longRepair.sources,value));
});
