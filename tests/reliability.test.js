// Mock-driven regression tests of extraction → signed state → DOM → durable draft.
// These are contract evidence; genuine Mercury outputs are archived separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { MockLanguageModelV4 } from 'ai/test';
import { generateUnderstandingResult } from '../lib/mora/understanding.js';
import { processTurn } from '../lib/mora/engine.js';
import { readSession } from '../lib/mora/session.js';
import { createChatHandler } from '../api/chat.js';
import { createMora } from '../assets/mora-client.js';
import { explicitEquipmentCount, canonicalEquipment, mapServiceDraft, preparationState } from '../assets/mora-data.js';

const model=output=>new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async()=>({
 content:[{type:'text',text:JSON.stringify(output)}],finishReason:{unified:'stop',raw:'stop'},warnings:[],
 usage:{inputTokens:{total:100,noCache:100,cacheRead:0,cacheWrite:0},outputTokens:{total:50,text:40,reasoning:10}},
})});
async function turn(message,output,prior=null) {
 return processTurn({message},prior,async(message,state)=>({mode:'model',data:(await generateUnderstandingResult(message,state,model(output))).data}));
}
const output=patch=>({reply:'Wo befindet sich die Lampe?',intent:'issue',updates:[{ref:'new',category:'electricity',defect:'Lampe lässt sich nicht einschalten.',...patch}]});

test('Reported typo lamp: omitted model equipment is recovered from explicit evidence, then all fields reach the draft',async()=>{
 let r=await turn('meine lampe nicht gehen',output({equipment:'unknown'}));
 assert.equal(r.state.issue.equipment,'light');
 r=await turn('wohnzimmer, eine lampe, nein',{reply:'Sie können das Anliegen vorbereiten.',intent:'issue',updates:[{ref:'active',location:'Wohnzimmer',count:1,details:'Keine zusätzlichen Symptome bestätigt.'}],actions:[{kind:'prepare_draft'}]},r.state);
 const draft=mapServiceDraft(r.state.issue);
 assert.equal(draft.equipment,'light');assert.equal(draft.category,'electricity');assert.equal(draft.location,'Wohnzimmer');assert.equal(draft.count,1);
 assert.match(draft.defect,/nicht einschalten/);assert.equal(draft.fieldFacts.since.status,'not_provided');
 assert.equal(draft.since,null);assert.match(draft.summary,/Lampe \/ Leuchte/);
});

test('A full lamp message maps complete data and does not infer one from a grammatical singular',async()=>{
 const r=await turn('Meine Lampe im Wohnzimmer geht gar nicht.',output({location:'Wohnzimmer'}));
 const draft=mapServiceDraft(r.state.issue);assert.equal(draft.equipment,'light');assert.equal(draft.count,null);assert.equal(draft.location,'Wohnzimmer');
});

test('Short followups merge; room correction retains device, count and defect and removes stale description',async()=>{
 let r=await turn('Meine Lampe geht nicht.',output({}));
 for (const [message,patch] of [['Im Wohnzimmer.',{location:'Wohnzimmer'}],['Eine.',{count:1}],['Nein, ich meinte Schlafzimmer.',{location:'Schlafzimmer',correction:true}]]) r=await turn(message,{reply:'Möchten Sie etwas ergänzen?',intent:'issue',updates:[{ref:'active',...patch}]},r.state);
 const d=mapServiceDraft(r.state.issue);assert.equal(d.location,'Schlafzimmer');assert.equal(d.equipment,'light');assert.equal(d.count,1);assert.match(d.defect,/einschalten/);
 assert.doesNotMatch(d.description,/Wohnzimmer/);assert.equal(d.fieldFacts.location.status,'corrected');
});

test('Explicitly unknown start retracts an old time, but absent null values never erase known facts',async()=>{
 let r=await turn('Eine Lampe im Wohnzimmer geht seit gestern nicht.',output({equipment:'light',count:1,location:'Wohnzimmer',since:'gestern'}));
 r=await turn('Seit wann weiss ich doch nicht.',{reply:'Möchten Sie noch etwas ergänzen?',intent:'issue',updates:[{ref:'active',unknownAnswers:[{field:'since',quote:'Seit wann weiss ich doch nicht'}],location:null,count:null}]},r.state);
 const d=mapServiceDraft(r.state.issue);assert.equal(d.since,null);assert.equal(d.location,'Wohnzimmer');assert.equal(d.count,1);assert.equal(d.fieldFacts.since.status,'unknown');assert.match(d.summary,/Beginn: unbekannt/);
});

test('Several explicit facilities keep their count and scope',async()=>{
 const r=await turn('Drei Lampen im Flur gehen nicht.',output({equipment:'light',location:'Flur',count:3}));const d=mapServiceDraft(r.state.issue);
 assert.equal(d.count,3);assert.match(d.extent,/3/);assert.equal(d.equipment,'light');
});

test('Multiple issues, topic switch and targeted correction remain separate',async()=>{
 let r=await turn('Lampe im Wohnzimmer defekt. Heizung im Bad kalt.',{reply:'Welche Angaben möchten Sie ergänzen?',intent:'issue',updates:[
 {ref:'new',sourceQuote:'Lampe im Wohnzimmer defekt',equipment:'light',location:'Wohnzimmer',defect:'ohne Funktion'},
 {ref:'new',sourceQuote:'Heizung im Bad kalt',equipment:'heater',location:'Bad',defect:'bleibt kalt'}]});
 const lampId=r.state.issues[0].id;
 r=await turn('Wo ist mein Vertrag?',{reply:'Persönliche Dokumente sind noch nicht angebunden.',intent:'documents'},r.state);
 assert.equal(r.state.issues.length,2);
 r=await turn('Die Lampe ist im Schlafzimmer.',{reply:'Möchten Sie den Entwurf vorbereiten?',intent:'issue',updates:[{ref:'active',location:'Schlafzimmer',correction:true}],actions:[{kind:'prepare_draft'}]},r.state);
 assert.equal(r.state.issues[0].id,lampId);assert.equal(r.state.issues[0].location,'Schlafzimmer');assert.equal(r.state.issues[1].location,'Bad');
});

test('Unresolved contradiction is an uncertain candidate and preserves the last confirmed value',async()=>{
 let r=await turn('Eine Lampe im Wohnzimmer geht nicht.',output({count:1,location:'Wohnzimmer'}));
 r=await turn('Vielleicht zwei, ich bin unsicher.',{reply:'Ist eine oder sind zwei Lampen betroffen?',intent:'issue',updates:[{ref:'active',count:2,uncertainAnswers:[{field:'count',quote:'Vielleicht zwei, ich bin unsicher'}]}]},r.state);
 assert.equal(r.state.issue.count,1);assert.equal(r.state.issue.fieldFacts.count.status,'uncertain');assert.equal(r.state.issue.fieldFacts.count.candidate,2);assert.doesNotMatch(r.state.issue.extent,/^2 /);
});

test('Vocabulary does not guess mixed objects or unseen components and maps aliases centrally',()=>{
 assert.equal(canonicalEquipment('Lampe / Leuchte'),'light');assert.equal(canonicalEquipment('unknown','Lampe und Steckdose gehen nicht'),'unknown');
 assert.equal(canonicalEquipment(null,'Das Ding unter dem Lavabo'),'unknown');assert.equal(canonicalEquipment(null,'Nicht die Lampe, sondern etwas anderes'),'unknown');
 assert.equal(canonicalEquipment('Rollladen'),'Rollladen');
});

test('Unknown category remains general and retains the exact customer object',async()=>{
 const r=await turn('Das Wabbelteil am Fenster klemmt.',{reply:'Was meinen Sie mit Wabbelteil?',intent:'issue',updates:[{ref:'new',equipment:'Wabbelteil',category:'general',defect:'klemmt'}]});
 const d=mapServiceDraft(r.state.issue);assert.equal(d.category,'general');assert.equal(d.equipment,'Wabbelteil');
});

test('Safety works without a remote model; an unavailable action cannot enter the allowlist',async()=>{
 const r=await processTurn({message:'Aus der Steckdose kommen Funken.'},null,async()=>assert.fail('Must not call a model'));
 assert.equal(r.state.issue.urgency,'emergency');assert.match(r.reply,/112|Gefahr|Abstand/);
 await assert.rejects(turn('Bitte absenden',{reply:'Gesendet.',intent:'contact',actions:[{kind:'submit_request'}]}),{type:'invalid_model_output'});
});

async function uiFixture({failStorage=false}={}) {
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'https://mora.test',pretendToBeVisual:true});
 const {window}=dom;window.scrollTo=()=>{};window.indexedDB=new IDBFactory();
 if (failStorage) window.indexedDB.open=()=>{throw new Error('Storage unavailable');};
 let calls=0,receipts=0;const handler=createChatHandler(async(message,state)=>{
 calls++;const raw=state?.issue ? {reply:'Möchten Sie den Entwurf aktualisieren?',intent:'issue',updates:[{ref:'active',location:'Schlafzimmer',correction:true}],actions:[{kind:'prepare_draft'}]} : {...output({equipment:'unknown',count:1,location:'Wohnzimmer'}),reply:'Ich kann das Anliegen vorbereiten.',actions:[{kind:'prepare_draft'}]};
 return {mode:'model',data:(await generateUnderstandingResult(message,state,model(raw))).data};
 });
 const ui=createMora(window.document,window,async(url,opts)=>{
 assert.equal(url,'/api/chat','Preparation is not a submission');const body=JSON.parse(opts.body);if(body.draftReceipt)receipts++;
 const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
 await handler({method:'POST',body},res);return {ok:res.statusCode===200,json:async()=>res.body};
 });await ui.ready;return {ui,window,document:window.document,calls:()=>calls,receipts:()=>receipts};
}

test('DOM durable handover is idempotent under concurrent/repeated clicks and signed receipt does not infer or send',async()=>{
 const f=await uiFixture();try {
 await f.ui.submit({message:'meine lampe nicht gehen'});await Promise.all([f.ui.onAction({type:'handover'}),f.ui.onAction({type:'handover'})]);await f.ui.onAction({type:'handover'});
 assert.equal(f.ui.getDrafts().length,1);assert.equal(f.receipts(),1);assert.equal(f.calls(),1);
 assert.equal(f.document.getElementById('moraDraftEquipment').value,'light');assert.match(f.document.getElementById('moraDraftPicker').textContent,/Lampe \/ Leuchte · Wohnzimmer · Entwurf/);
 assert.equal(f.document.getElementById('moraPrepareIssue').hidden,true);assert.equal(f.ui.getState().issue.preparation.status,'portal_received');
 const signed=readSession(f.ui.getState().session);assert.equal(signed.issue.preparation.source,'client_local_storage');assert.equal(f.ui.getDrafts()[0].delivery,'not_sent');
 } finally {f.window.close();}
});

test('Additional chat information updates the SAME draft, preserving customer form edits and flagging conflicts',async()=>{
 const f=await uiFixture();try {
 await f.ui.submit({message:'meine lampe nicht gehen'});await f.ui.onAction({type:'handover'});const id=f.ui.getDrafts()[0].id;
 const input=f.document.getElementById('moraDraftDetails');input.value='Bitte am Nachmittag anrufen';input.dispatchEvent(new f.window.Event('input'));
 await f.ui.submit({message:'Nein, im Schlafzimmer.'});assert.ok(f.document.querySelector('[data-action-type=handover]:not(:disabled)') || !f.document.getElementById('moraPrepareIssue').hidden);
 await f.ui.onAction({type:'handover'});const d=f.ui.getDrafts()[0];assert.equal(f.ui.getDrafts().length,1);assert.equal(d.id,id);assert.equal(d.location,'Schlafzimmer');assert.equal(d.details,'Bitte am Nachmittag anrufen');assert.equal(d.equipment,'light');assert.equal(f.receipts(),2);
 } finally {f.window.close();}
});

test('Failed local portal storage never yields a success, can retry, and retains structured chat data',async()=>{
 const f=await uiFixture({failStorage:true});try {
 await f.ui.submit({message:'meine lampe nicht gehen'});await f.ui.onAction({type:'handover'});
 assert.equal(f.ui.getDrafts().length,0);assert.equal(f.ui.getState().issue.equipment,'light');assert.equal(f.ui.getPreparationState(),'error');assert.equal(f.receipts(),0);
 assert.match(f.document.getElementById('moraMessages').textContent,/konnte nicht.*gespeichert/);assert.equal(f.document.getElementById('service').checked,false);
 f.window.indexedDB=new IDBFactory();await f.ui.onAction({type:'handover'});assert.equal(f.ui.getDrafts().length,1);assert.equal(f.receipts(),1);
 } finally {f.window.close();}
});

test('Stale receipt cannot confirm a newer revision or claim delivery',async()=>{
 const r=await turn('Meine Lampe geht nicht.',output({}));const handler=createChatHandler();
 const {sealSession}=await import('../lib/mora/session.js');
 for (const receipt of [{issueId:r.state.issue.id,revision:999,status:'portal_received'},{issueId:r.state.issue.id,revision:r.state.issue.revision,status:'sent'}]) {
 const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
 await handler({method:'POST',body:{session:sealSession(r.state),draftReceipt:receipt}},res);assert.ok(res.statusCode>=400);
 }
});


test('An explicitly retracted device stays unknown in both signed state and the mapped draft',async()=>{
 let r=await turn('Meine Lampe geht nicht.',output({equipment:'light'}));
 r=await turn('Ich weiss nicht, was das Teil ist.',{reply:'Können Sie das Teil beschreiben?',intent:'issue',updates:[{ref:'active',unknownAnswers:[{field:'equipment',quote:'Ich weiss nicht, was das Teil ist'}]}]},r.state);
 assert.equal(r.state.issue.equipment,null);assert.equal(mapServiceDraft(r.state.issue).equipment,'unknown');
 r=await turn('Es ist rund.',{reply:'Möchten Sie noch etwas ergänzen?',intent:'issue',updates:[{ref:'active',details:'rund'}]},r.state);
 assert.equal(r.state.issue.equipment,null);assert.equal(mapServiceDraft(r.state.issue).equipment,'unknown');
});


test('Future passive transmission and unconfirmed preparation claims are rejected before display',async()=>{
 for(const reply of ['Die Angaben werden lokal gespeichert und erst nach Ihrem Klick übermittelt.','Ihr Anliegen ist im Servicebereich vorbereitet.']) {
  await assert.rejects(turn('Bitte vorbereiten',{...output({equipment:'light'}),reply}),{type:'invalid_model_output'});
 }
 const r=await turn('Bitte vorbereiten',{...output({equipment:'light'}),reply:'Sie können den Entwurf lokal prüfen. Er wird nicht übermittelt.'});
 assert.match(r.reply,/nicht übermittelt/);
});


test('Omitted explicit counts are recovered beside the named facility without counting days or guessing singular grammar',async()=>{
 assert.equal(explicitEquipmentCount('Meine Lampe geht seit einem Tag nicht.','light'),null);
 assert.equal(explicitEquipmentCount('Eine Lampe im Wohnzimmer geht nicht.','light'),1);
 assert.equal(explicitEquipmentCount('Vielleicht zwei Lampen, ich bin unsicher.','light'),null);
 const r=await turn('Eine Lampe geht nicht.',output({equipment:'light'}));assert.equal(r.state.issue.count,1);
});

test('A model cannot claim that a saved draft was updated before the explicit update click',async()=>{
 const r=await turn('Eine Lampe im Wohnzimmer geht nicht.',output({equipment:'light',location:'Wohnzimmer'}));
 r.state.issue.preparation={status:'portal_received',revision:r.state.issue.revision};
 await assert.rejects(turn('Nein, Schlafzimmer.',{reply:'Ich habe den Ort im Entwurf auf Schlafzimmer aktualisiert.',intent:'issue',updates:[{ref:'active',location:'Schlafzimmer',correction:true}]},r.state),{type:'invalid_model_output'});
});


test('An unknown quantity clears its stale numeric scope and records unknown separately from missing',async()=>{
 let r=await turn('Drei Lampen im Wohnzimmer gehen nicht.',output({equipment:'light',count:3}));
 r=await turn('Die Anzahl weiss ich nicht.',{reply:'Sie können das Anliegen vorbereiten.',intent:'issue',updates:[{ref:'active',unknownAnswers:[{field:'count',quote:'Die Anzahl weiss ich nicht'}]}]},r.state);
 assert.equal(r.state.issue.count,null);assert.equal(r.state.issue.extent,null);assert.equal(r.state.issue.fieldFacts.count.status,'unknown');
});


test('Canonical equipment aliases still pass the physical-component provenance guard',async()=>{
 const r=await turn('Unter dem Lavabo tropft Wasser.',{reply:'Wo genau tropft es?',intent:'issue',updates:[{ref:'new',equipment:'Rohr',category:'water',location:'unter dem Lavabo',defect:'tropft'}]});
 assert.notEqual(r.state.issue.equipment,'pipe');
});


test('Rejected language cannot discard independently validated facts; recovery is explicitly technical, not a model success',async()=>{
 let calls=0;const fixture=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async()=>({
  content:[{type:'text',text:JSON.stringify(++calls===1 ? {reply:'Die Angaben werden nach Ihrem Klick übermittelt.',intent:'issue',updates:[{ref:'new',equipment:'light',location:'Wohnzimmer',defect:'lässt sich nicht einschalten'}]} : {broken:true})}],
  finishReason:{unified:'stop',raw:'stop'},warnings:[],usage:{inputTokens:{total:100,noCache:100,cacheRead:0,cacheWrite:0},outputTokens:{total:50,text:40,reasoning:10}},
 })});
 const result=await generateUnderstandingResult('Eine Lampe im Wohnzimmer geht nicht.',null,fixture,{retainFactsOnReplyFailure:true});
 assert.equal(result.recoveredFacts,true);assert.equal(result.generationCount,2);assert.equal(result.totalUsage.inputTokens,200);
 const handler=createChatHandler(async()=>({mode:'recovery',recoveredFacts:true,data:result.data,usage:result.totalUsage,generationCount:2}));
 const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
 await handler({method:'POST',body:{message:'Eine Lampe im Wohnzimmer geht nicht.'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.body.responseMode,'recovery');assert.equal(res.body.recoveredFacts,true);assert.equal(res.body.modelCalls,2);
 assert.match(res.body.reply,/Technischer Hinweis/);assert.doesNotMatch(res.body.reply,/nach Ihrem Klick übermittelt/);
 const d=mapServiceDraft(res.body.issue);assert.equal(d.equipment,'light');assert.equal(d.location,'Wohnzimmer');assert.equal(d.count,1);assert.equal(d.delivery,'not_sent');
});

test('Invalid source attribution never becomes a retained fact recovery',async()=>{
 await assert.rejects(generateUnderstandingResult('Lampe im Wohnzimmer kaputt und Heizung im Bad kalt.',null,model({reply:'Es wird übermittelt.',intent:'issue',updates:[
 {ref:'new',equipment:'light',location:'Wohnzimmer',sourceQuote:'not customer evidence'},
 {ref:'new',equipment:'heater',location:'Bad',sourceQuote:'not customer evidence'}]}),{retainFactsOnReplyFailure:true}),{type:'invalid_model_output'});
});

test('Manual equipment edits use the same category mapping and retain other customer fields',()=>{
 const source={id:'i',revision:1,equipment:'light',category:'electricity',description:'Lampe geht nicht',location:'Wohnzimmer'};
 const existing={...mapServiceDraft(source),equipment:'heater',localEdits:{equipment:true}};
 const d=mapServiceDraft(source,existing);assert.equal(d.equipment,'heater');assert.equal(d.category,'heating');assert.equal(d.location,'Wohnzimmer');assert.ok(d.conflictFields.includes('equipment'));
});
