// Contract fixtures only. These are not live-model conversation evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createSimpleChatHandler} from '../api/chat-simple.js';
import {createSimpleService} from '../lib/mora/simple/service.js';
import {hydrateSimple,projectDecision,commitDecision,simpleContext,beginPreparation,acceptReceipt} from '../lib/mora/simple/state.js';
import {draftSummary,mapServiceDraft} from '../assets/mora-data.js';
import {readSession} from '../lib/mora/session.js';
import {createMora} from '../assets/mora-client.js';

const plan=(reply,updates=[],extra={})=>({reply,intent:'issue',updates,actions:[],...extra});
const patch=(ref,quote,fields)=>({ref,quote,...fields});
const ready=()=>({ready:true,provider:'gateway',model:'inception/mercury-2.5'});
function service(decide,verify=()=>({violations:[]})){
  return createSimpleService({resolve:async()=>ready(),generate:async(stage,payload)=>({data:await(stage==='decision'?decide(payload):verify(payload)),usage:{inputTokens:1,outputTokens:1,inputTokenDetails:{cacheReadTokens:0},outputTokenDetails:{reasoningTokens:0}}})});
}
async function call(handler,body){
  const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(data){this.data=data;return this;}};
  await handler({method:'POST',body},res);return res;
}
const first='Eine Lampe im Wohnzimmer geht nicht.';
const firstPlan=()=>plan('Ich kann dafür einen lokalen Entwurf vorbereiten.',[patch('new1',first,{equipment:'light',location:'Wohnzimmer',defect:'lässt sich nicht einschalten',count:1})],{actions:[{kind:'prepare_draft'}]});
function stateWithOffer(){return commitDecision(projectDecision(hydrateSimple(null),first,firstPlan()),first,firstPlan()).state;}

test('C accepts one useful room question without provisional questionKey freezing',async()=>{
 const converse=service(({message})=>message==='lampe kaputt'?plan('Wo befindet sich die Lampe?',[patch('new1',message,{equipment:'light',defect:'kaputt'})],{ask:{field:'location'}}):plan('Ich kann das Anliegen als lokalen Entwurf vorbereiten.',[patch('active',message,{location:'Wohnzimmer'})],{actions:[{kind:'prepare_draft'}]}));
 let result=await converse('lampe kaputt',hydrateSimple(null));
 assert.equal(result.reply,'Wo befindet sich die Lampe?');assert.equal(result.modelCalls,2);assert.equal(result.state.pendingKey,'location');assert.equal(result.state.actions.length,0);
 result=await converse('wohnzimmer',result.state);assert.equal(result.state.issue.location,'Wohnzimmer');assert.equal(result.state.issue.equipment,'light');assert.equal(result.state.issue.preparation.status,'not_prepared');assert.equal(result.state.actions.length,1);
});
test('Only an accepted final proposal is remembered; bad candidate facts/history never commit',async()=>{
 let tries=0;
 const converse=service(()=>++tries===1?plan('Der Entwurf liegt bereit.',[patch('new1',first,{equipment:'light',location:'Bad',defect:'kaputt'})],{actions:[{kind:'prepare_draft'}]}):firstPlan(),payload=>payload.proposedReply.includes('liegt bereit')?{violations:[{kind:'unsupported_effect',quote:'Der Entwurf liegt bereit.',reason:'No storage receipt'}]}:{violations:[]});
 const before=hydrateSimple(null),result=await converse(first,before);
 assert.equal(before.issues.length,0);assert.equal(result.state.issues.length,1);assert.equal(result.state.issue.location,'Wohnzimmer');assert.equal(result.state.issue.draftOfferShown,true);assert.equal(result.modelCalls,4);assert.equal(result.repaired,true);
 assert.ok(!JSON.stringify(result.state.history).includes('liegt bereit'));assert.ok(!JSON.stringify(result.state).includes('"location":"Bad"'));
});
test('A repeated semantic failure remains an explicit error, preserving previous state',async()=>{
 const before=stateWithOffer(),snapshot=JSON.stringify(before);
 const converse=service(()=>plan('Wir melden uns morgen.'),()=>({violations:[{kind:'unsupported_effect',quote:'Wir melden uns morgen.',reason:'No contact integration'}]}));
 await assert.rejects(()=>converse('Morgen bin ich erreichbar.',before),e=>e.code==='MODEL_UNAVAILABLE' && e.modelCalls===4);
 assert.equal(JSON.stringify(before),snapshot);
});
test('Short corrections preserve other fields; unknown start and count uncertainty stay distinct',()=>{
 let state=stateWithOffer();
 state=projectDecision(state,'Nein, Schlafzimmer.',plan('Alles klar.',[patch('active','Nein, Schlafzimmer.',{location:'Schlafzimmer',correction:true})]));
 assert.equal(state.issue.location,'Schlafzimmer');assert.equal(state.issue.count,1);assert.equal(state.issue.equipment,'light');
 state=projectDecision(state,'Den Beginn weiss ich nicht.',plan('Das ist in Ordnung.',[patch('active','Den Beginn weiss ich nicht.',{unknown:[{field:'since',quote:'weiss ich nicht'}]})]));
 assert.equal(state.issue.since,null);assert.equal(state.issue.fieldFacts.since.status,'unknown');
 state=projectDecision(state,'Vielleicht doch zwei.',plan('Die Anzahl ist noch unsicher.',[patch('active','Vielleicht doch zwei.',{count:2,uncertain:[{field:'count',quote:'Vielleicht doch zwei.'}]})]));
 assert.equal(state.issue.count,1);assert.equal(state.issue.fieldFacts.count.status,'uncertain');assert.equal(state.issue.fieldFacts.count.candidate,2);
 assert.match(draftSummary(mapServiceDraft(state.issue)),/Anzahl: unsicher/);assert.match(draftSummary(mapServiceDraft(state.issue)),/Anzahl noch unsicher/);
});
test('Separate problems and topic switches keep exact sources and independent rooms',()=>{
 const message='Die Lampe im Flur ist kaputt. Zwei Heizkörper im Bad sind kalt.';
 let state=projectDecision(hydrateSimple(null),message,plan('Ich halte beide Anliegen getrennt.',[
  patch('new1','Die Lampe im Flur ist kaputt.',{equipment:'light',location:'Flur',defect:'kaputt'}),
  patch('new2','Zwei Heizkörper im Bad sind kalt.',{equipment:'heater',location:'Bad',defect:'kalt',count:2}),
 ]));
 assert.equal(state.issues.length,2);state=projectDecision(state,'Was bedeutet Akonto?',plan('Akonto ist eine Vorauszahlung.',[],{intent:'information'}));
 assert.deepEqual(state.issues.map(i=>[i.equipment,i.location,i.count]),[['light','Flur',null],['heater','Bad',2]]);
 assert.throws(()=>projectDecision(state,'Die Lampe ist kaputt.',plan('Okay.',[patch('other8','Die Lampe ist kaputt.',{since:'gestern'})])),/Unknown issue reference/);
 assert.throws(()=>projectDecision(state,'Hallo',plan('Okay.',[patch('active','gestern',{since:'gestern'})])),/exact current customer quote/);
});
test('Unknown equipment gets no arbitrary damage category',()=>{
 const state=projectDecision(hydrateSimple(null),'Das Ding beim Fenster klemmt.',plan('Welches Teil meinen Sie?',[patch('new1','Das Ding beim Fenster klemmt.',{defect:'klemmt'})],{ask:{field:'equipment'}}));
 assert.equal(state.issue.equipment,'unknown');assert.equal(state.issue.category,'general');
});
test('A multi-issue question must identify its target without forcing its wording',()=>{
 let state=stateWithOffer();
 state=projectDecision(state,'Der Heizkörper im Bad bleibt kalt.',plan('Ich halte das separat fest.',[patch('new1','Der Heizkörper im Bad bleibt kalt.',{equipment:'heater',location:'Bad',defect:'bleibt kalt'})]));
 assert.throws(()=>projectDecision(state,'Eine Frage dazu.',plan('Seit wann ist die Lampe defekt?',[],{ask:{field:'since'}})),/explicit target ref/);
 const next=projectDecision(state,'Eine Frage dazu.',plan('Seit wann ist die Lampe defekt?',[],{ask:{field:'since',ref:'other1'}}));
 assert.equal(next.issue.equipment,'light');assert.equal(next.pendingKey,'since');
});
test('Write ticket is idempotent; unissued/stale receipts cannot create a draft',()=>{
 const state=stateWithOffer(),ticket=beginPreparation(state);
 assert.deepEqual(beginPreparation(state),ticket);assert.equal(state.issue.preparation.status,'not_prepared');
 const concurrent=stateWithOffer();concurrent.issue.id=state.issue.id;concurrent.issues[0]=concurrent.issue;
 assert.equal(beginPreparation(concurrent).operationId,ticket.operationId);
 assert.throws(()=>acceptReceipt(state,{...ticket,operationId:randomUUID(),status:'portal_received'}),/Missing or stale/);
 assert.throws(()=>acceptReceipt(state,{...ticket,revision:ticket.revision+1,status:'portal_received'}),/Missing or stale/);
 const result=acceptReceipt(state,{...ticket,status:'portal_received'});assert.equal(state.issue.preparation.source,'client_write_readback');assert.match(result.reply,/auf diesem Gerät gespeichert/);
 const again=acceptReceipt(state,{...ticket,status:'portal_received'});assert.match(again.reply,/bereits bestätigt/);assert.equal(state.issues.length,1);
});
test('Information after storage updates the same draft only after a new completed operation',()=>{
 let state=stateWithOffer();const old=beginPreparation(state);acceptReceipt(state,{...old,status:'portal_received'});
 state=projectDecision(state,'Seit gestern.',plan('Das ergänze ich zu den Chatangaben.',[patch('active','Seit gestern.',{since:'gestern'})],{actions:[{kind:'prepare_draft'}]}));
 assert.equal(state.issues.length,1);const context=simpleContext(state).context.issues[0];assert.equal(context.draft.exists,true);assert.equal(context.draft.current,false);assert.equal(context.draftAction.operation,'update');
 const update=beginPreparation(state);assert.equal(update.draftId,old.draftId);assert.notEqual(update.operationId,old.operationId);
 acceptReceipt(state,{...update,status:'portal_received'});assert.equal(simpleContext(state).context.issues[0].draft.current,true);
 assert.throws(()=>beginPreparation(state),/not available/);
});
test('Danger retains context and allows a generated child-specific response without replacing it',async()=>{
 const message='Aus der Steckdose kommen Funken.';
 const converse=service(({message})=>message.includes('Funken')?plan('Bitte halten Sie Abstand und benutzen Sie die Steckdose nicht.',[patch('new1',message,{equipment:'socket',defect:'Funken',risk:'electric'})]):plan('Führen Sie das Kind bitte sofort aus dem Zimmer und bleiben Sie fern von der Steckdose.'));
 const first=await converse(message,hydrateSimple(null));const follow=await converse('Ein Kind ist noch im Zimmer.',first.state);
 assert.equal(follow.state.safety.hazard,'electric');assert.match(follow.reply,/Kind/);assert.notEqual(follow.reply,first.reply);
});

function fixture({failReceipt=false}={}){
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'https://test.invalid/?mora=c',pretendToBeVisual:true});
 const {window}=dom;window.indexedDB=new IDBFactory();window.scrollTo=()=>{};
 const handler=createSimpleChatHandler({converse:service(({message})=>message===first?firstPlan():message==='Seit gestern.'?plan('Seit gestern ergänzt.',[patch('active',message,{since:'gestern'})],{actions:[{kind:'prepare_draft'}]}):plan('Die Angaben bleiben im Chat.'))});
 const requests=[];
 const fetcher=async(url,options)=>{const body=JSON.parse(options.body);requests.push({url,body});
  if(body.draftReceipt?.status==='portal_received' && failReceipt){failReceipt=false;return {ok:false,json:async()=>({error:'Temporary receipt transport failure'})};}
  const r=await call(handler,body);return {ok:r.code<400,json:async()=>r.data};};
 const ui=createMora(window.document,window,fetcher,{mode:'simple'});return {window,ui,requests};
}
test('Browser C uses separate storage, proves readback before receipt and suppresses duplicate clicks',async()=>{
 const f=fixture();await f.ui.ready;await f.ui.submit({message:first},first);
 const button={id:'prepare-request',type:'handover'};
 await Promise.all([f.ui.onAction(button),f.ui.onAction(button)]);
 assert.equal(f.ui.getDrafts().length,1);assert.equal(f.requests.filter(r=>r.body.actionId==='prepare-request').length,1);
 assert.equal(f.requests.filter(r=>r.body.draftReceipt?.status==='portal_received').length,1);
 assert.equal(f.ui.getState().issue.preparation.source,'client_write_readback');
 assert.ok(f.requests.every(r=>r.url==='/api/chat-simple'));assert.ok(f.window.sessionStorage.getItem('morada.mora.simple.v1.thread'));
 assert.equal(f.window.sessionStorage.getItem('morada.mora.v2.thread'),null);
 await f.ui.submit({message:'Seit gestern.'},'Seit gestern.');assert.equal(f.ui.getDrafts()[0].since,null);
 await f.ui.onAction(button);assert.equal(f.ui.getDrafts().length,1);assert.equal(f.ui.getDrafts()[0].since,'gestern');
});
test('A failed browser write never produces a storage success or a successful receipt',async()=>{
 const f=fixture();await f.ui.ready;await f.ui.submit({message:first},first);
 f.window.indexedDB={open(){throw Error('Disk full');}};
 await f.ui.onAction({id:'prepare-request',type:'handover'});
 assert.equal(f.ui.getDrafts().length,0);assert.equal(f.requests.filter(r=>r.body.draftReceipt?.status==='portal_received').length,0);
 assert.equal(f.ui.getState().issue.preparation.status,'error');assert.equal(f.ui.getPreparationState(),'error');
 assert.ok(!f.ui.getState().thread.some(m=>m.content.includes('wurde auf diesem Gerät gespeichert')));
});
test('Lost acknowledgement preserves the actual saved draft and synchronizes before the next model turn',async()=>{
 const f=fixture({failReceipt:true});await f.ui.ready;await f.ui.submit({message:first},first);
 await f.ui.onAction({id:'prepare-request',type:'handover'});assert.equal(f.ui.getDrafts().length,1);
 assert.equal(f.ui.getState().issue.preparation.status,'not_prepared');assert.ok(f.ui.getState().thread.at(-1).content.includes('nicht mit MORA abgeglichen'));
 await f.ui.submit({message:'Okay.'},'Okay.');assert.equal(f.ui.getState().issue.preparation.source,'client_write_readback');assert.equal(f.ui.getDrafts().length,1);
});
test('A mismatching IndexedDB readback cannot produce a successful receipt',async()=>{
 const f=fixture();await f.ui.ready;await f.ui.submit({message:first},first);
 const original=IDBObjectStore.prototype.get;
 IDBObjectStore.prototype.get=function(...args){const request=original.apply(this,args);
  if(this.name==='drafts')request.addEventListener('success',()=>{if(request.result)request.result.cause='unbelegte Ursache';});
  return request;};
 try{await f.ui.onAction({id:'prepare-request',type:'handover'});}finally{IDBObjectStore.prototype.get=original;}
 assert.equal(f.requests.filter(r=>r.body.draftReceipt?.status==='portal_received').length,0);
 assert.equal(f.ui.getState().issue.preparation.status,'error');assert.match(f.ui.getState().thread.at(-1).content,/nicht bestätigt/);
});
test('Browser shows the shared safety notice before awaiting the model request',async()=>{
 const f=fixture();await f.ui.ready;
 const pending=f.ui.submit({message:'Aus der Steckdose kommen Funken.'},'Aus der Steckdose kommen Funken.');
 assert.match(f.window.document.getElementById('moraMessages').textContent,/Abstand zu beschädigten elektrischen Teilen/);
 await pending;
});
