// Contract tests with generated-output doubles. Real Mercury evidence is separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {IDBFactory} from 'fake-indexeddb';
import {MockLanguageModelV4} from 'ai/test';
import {createMora} from '../assets/mora-client.js';
import {createChatHandler} from '../api/chat.js';
import {generateUnderstandingResult} from '../lib/mora/understanding.js';
import {modelContext} from '../lib/mora/context.js';
import {processTurn} from '../lib/mora/engine.js';
import {readSession} from '../lib/mora/session.js';
import {draftActionState,issueContent,mapServiceDraft,preparationState,draftFields} from '../assets/mora-data.js';

const generate=raw=>new MockLanguageModelV4({doGenerate:async()=>({content:[{type:'text',text:JSON.stringify(raw)}],
 finishReason:{unified:'stop',raw:'stop'},warnings:[],usage:{inputTokens:{total:100},outputTokens:{total:70}}})});
const understand=raw=>async(message,state)=>({mode:'model',data:(await generateUnderstandingResult(message,state,generate(raw))).data});
const lamp={reply:'Wo ist die Lampe?',intent:'issue',updates:[{ref:'new',equipment:'light',defect:'geht nicht'}],ask:{field:'location',text:'Wo ist die Lampe?'}};
const offer={reply:'Sie können das Anliegen jetzt vorbereiten.',intent:'issue',updates:[{ref:'active',location:'Wohnzimmer'}],actions:[{kind:'prepare_draft'}]};
const thanks={reply:'Gerne.',intent:'general'};
const html=readFileSync('index.html','utf8');
async function fixture(outputs){
 const indexedDB=new IDBFactory();let failReceipt=false,calls=0,receipts=0;
 const handler=createChatHandler(async(message,state)=>{calls++;return understand(outputs.shift())(message,state);});
 const open=async(saved)=>{
  const dom=new JSDOM(html,{url:'https://mora.test',pretendToBeVisual:true});const {window}=dom;
  window.indexedDB=indexedDB;window.scrollTo=()=>{};if(saved)window.sessionStorage.setItem('morada.mora.v2.thread',saved);
  const ui=createMora(window.document,window,async(path,options)=>{
   assert.equal(path,'/api/chat');const body=JSON.parse(options.body);
   if(body.draftReceipt){receipts++;if(failReceipt)throw Error('Receipt network failure');}
   const res={setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;}};
   await handler({method:'POST',body},res);return {ok:res.statusCode===200,json:async()=>res.body};
  });await ui.ready;return {ui,window,doc:window.document};
 };
 return {open,calls:()=>calls,receipts:()=>receipts,failReceipt:value=>{failReceipt=value;}};
}
const handovers=f=>[...f.doc.querySelectorAll('#moraMessages [data-action-type=handover]')];

test('Full action lifecycle: question → single offer → no repeated offer → receipt → reload → same draft update',async()=>{
 const fx=await fixture([lamp,offer,{reply:'Seit gestern.',intent:'issue',updates:[{ref:'active',since:'gestern'}]},thanks,
  {reply:'Sie können den bestehenden Entwurf aktualisieren.',intent:'issue',updates:[{ref:'active',location:'Schlafzimmer',correction:true}],actions:[{kind:'prepare_draft'}]},thanks]);
 let f=await fx.open();
 try{
  await f.ui.submit({message:'lampe kaputt'});assert.equal(f.doc.getElementById('moraPrepareIssue').hidden,true);assert.equal(handovers(f).length,0);
  await f.ui.submit({message:'wohnzimmer'});assert.equal(handovers(f).length,1);
  await f.ui.submit({message:'seit gestern'});assert.equal(handovers(f).length,0);assert.equal(f.doc.getElementById('moraPrepareIssue').hidden,false);
  await Promise.all([f.ui.onAction({type:'handover'}),f.ui.onAction({type:'handover'})]);
  const id=f.ui.getDrafts()[0].id;assert.equal(fx.receipts(),1);assert.equal(handovers(f).length,0);
  const context=modelContext(readSession(f.ui.getState().session));assert.equal(context.activeIssue.draftAction.canOffer,false);assert.equal(context.activeIssue.draftAction.status,'portal_received');
  await f.ui.submit({message:'danke'});assert.equal(handovers(f).length,0);assert.equal(f.doc.getElementById('moraPrepareIssue').hidden,true);
  const saved=f.window.sessionStorage.getItem('morada.mora.v2.thread');f.window.close();f=await fx.open(saved);
  assert.equal(f.ui.getPreparationState(),'portal_received');assert.equal(handovers(f).length,0);assert.equal(f.doc.getElementById('moraPrepareIssue').hidden,true);
  await f.ui.submit({message:'Nein, ich meinte Schlafzimmer.'});assert.equal(handovers(f).length,1);assert.equal(handovers(f)[0].textContent,'Entwurf aktualisieren');
  await f.ui.onAction({type:'handover'});assert.equal(f.ui.getDrafts().length,1);assert.equal(f.ui.getDrafts()[0].id,id);assert.equal(f.doc.getElementById('moraDraftLocation').value,'Schlafzimmer');
  await f.ui.submit({message:'danke'});assert.equal(handovers(f).length,0);assert.equal(f.doc.getElementById('moraPrepareIssue').hidden,true);
 }finally{f.window.close();}
});

test('Receipt failure cannot let a model conversation proceed with an obsolete preparation state',async()=>{
 const fx=await fixture([lamp,offer,thanks]);let f=await fx.open();
 try{
  await f.ui.submit({message:'lampe kaputt'});await f.ui.submit({message:'wohnzimmer'});fx.failReceipt(true);
  await f.ui.onAction({type:'handover'});assert.equal(f.ui.getDrafts().length,1);assert.equal(f.ui.getDrafts()[0].receiptPending,true);
  await f.ui.submit({message:'danke'});assert.equal(fx.calls(),2);assert.match(f.doc.getElementById('moraMessages').textContent,/Status konnte/);assert.equal(handovers(f).length,0);
  fx.failReceipt(false);await f.ui.onAction({type:'retry'});assert.equal(fx.calls(),3);assert.equal(f.ui.getState().issue.preparation.status,'portal_received');assert.equal(handovers(f).length,0);
 }finally{f.window.close();}
});

test('A receipt changes signed action state without inserting a canned assistant turn into model history',async()=>{
 const first=await processTurn({message:'lampe kaputt'},null,understand(lamp));
 const result=await processTurn({draftReceipt:{issueId:first.state.issue.id,revision:first.state.issue.revision,status:'portal_received'}},first.state,()=>assert.fail('No model call'));
 assert.deepEqual(result.state.history,first.state.history);assert.equal(draftActionState(result.state.issue).canOffer,false);
 assert.equal(result.state.pendingKey,null);assert.equal(modelContext(result.state).pendingQuestionText,null);
});

test('Repeated explicit unknown information changes audit evidence without reopening an unchanged draft',async()=>{
 let turn=await processTurn({message:'Eine Lampe im Wohnzimmer geht nicht. Beginn weiss ich nicht.'},null,understand({reply:'Sie können einen Entwurf vorbereiten.',intent:'issue',updates:[{ref:'new',equipment:'light',location:'Wohnzimmer',defect:'geht nicht',unknownAnswers:[{field:'since',quote:'Beginn weiss ich nicht'}]}],actions:[{kind:'prepare_draft'}]}));
 turn=await processTurn({draftReceipt:{issueId:turn.state.issue.id,revision:turn.state.issue.revision,status:'portal_received'}},turn.state,()=>assert.fail());
 const revision=turn.state.issue.revision;
 turn=await processTurn({message:'Ich weiss weiterhin nicht seit wann.'},turn.state,understand({reply:'Das kann offenbleiben.',intent:'issue',updates:[{ref:'active',unknownAnswers:[{field:'since',quote:'Ich weiss weiterhin nicht seit wann'}]}]}));
 assert.equal(turn.state.issue.revision,revision);assert.equal(preparationState(turn.state.issue),'portal_received');assert.equal(draftActionState(turn.state.issue).canOffer,false);
});

test('Legacy local draft snapshots survive the content comparison migration',async()=>{
 const turn=await processTurn({message:'lampe kaputt'},null,understand(lamp));const issue=turn.state.issue;
 const legacy=mapServiceDraft(issue);legacy.sourceContent=JSON.stringify(draftFields.map(key=>issue[key]??null));
 assert.equal(preparationState(issue,legacy),'portal_received');
 const changed=structuredClone(issue);changed.fieldFacts.equipment.source='different audit wording';assert.equal(issueContent(issue),issueContent(changed));
 changed.location='Schlafzimmer';assert.equal(preparationState(changed,legacy),'ready');
});

test('An existing completed action cannot be proposed again on a contact or thank-you turn',async()=>{
 let turn=await processTurn({message:'lampe kaputt'},null,understand(lamp));
 turn=await processTurn({draftReceipt:{issueId:turn.state.issue.id,revision:turn.state.issue.revision,status:'portal_received'}},turn.state,()=>assert.fail());
 for(const intent of ['contact','general'])await assert.rejects(generateUnderstandingResult('Danke',turn.state,generate({reply:'Ich kann einen Entwurf vorbereiten.',intent,actions:[{kind:'prepare_draft'}]})),{type:'invalid_model_output'});
});

test('Draft existence and current content are explicit; a pre-click freshness claim is rejected',async()=>{
 const first=await processTurn({message:'lampe kaputt'},null,understand(lamp));
 assert.equal(modelContext(first.state).activeIssue.draftAction.draftExists,false);
 await assert.rejects(generateUnderstandingResult('seit gestern',first.state,generate({reply:'Der Entwurf ist damit aktuell.',intent:'issue',updates:[{ref:'active',since:'gestern'}]})),{type:'invalid_model_output'});
 const saved=await processTurn({draftReceipt:{issueId:first.state.issue.id,revision:first.state.issue.revision,status:'portal_received'}},first.state,()=>assert.fail());
 assert.equal(modelContext(saved.state).activeIssue.draftAction.draftExists,true);assert.equal(modelContext(saved.state).activeIssue.draftAction.chatFactsInDraft,true);
 const changed=await processTurn({message:'Wohnzimmer'},saved.state,understand({reply:'Sie können den bestehenden Entwurf aktualisieren.',intent:'issue',updates:[{ref:'active',location:'Wohnzimmer'}],actions:[{kind:'prepare_draft'}]}));
 assert.equal(modelContext(changed.state).activeIssue.draftAction.chatFactsInDraft,false);assert.equal(modelContext(changed.state).activeIssue.draftAction.draftExists,true);
});

test('A targeted factual update classified as general uses the same resulting action state as the engine',async()=>{
 let turn=await processTurn({message:'lampe kaputt'},null,understand(lamp));
 turn=await processTurn({draftReceipt:{issueId:turn.state.issue.id,revision:turn.state.issue.revision,status:'portal_received'}},turn.state,()=>assert.fail());
 turn=await processTurn({message:'Wohnzimmer'},turn.state,understand({reply:'Sie können den bestehenden Entwurf aktualisieren.',intent:'general',updates:[{ref:'active',location:'Wohnzimmer'}],actions:[{kind:'prepare_draft'}]}));
 assert.equal(turn.state.issue.location,'Wohnzimmer');assert.equal(turn.state.actions[0].label,'Entwurf aktualisieren');
});

test('A new fixture cannot overwrite a prepared issue; the genuine repair creates a separate issue',async()=>{
 let turn=await processTurn({message:'lampe kaputt'},null,understand(lamp));
 turn=await processTurn({draftReceipt:{issueId:turn.state.issue.id,revision:turn.state.issue.revision,status:'portal_received'}},turn.state,()=>assert.fail());
 const original=structuredClone(turn.state.issue);let calls=0;
 const sdk=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async()=>({content:[{type:'text',text:JSON.stringify({reply:'Sie können ein weiteres Anliegen vorbereiten.',intent:'issue',updates:[{ref:++calls===1?'active':'new',equipment:'heater',location:'Bad',defect:'bleibt kalt'}]})}],finishReason:{unified:'stop',raw:'stop'},warnings:[],usage:{inputTokens:{total:100},outputTokens:{total:80}}})});
 const result=await generateUnderstandingResult('Ausserdem wird die Heizung im Bad nicht warm.',turn.state,sdk);
 assert.equal(calls,2);
 turn=await processTurn({message:'Ausserdem wird die Heizung im Bad nicht warm.'},turn.state,async()=>({mode:'model',data:result.data}));
 assert.equal(turn.state.issues.length,2);assert.equal(turn.state.issue.equipment,'heater');
 assert.deepEqual(turn.state.issues.find(issue=>issue.id===original.id).preparation,original.preparation);
 assert.equal(turn.state.issues.find(issue=>issue.id===original.id).equipment,'light');
});
