import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {portalCaseFields} from '../assets/mora-portal-map.js';
import {hydrateSimple,projectDecision,commitDecision} from '../lib/mora/simple/state.js';
import {createPortalChatHandler,controls} from '../api/portal-chat.js';
import {createPortalService} from '../lib/mora/portal/service.js';
import {checkPreviewCredits,MODEL,BASELINE_USED_USD,MAX_USED_USD} from '../lib/mora/portal/budget.js';
import {readSession} from '../lib/mora/session.js';

const plan=(updates=[],more={})=>({reply:'Wo befindet sich die Lampe?',intent:'issue',updates,actions:[],...more});
function update(s,message,changes,more={}) {const p=plan([{ref:s.issue?'active':'new1',quote:message,...changes}],more);return commitDecision(projectDecision(s,message,p),message,p).state;}
function lamp(){return update(hydrateSimple(null),'Eine Lampe im Wohnzimmer geht seit gestern nicht. Keine weiteren Symptome.',{equipment:'light',defect:'Lampe lässt sich nicht einschalten.',location:'Wohnzimmer',count:1,since:'seit gestern',details:'Keine weiteren Symptome.'},{reply:'Sie können noch etwas ergänzen.'});}
async function call(handler,body,method='POST'){let status=200,answer;await handler({method,body},{setHeader(){},status(n){status=n;return this;},json(v){answer=v;return this;}});return {status,body:answer};}
async function dom(fetcher){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(e.type!=='css-parsing'&&e.type!=='not-implemented')errors.push(e);});
 const d=new JSDOM(readFileSync('portal.html','utf8'),{url:'https://portal.example/portal.html?mora=legacy',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.structuredClone=structuredClone;w.fetch=fetcher;w.scrollTo=()=>{};w.confirm=()=>true;w.indexedDB=indexedDB;
  Object.defineProperty(w.navigator,'locks',{value:{request:async(_n,_opts,fn)=>typeof _opts==='function'?_opts({}):fn({})}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 }});
 for(let n=0;n<100&&d.window.eval('portalLoading');n++)await new Promise(r=>setTimeout(r,10));
 assert.equal(d.window.eval('portalLoading'),false,'native portal finished loading');
 if(errors.length){d.window.close();throw errors[0];}d.window.document.getElementById('entry-form').dispatchEvent(new d.window.Event('submit',{bubbles:true,cancelable:true}));return d;
}
const tick=()=>new Promise(r=>setTimeout(r,0));
async function settle(){for(let i=0;i<20;i++)await tick();}
async function prepare(w,label='Anliegen vorbereiten'){
 const b=[...w.document.querySelectorAll('.mora-portal-actions button')].find(b=>b.textContent===label);assert.ok(b,'missing '+label);b.click();b.click();await settle();
 assert.ok(w.document.querySelector('#opsEntryForm[data-mora-issue]'));
}
async function saveForm(w){const f=w.document.getElementById('opsEntryForm');assert.ok(f);f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();}


test('portal map: lamp, exact room/count/start/symptoms and actual portal category',()=>{
 const f=portalCaseFields(lamp().issue);assert.equal(f.category,'Schaden / Reparatur');assert.equal(f.unit,'Wohnzimmer');assert.match(f.title,/Lampe \/ Leuchte/);for(const text of ['Fachbereich: Elektrik / Beleuchtung','Anzahl: 1','seit gestern','Keine weiteren Symptome','Lampe lässt sich nicht einschalten'])assert.ok(f.description.includes(text));
});
test('short answers, explicit unknown start and room correction retain other facts',()=>{
 let s=hydrateSimple(null);s=update(s,'meine lampe nicht gehen',{equipment:'Lampe',defect:'Lampe lässt sich nicht einschalten.'},{ask:{field:'location',ref:'new1'}});
 s=update(s,'wohnzimmer',{location:'Wohnzimmer'},{ask:{field:'count',ref:'active'}});s=update(s,'Eine',{count:1},{ask:{field:'since',ref:'active'}});
 s=update(s,'Weiss ich nicht',{unknown:[{field:'since',quote:'Weiss ich nicht'}]});s=update(s,'Nein, Schlafzimmer',{location:'Schlafzimmer',correction:true});
 const f=portalCaseFields(s.issue);assert.equal(f.unit,'Schlafzimmer');assert.match(f.description,/Anzahl: 1/);assert.match(f.description,/Beginn: unbekannt/);assert.doesNotMatch(f.description,/Wohnzimmer/);assert.equal(s.issue.fieldFacts.location.status,'corrected');
});
test('multiple facilities and unrelated cases stay separate; unknown category is not guessed',()=>{
 const message='Zwei Lampen im Flur sind kaputt. Das spezielle Teil im Bad ist lose.';
 const p=plan([{ref:'new1',quote:'Zwei Lampen im Flur sind kaputt.',equipment:'light',defect:'kaputt',count:2,location:'Flur'},{ref:'new2',quote:'Das spezielle Teil im Bad ist lose.',equipment:'spezielles Teil',defect:'lose',location:'Bad'}],{activeIssueRef:'new2'});
 const s=projectDecision(hydrateSimple(null),message,p);assert.equal(s.issues.length,2);assert.equal(s.issues[0].count,2);assert.equal(s.issues[1].count,null);assert.equal(portalCaseFields(s.issues[1]).category,'Allgemein');
});
test('safety and topic changes suppress save; uncertainty cannot silently overwrite room',()=>{
 let s=lamp();assert.ok(controls(s).save);s=update(s,'Vielleicht doch im Flur',{location:'Flur',uncertain:[{field:'location',quote:'Vielleicht doch im Flur'}]});assert.equal(s.issue.location,'Wohnzimmer');assert.equal(controls(s).save,null);
 s=lamp();s.safety={hazard:'electric'};assert.equal(controls(s).save,null);s.safety=null;s.conversationTopic='information';assert.equal(controls(s).save,null);
});
test('preview-credit guard accepts approved top-up and rejects other grants or excess usage',()=>{
 assert.ok(checkPreviewCredits({balance:25-BASELINE_USED_USD,totalUsed:BASELINE_USED_USD}));for(const c of [{balance:4.6,totalUsed:.4},{balance:44.6,totalUsed:.4},{balance:25-MAX_USED_USD-.1,totalUsed:MAX_USED_USD+.1}])assert.throws(()=>checkPreviewCredits(c));
});
test('pending unverified customer corrections block server-side save tickets',()=>{
 const state=lamp();assert.ok(controls(state).save);state.portalPending=[{content:'Nein, doch anders.'}];assert.equal(controls(state).save,null);
});
test('general-message service boundary uses a test transport: one decision and lower reasoning',async()=>{
 let request,calls=0;const service=createPortalService({resolve:async()=>({ready:true,provider:'gateway',model:MODEL,createModel:()=>({})}),guard:async()=>{},generate:async options=>{request=options;calls++;return {output:plan([],{reply:'Wie kann ich Ihnen helfen?',intent:'general',activeIssueRef:null}),usage:{},finalStep:{providerMetadata:{}}};}});
 const result=await service('Guten Tag',hydrateSimple(null),['support']);assert.equal(calls,1);assert.equal(request.reasoning,'low');assert.equal(result.modelCalls,1);assert.equal(result.reply,'Wie kann ich Ihnen helfen?');
});
test('failed customer input is signed and passed to next turn as raw evidence',async()=>{
 let calls=0,received;const handler=createPortalChatHandler({converse:async(message,state)=>{calls++;if(calls===1)throw Error('transport');received=message;return {state:lamp(),reply:'Im Wohnzimmer.',navigation:[],modelCalls:1};}});
 const a=await call(handler,{message:'lampe kaputt',messageId:randomUUID()});assert.equal(a.status,503);assert.equal(readSession(a.body.session).portalPending[0].content,'lampe kaputt');
 const b=await call(handler,{session:a.body.session,message:'wohnzimmer',messageId:randomUUID()});assert.equal(b.status,200);assert.equal(received,'lampe kaputt\nwohnzimmer');assert.deepEqual(readSession(b.body.session).portalPending,[]);
});
test('full HTML: actual portal save/readback, double clicks, update same record and no old actions',async()=>{
 let turns=0;const handler=createPortalChatHandler({converse:async(message,s)=>{turns++;const next=turns===1?lamp():update(s,message,{location:'Schlafzimmer',correction:true});return {state:next,reply:turns===1?'Sie können das Anliegen lokal speichern.':'Der Raum ist im Chat korrigiert.',navigation:[],modelCalls:1};}});
 const d=await dom(async(_url,opt)=>{const r=await call(handler,JSON.parse(opt.body));return {ok:r.status===200,json:async()=>r.body};});const w=d.window;
 try{
  w.document.getElementById('moraFab').click();await w.MORAPortal.send('Eine Lampe im Wohnzimmer geht seit gestern nicht. Keine weiteren Symptome.');
  await prepare(w);assert.equal(w.localStorage.getItem('morada-portal-clean-20261011-v1'),null);await saveForm(w);
  for(let i=0;i<12;i++)await tick();
  let stored=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1'));assert.equal(stored.cases.length,1);assert.match(stored.cases[0].title,/Lampe/);assert.equal(stored.cases[0].caseInfo.category,'Schaden / Reparatur');assert.equal(stored.cases[0].unit,'Wohnzimmer');assert.match(stored.cases[0].description,/Anzahl: 1/);assert.equal(stored.cases[0].status,'Neu');
  const id=stored.cases[0].id;assert.equal(w.MORAPortal.getState().data.controls.save,null);
  await w.MORAPortal.send('Nein, ich meinte Schlafzimmer.');await prepare(w,'Anliegen aktualisieren');await saveForm(w);
  stored=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1'));assert.equal(stored.cases.length,1);assert.equal(stored.cases[0].id,id);assert.equal(stored.cases[0].unit,'Schlafzimmer');assert.doesNotMatch(stored.cases[0].description,/Wohnzimmer/);assert.match(stored.cases[0].description,/Anzahl: 1/);
  assert.equal(turns,2);assert.ok(w.MORAPortal.getState().messages.some(m=>m.role==='receipt'));
 }finally{w.close();}
});
test('full HTML: quota failure produces no success or portal record and leaves retry control',async()=>{
 const handler=createPortalChatHandler({converse:async()=>({state:lamp(),reply:'Sie können das Anliegen lokal speichern.',navigation:[],modelCalls:1})});
 const d=await dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};});const w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send('Lampe im Wohnzimmer kaputt');Object.defineProperty(w.localStorage.__proto__,'setItem',{configurable:true,value(){throw Error('quota');}});await prepare(w);await saveForm(w);assert.equal(w.MORAPortal.getState().messages.filter(m=>m.role==='receipt').length,0);assert.equal(w.localStorage.getItem('morada-portal-clean-20261011-v1'),null);assert.ok(w.MORAPortal.getState().messages.some(m=>m.role==='error'));}finally{w.close();}
});
test('full HTML: existing navigation/form functions and customer views remain',async()=>{
 const d=await dom();const w=d.window;try{for(const id of ['cases','properties','units','calendar','tasks','documents','maintenance','owners','leases','rentroll','approvals','deposits','contracts']){w.eval(`go('${id}')`);assert.ok(w.document.getElementById('main').textContent.trim());}w.eval("newEntry('task')");assert.ok(w.document.getElementById('opsEntryForm'));w.eval('portalCloseDialog()');w.MoradaRoles.select('tenant');w.document.getElementById('moraFab').click();assert.ok(w.MORAPortal.element.textContent.includes('Guten Tag!'));assert.equal(w.MORAPortal.getState().data,null);}finally{w.close();}
});

test('full HTML: MORA covers every actual sidebar route in all four roles and executes navigation through native handlers',async()=>{
 let advertised=[];let target='ownerFinance';
 const d=await dom(async(_u,o)=>{const sent=JSON.parse(o.body);advertised=sent.navigation;assert.equal(sent.viewRole,w.eval('role'));return {ok:true,json:async()=>({architecture:'portal_v1',controls:{navigation:[target]},reply:'Lokaler Navigationstest',modelCalls:0})};}),w=d.window;
 try{
  for(const role of ['admin','manager','owner','tenant']){
   w.MoradaRoles.select(role);await settle();
   assert.notEqual(w.getComputedStyle(w.document.getElementById('moraFab')).display,'none','MORA launcher must remain visible despite native portal CSS');
   assert.equal(w.document.querySelectorAll('.topbar [data-action="mora"]').length,0,'only the floating launcher remains');w.document.getElementById('moraFab').click();assert.equal(w.MORAPortal.element.hidden,false);
   w.MORAPortal.element.querySelector('[data-mp="close"]').click();assert.equal(w.MORAPortal.element.hidden,true);w.document.getElementById('moraFab').click();assert.equal(w.MORAPortal.element.hidden,false);
   target=role==='admin'?'invoices':role==='manager'?'maintenance':role==='owner'?'ownerFinance':'tenantPayments';
   await w.MORAPortal.send('Lokaler Navigationstest');
   const sidebar=Array.from(w.eval('roleGroups().flatMap(([,items])=>items.map(([id])=>id))'));
   for(const id of sidebar)assert.ok(advertised.includes(id),role+' is missing '+id);
   if(role==='tenant'){assert.ok(!advertised.includes('ownerFinance'));assert.ok(!advertised.includes('invoices'));assert.ok(!advertised.includes('tenantInvoices'));}
   if(role==='owner')assert.ok(!advertised.includes('tenantPayments'));
   assert.equal(advertised.includes('new-case'),['admin','manager'].includes(role),'manual form respects native role access');
   if(role==='manager')assert.ok(!advertised.includes('company'));
   const button=[...w.document.querySelectorAll('.mora-portal-actions button')].find(b=>b.textContent.includes(target==='invoices'?'Mandatsrechnungen':target==='maintenance'?'Unterhalt':target==='ownerFinance'?'Finanzübersicht':'Zahlungen'));
   assert.ok(button,'real navigation button for '+target);button.click();await settle();
   assert.equal(w.location.hash,'#'+target);assert.equal(w.MORAPortal.element.hidden,true);
   assert.ok(!w.document.getElementById('moraFab').hidden);
  }
 }finally{w.close();}
});
test('unsupported operation, stale receipt and tampered session never claim success',async()=>{
 const handler=createPortalChatHandler({converse:async()=>({state:lamp(),reply:'Im Chat erfasst.',navigation:[],modelCalls:1})});
 const a=await call(handler,{message:'Lampe im Wohnzimmer',messageId:randomUUID()});
 assert.equal((await call(handler,{session:a.body.session,action:'send-now'})).status,400);
 const bad=await call(handler,{session:a.body.session,receipt:{operationId:randomUUID(),issueId:a.body.issue.id,draftId:a.body.issue.id,revision:a.body.issue.revision,contentHash:'0'.repeat(64),status:'portal_received'}});assert.equal(bad.status,409);assert.equal(bad.body.controls.stored,null);
 assert.equal((await call(handler,{session:a.body.session+'x',action:'save-issue'})).status,409);
});
test('full HTML: manual portal changes are preserved when the chat later changes',async()=>{
 let turns=0;const handler=createPortalChatHandler({converse:async(m,s)=>({state:++turns===1?lamp():update(s,m,{location:'Schlafzimmer',correction:true}),reply:'Im Chat erfasst.',navigation:[],modelCalls:1})});
 const d=await dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send('Lampe im Wohnzimmer');await prepare(w);await saveForm(w);
  await w.eval("companyCommit({cases:state.cases.map(c=>({...c,description:'Manuell ergänzte Angaben'}))},'Manuelle Prüfung')");
  await w.MORAPortal.send('Schlafzimmer statt Wohnzimmer');w.document.querySelector('.mora-portal-actions button').click();await settle();
  const saved=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1'));assert.equal(saved.cases[0].description,'Manuell ergänzte Angaben');assert.equal(saved.cases[0].unit,'Wohnzimmer');assert.equal(w.MORAPortal.getState().messages.filter(m=>m.role==='receipt').length,1);
 }finally{w.close();}
});
test('full HTML: lost receipt acknowledgment retries without another portal write',async()=>{
 const handler=createPortalChatHandler({converse:async()=>({state:lamp(),reply:'Im Chat erfasst.',navigation:[],modelCalls:1})});let receipts=0;
 const d=await dom(async(_u,o)=>{const input=JSON.parse(o.body);if(input.receipt&&receipts++===0)throw Error('network');const r=await call(handler,input);return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send('Lampe im Wohnzimmer');await prepare(w);await saveForm(w);assert.ok(w.MORAPortal.getState().pendingReceipt);assert.match(w.document.querySelector('.mora-portal-actions button').textContent,/Speicherung erneut prüfen/);w.document.querySelector('.mora-portal-actions button').click();for(let i=0;i<12;i++)await tick();assert.equal(w.MORAPortal.getState().pendingReceipt,null);const saved=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1'));assert.equal(saved.cases.length,1);assert.equal(saved.cases[0].history.length,1);assert.equal(receipts,2);
 }finally{w.close();}
});
test('full HTML: after failed next message an earlier save button is removed',async()=>{
 let n=0;const handler=createPortalChatHandler({converse:async()=>{if(n++)throw Error('model');return {state:lamp(),reply:'Im Chat erfasst.',navigation:[],modelCalls:1};}});
 const d=await dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send('Lampe im Wohnzimmer');assert.deepEqual([...w.document.querySelectorAll('.mora-portal-actions button')].map(b=>b.textContent),['Anliegen vorbereiten','Foto hinzufügen','Anliegen selbst erfassen']);await w.MORAPortal.send('Noch etwas');assert.equal(w.document.querySelectorAll('.mora-portal-actions button').length,0);}finally{w.close();}
});

// These deterministic regression fixtures isolate the portal pipeline. They are
// not real-model conversations; the separately saved live evidence is explicit.
for(const example of [
 {name:'socket',message:'Die Steckdose im Büro funktioniert nicht.',changes:{equipment:'socket',defect:'Steckdose funktioniert nicht.',location:'Büro'},label:'Steckdose',category:'Schaden / Reparatur'},
 {name:'water damage',message:'Ein trockener Wasserfleck an der Wand im Schlafzimmer.',changes:{equipment:'Wasserfleck',category:'water',defect:'Trockener Wasserfleck an der Wand.',location:'Schlafzimmer'},label:'Wasserfleck',category:'Schaden / Reparatur'},
 {name:'unknown start and category',message:'Das Spezialteil im Bad ist lose. Seit wann weiss ich nicht.',changes:{equipment:'Spezialteil',defect:'lose',location:'Bad',unknown:[{field:'since',quote:'Seit wann weiss ich nicht.'}]},label:'Spezialteil',category:'Allgemein'},
])test('native saved data: '+example.name,async()=>{
 const s=update(hydrateSimple(null),example.message,example.changes);
 const handler=createPortalChatHandler({converse:async()=>({state:s,reply:'Sie können die Angaben prüfen.',navigation:[],modelCalls:1})});
 const d=await dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send(example.message);await prepare(w);
  const form=w.document.getElementById('opsEntryForm');assert.equal(form.elements.namedItem('unit').value,example.changes.location);assert.equal(w.localStorage.getItem('morada-portal-clean-20261011-v1'),null);await saveForm(w);
  const rows=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1')).cases;assert.equal(rows.length,1);assert.match(rows[0].title,new RegExp(example.label));assert.equal(rows[0].caseInfo.category,example.category);assert.equal(rows[0].unit,example.changes.location);
  assert.match(rows[0].description,/Beginn: (unbekannt|Nicht angegeben)/);assert.equal(w.MORAPortal.getState().data.controls.save,null);
 }finally{w.close();}
});
test('native multiple cases, switching, supplement and photo use the same portal store',async()=>{
 const text='Die Lampe im Wohnzimmer geht nicht. Die Steckdose im Büro ist kaputt.';
 const p=plan([{ref:'new1',quote:'Die Lampe im Wohnzimmer geht nicht.',equipment:'light',defect:'Lässt sich nicht einschalten.',location:'Wohnzimmer'}, {ref:'new2',quote:'Die Steckdose im Büro ist kaputt.',equipment:'socket',defect:'Funktioniert nicht.',location:'Büro'}],{activeIssueRef:'new1'});
 let n=0;const handler=createPortalChatHandler({converse:async(m,s)=>({state:++n===1?commitDecision(projectDecision(hydrateSimple(null),text,p),text,p).state:update(s,m,{details:'Flackert kurz beim Einschalten.'}),reply:'Sie können die Angaben prüfen.',navigation:[],modelCalls:1})});
 const d=await dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{
  w.document.getElementById('moraFab').click();await w.MORAPortal.send(text);const ids=w.MORAPortal.getState().data.issues.map(i=>i.id);await prepare(w);await saveForm(w);
  w.MORAPortal.open();const selector=w.document.querySelector('.mora-portal-actions select');selector.value=ids[1];selector.dispatchEvent(new w.Event('change'));await settle();await prepare(w);await saveForm(w);
  let rows=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1')).cases;assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id===ids[0]).unit,'Wohnzimmer');assert.equal(rows.find(r=>r.id===ids[1]).unit,'Büro');
  // Switch back; a supplement updates the same issue, keeping the other record.
  w.MORAPortal.open();const again=w.document.querySelector('select[aria-label="Anliegen auswählen"]');again.value=ids[0];again.dispatchEvent(new w.Event('change'));await settle();await w.MORAPortal.send('Flackert kurz beim Einschalten.');await prepare(w,'Anliegen aktualisieren');
  const input=w.document.getElementById('opsFileInput');const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1kAAAAASUVORK5CYII=','base64');
  const file=new w.File([bytes],'lampe.png',{type:'image/png'});file.arrayBuffer=async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength); // JSDOM File API shim only.
  Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new w.Event('change',{bubbles:true}));await settle();assert.match(w.document.getElementById('opsFileStatus').textContent,/1 Datei ausgewählt/);await saveForm(w);
  rows=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1')).cases;assert.equal(rows.length,2);const lampRow=rows.find(r=>r.id===ids[0]),socketRow=rows.find(r=>r.id===ids[1]);assert.equal(lampRow.attachments.length,1);assert.equal(lampRow.attachments[0].name,'lampe.png');assert.match(lampRow.attachments[0].dataUrl,/^data:image\/png;base64,/);assert.match(lampRow.description,/Flackert/);assert.equal(socketRow.attachments.length,0);assert.doesNotMatch(socketRow.description,/Flackert/);assert.equal(w.MORAPortal.getState().data.issue.portalAttachmentCount,1);
 }finally{w.close();}
});
test('explicit preparation request opens native prefilled form automatically; cancellation never saves',async()=>{
 const handler=createPortalChatHandler({converse:async()=>({state:lamp(),reply:'Bitte prüfen Sie die Angaben im Formular.',requestedAction:'prepare',navigation:[],modelCalls:1})});
 const d=await dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send('Bitte das Anliegen vorbereiten.');assert.ok(w.document.querySelector('#opsEntryForm[data-mora-issue]'));assert.equal(w.document.querySelector('[name="unit"]').value,'Wohnzimmer');assert.equal(w.MORAPortal.getState().data.controls.prepared.saved,false);assert.equal(w.localStorage.getItem('morada-portal-clean-20261011-v1'),null);w.eval('portalCloseDialog()');await settle();assert.equal(w.MORAPortal.getState().data.controls.prepared,null);assert.ok(w.MORAPortal.getState().data.controls.save);assert.equal(w.MORAPortal.getState().messages.filter(m=>m.role==='receipt').length,0);}finally{w.close();}
});
test('native review keeps manual form edits and existing photos',async()=>{
 const handler=createPortalChatHandler({converse:async()=>({state:lamp(),reply:'Sie können die Angaben prüfen.',navigation:[],modelCalls:1})});
 const d=await dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send('Lampe im Wohnzimmer');await prepare(w);w.document.querySelector('[name="description"]').value+='\nEigener Zusatz.';await saveForm(w);w.MORAPortal.open();await prepare(w,'Foto hinzufügen');assert.match(w.document.querySelector('[name="description"]').value,/Eigener Zusatz/);await saveForm(w);const rows=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1')).cases;assert.equal(rows.length,1);assert.match(rows[0].description,/Eigener Zusatz/);}finally{w.close();}
});
test('empty unused action quote is absence, while empty fact evidence remains invalid',async()=>{
 let calls=0;const service=createPortalService({resolve:async()=>({ready:true,provider:'gateway',model:MODEL,createModel:()=>({})}),guard:async()=>{},generate:async()=>{calls++;return {output:plan([],{reply:'Wie kann ich helfen?',intent:'general',requestQuote:''}),usage:{},finalStep:{providerMetadata:{}}};}});
 const r=await service('Hallo',hydrateSimple(null),['cases']);assert.equal(calls,1);assert.equal(r.reply,'Wie kann ich helfen?');
});
test('a lost cancellation acknowledgment is reconciled before the next model turn',async()=>{
 const handler=createPortalChatHandler({converse:async(m,s)=>({state:s.issue?update(s,m,{details:'Zusatz'}):lamp(),reply:'Sie können die Angaben prüfen.',navigation:[],modelCalls:1})});let closes=0;
 const d=await dom(async(_u,o)=>{const input=JSON.parse(o.body);if(input.action==='draft-closed'&&closes++===0)throw Error('network');const r=await call(handler,input);return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send('Lampe im Wohnzimmer');await prepare(w);w.eval('portalCloseDialog()');await settle();assert.ok(w.MORAPortal.getState().pendingClose);w.MORAPortal.open();await w.MORAPortal.send('Zusatz');assert.equal(w.MORAPortal.getState().pendingClose,null);assert.ok(w.MORAPortal.getState().data.controls.save);assert.equal(w.localStorage.getItem('morada-portal-clean-20261011-v1'),null);}finally{w.close();}
});
test('native readiness permits unknown fixtures/explicitly unknown rooms and optional questions',()=>{
 let s=update(hydrateSimple(null),'Wasserfleck im Schlafzimmer',{equipment:'unknown',category:'water',defect:'Trockener Wasserfleck',location:'Schlafzimmer'},{ask:{field:'since',ref:'new1'}});assert.ok(controls(s).save);assert.equal(portalCaseFields(s.issue).category,'Schaden / Reparatur');
 s=update(hydrateSimple(null),'Das Teil ist lose. Der Bereich ist mir unbekannt.',{equipment:'Spezialteil',defect:'lose',unknown:[{field:'location',quote:'Der Bereich ist mir unbekannt.'}]});assert.ok(controls(s).save);assert.equal(portalCaseFields(s.issue).unit,'');
});
test('a model preparation announcement is displayed only after actual native form transfer',async()=>{
 const handler=createPortalChatHandler({converse:async()=>({state:lamp(),reply:'Das vorausgefüllte Formular ist vorbereitet.',requestedAction:'prepare',navigation:[],modelCalls:1})});
 const d=await dom(async(_u,o)=>{const input=JSON.parse(o.body);if(input.action==='save-issue')throw Error('Verbindung unterbrochen');const r=await call(handler,input);return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send('Bitte vorbereiten.');assert.equal(w.document.querySelector('#opsEntryForm[data-mora-issue]'),null);assert.ok(!w.MORAPortal.getState().messages.some(m=>m.content==='Das vorausgefüllte Formular ist vorbereitet.'));assert.ok(w.MORAPortal.getState().messages.some(m=>m.role==='error'));assert.equal(w.localStorage.getItem('morada-portal-clean-20261011-v1'),null);}finally{w.close();}
});
test('semantic verification repairs unsupported submission and missing room before committing',async()=>{
 let calls=0;const outputs=[plan([{ref:'new1',quote:'Die Lampe im Wohnzimmer geht nicht.',equipment:'light',defect:'geht nicht'}],{reply:'Zwei Einträge sind vorbereitet. Sie können sie absenden.'}),{violations:[{kind:'unsupported_effect',quote:'Zwei Einträge sind vorbereitet. Sie können sie absenden.',reason:'Kein Formular geöffnet und Versand nicht verfügbar.'},{kind:'missing_fact',quote:'Wohnzimmer',reason:'Raum in location übernehmen.'}]},plan([{ref:'new1',quote:'Die Lampe im Wohnzimmer geht nicht.',equipment:'light',defect:'geht nicht',location:'Wohnzimmer'}],{reply:'Sie können die Angaben noch ergänzen.'}),{violations:[]}];
 const service=createPortalService({resolve:async()=>({ready:true,provider:'gateway',model:MODEL,createModel:()=>({})}),guard:async()=>{},generate:async()=>({output:outputs[calls++],usage:{},finalStep:{providerMetadata:{}}})});
 const r=await service('Die Lampe im Wohnzimmer geht nicht.',hydrateSimple(null),['cases']);assert.equal(calls,4);assert.equal(r.repaired,true);assert.equal(r.state.issue.location,'Wohnzimmer');assert.equal(r.state.issues.length,1);assert.equal(r.reply,'Sie können die Angaben noch ergänzen.');assert.ok(!r.state.history.some(m=>m.content.includes('absenden')));
});
test('repeated semantic rejection never commits invented facts or an operational claim',async()=>{
 const prior=lamp(),snapshot=structuredClone(prior);let n=0;const bad=plan([{ref:'active',quote:'Bitte ergänzen.',location:'Erfundener Raum'}],{reply:'Das Anliegen ist eingereicht.'});
 const service=createPortalService({resolve:async()=>({ready:true,provider:'gateway',model:MODEL,createModel:()=>({})}),guard:async()=>{},generate:async()=>({output:n++%2===0?bad:{violations:[{kind:'unsupported_fact',quote:'Erfundener Raum',reason:'Kein belegter Raum.'}]},usage:{},finalStep:{providerMetadata:{}}})});
 await assert.rejects(()=>service('Bitte ergänzen.',prior,['cases']));assert.deepEqual(prior,snapshot);
});
test('invalid verifier format repairs verification without regenerating a valid conversation decision',async()=>{
 const p=plan([{ref:'new1',quote:'Das Spezialteil im Bad ist lose. Beginn unbekannt.',equipment:'Spezialteil',defect:'lose',location:'Bad',unknown:[{field:'since',quote:'Beginn unbekannt.'}]}],{reply:'Sie können das Anliegen vorbereiten.'});
 let calls=0;const outputs=[p,{type:'object',properties:{violations:{type:'array'}}},{violations:[]}];const instructions=[];
 const service=createPortalService({resolve:async()=>({ready:true,provider:'gateway',model:MODEL,createModel:()=>({})}),guard:async()=>{},generate:async o=>{instructions.push(o.instructions);return {output:outputs[calls++],usage:{},finalStep:{providerMetadata:{}}};}});
 const r=await service('Das Spezialteil im Bad ist lose. Beginn unbekannt.',hydrateSimple(null),['cases']);assert.equal(calls,3);assert.equal(r.repaired,true);assert.equal(instructions.filter(i=>i.includes('Sie sind MORA, die digitale Assistenz')).length,1);assert.equal(r.state.issue.location,'Bad');assert.equal(r.state.issue.fieldFacts.since.status,'unknown');
});
test('action intent uses the actual current request rather than a brittle copied quote',async()=>{
 let n=0;const seen=[];const outputs=[plan([],{reply:'Bitte prüfen Sie die Angaben.',requestedAction:'prepare',requestQuote:'Bitte bereiten Sie den Fall vor.'}),{violations:[]}];
 const service=createPortalService({resolve:async()=>({ready:true,provider:'gateway',model:MODEL,createModel:()=>({})}),guard:async()=>{},generate:async o=>{seen.push(o);return {output:outputs[n++],usage:{},finalStep:{providerMetadata:{}}};}});
 const r=await service('Bitte als Anliegen vorbereiten.',lamp(),['cases']);assert.equal(r.requestedAction,'prepare');assert.equal(n,2);assert.match(seen[1].messages[0].content,/Bitte als Anliegen vorbereiten/);assert.ok(!seen[1].messages[0].content.includes('Bitte bereiten Sie den Fall vor.'));
});

// A stale deployment default cannot undo the owner's portal-only model switch.
test('portal model switch uses the same Gateway credentials and approved model',async()=>{
 let selected;const service=createPortalService({env:{AI_GATEWAY_MODEL:'inception/mercury-2.5',MORA_AI_PROVIDER:'auto',AI_GATEWAY_API_KEY:'test-placeholder'},resolve:async env=>{selected=env;return {ready:true,provider:'gateway',model:env.AI_GATEWAY_MODEL,createModel:()=>({})};},guard:async()=>{},generate:async()=>({output:plan([],{intent:'general',reply:'Guten Tag.'}),usage:{},finalStep:{providerMetadata:{}}})});
 await service('Hallo',hydrateSimple(null),[]);assert.equal(selected.AI_GATEWAY_MODEL,'google/gemini-3.8-flash');assert.equal(selected.MORA_AI_PROVIDER,'gateway');assert.equal(selected.AI_GATEWAY_API_KEY,'test-placeholder');
});

// Local transport only: checks real DOM/form handlers and persisted data, not model wording.
test('manual alternative opens the same native form once and saves through the native handler',async()=>{
 const handler=createPortalChatHandler({converse:async()=>({state:lamp(),reply:'Lokaler Funktionstest',navigation:['new-case'],modelCalls:0})});
 const d=await dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{
  w.MORAPortal.open();await w.MORAPortal.send('Lokaler Funktionstest');
  const buttons=[...w.document.querySelectorAll('.mora-portal-actions button')];
  assert.equal(buttons.filter(b=>b.textContent==='Anliegen vorbereiten').length,1);
  const manual=buttons.filter(b=>b.textContent==='Anliegen selbst erfassen');assert.equal(manual.length,1);
  manual[0].click();await settle();
  const f=w.document.getElementById('opsEntryForm');assert.ok(f);assert.equal(f.dataset.moraIssue,undefined);
  assert.equal(f.elements.title.value,'','manual route must not silently copy the conversation');
  f.elements.title.value='Manuell erfasste Lampe';f.elements.description.value='Lampe defekt';f.elements.unit.value='Wohnzimmer';
  await saveForm(w);
  const stored=await w.eval('portalReadStored()');
  assert.ok(stored.next.cases.some(c=>c.title==='Manuell erfasste Lampe'&&c.unit==='Wohnzimmer'));
  assert.equal(w.MORAPortal.getState().data.controls.stored,null,'manual save is not a receipt for a MORA draft');
 }finally{w.close();}
});

test('customer cases: manual and MORA use one portal store, preserve corrections, and isolate local scopes',async()=>{
 let turns=0;const handler=createPortalChatHandler({converse:async(message,s)=>({state:turns++?update(s,message,{location:'Schlafzimmer',correction:true}):lamp(),reply:'Lokaler Test',navigation:[],modelCalls:0})});
 const d=await dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{
  w.MoradaRoles.select('tenant');await settle();w.eval("go('tenantSupport')");
  const manual=[...w.document.querySelectorAll('[data-mora-customer-cases] button')].find(b=>b.textContent==='Anliegen selbst erfassen');assert.ok(manual);manual.click();
  let f=w.document.getElementById('opsEntryForm');assert.ok(f);assert.equal(f.elements.namedItem('owner'),null);assert.equal(f.elements.namedItem('propertyId'),null);assert.equal(f.elements.namedItem('status'),null);
  f.elements.title.value='Manueller Mieterentwurf';f.elements.description.value='Fenster klemmt';f.elements.unit.value='Küche';await saveForm(w);
  assert.equal(w.document.querySelectorAll('#main tbody tr').length,1,w.document.getElementById('opsFormError')?.textContent||w.document.getElementById('main').textContent);
  assert.equal(w.document.getElementById('emptyRows').hidden,true);
  assert.equal(w.document.getElementById('recordCount').textContent,'1 lokale Entwürfe');
  assert.equal(w.document.querySelector('#main tbody tr').children.length,5);
  w.MORAPortal.open();await w.MORAPortal.send('Lampe im Wohnzimmer');await prepare(w);await saveForm(w);
  let records=(await w.eval('portalReadStored()')).next.cases;assert.equal(records.length,2);const lampRecord=records.find(r=>r.unit==='Wohnzimmer');assert.ok(lampRecord);assert.equal(lampRecord.moraLocalRole,'tenant');
  w.MORAPortal.open();await w.MORAPortal.send('Nein, Schlafzimmer');await prepare(w,'Anliegen aktualisieren');await saveForm(w);
  records=(await w.eval('portalReadStored()')).next.cases;assert.equal(records.length,2);assert.equal(records.find(r=>r.id===lampRecord.id).unit,'Schlafzimmer');
  assert.equal(w.document.querySelectorAll('#main tbody tr').length,2);
  w.MoradaRoles.select('owner');await settle();w.eval("go('ownerCases')");assert.equal(w.document.querySelectorAll('#main tbody tr').length,0,'other customer role sees no tenant drafts');
  w.dispatchEvent(new w.Event('mora:access-changed'));w.MoradaRoles.select('tenant');await settle();w.eval("go('tenantSupport')");assert.equal(w.document.querySelectorAll('#main tbody tr').length,0,'new access context cannot reopen previous session drafts');
 }finally{w.close();}
});

test('tenant: native multiple cases, switching, supplement and photo use the same portal store',async()=>{
 const text='Die Lampe im Wohnzimmer geht nicht. Die Steckdose im Büro ist kaputt.';
 const p=plan([{ref:'new1',quote:'Die Lampe im Wohnzimmer geht nicht.',equipment:'light',defect:'Lässt sich nicht einschalten.',location:'Wohnzimmer'}, {ref:'new2',quote:'Die Steckdose im Büro ist kaputt.',equipment:'socket',defect:'Funktioniert nicht.',location:'Büro'}],{activeIssueRef:'new1'});
 let n=0;const handler=createPortalChatHandler({converse:async(m,s)=>({state:++n===1?commitDecision(projectDecision(hydrateSimple(null),text,p),text,p).state:update(s,m,{details:'Flackert kurz beim Einschalten.'}),reply:'Sie können die Angaben prüfen.',navigation:[],modelCalls:1})});
 const d=await dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{
  w.MoradaRoles.select('tenant');await settle();w.document.getElementById('moraFab').click();await w.MORAPortal.send(text);const ids=w.MORAPortal.getState().data.issues.map(i=>i.id);await prepare(w);await saveForm(w);
  w.MORAPortal.open();const selector=w.document.querySelector('.mora-portal-actions select');selector.value=ids[1];selector.dispatchEvent(new w.Event('change'));await settle();await prepare(w);await saveForm(w);
  let rows=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1')).cases;assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id===ids[0]).unit,'Wohnzimmer');assert.equal(rows.find(r=>r.id===ids[1]).unit,'Büro');
  // Switch back; a supplement updates the same issue, keeping the other record.
  w.MORAPortal.open();const again=w.document.querySelector('select[aria-label="Anliegen auswählen"]');again.value=ids[0];again.dispatchEvent(new w.Event('change'));await settle();await w.MORAPortal.send('Flackert kurz beim Einschalten.');await prepare(w,'Anliegen aktualisieren');
  const input=w.document.getElementById('opsFileInput');const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1kAAAAASUVORK5CYII=','base64');
  const file=new w.File([bytes],'lampe.png',{type:'image/png'});file.arrayBuffer=async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength); // JSDOM File API shim only.
  Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new w.Event('change',{bubbles:true}));await settle();assert.match(w.document.getElementById('opsFileStatus').textContent,/1 Datei ausgewählt/);await saveForm(w);
  rows=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1')).cases;assert.equal(rows.length,2);const lampRow=rows.find(r=>r.id===ids[0]),socketRow=rows.find(r=>r.id===ids[1]);assert.equal(lampRow.attachments.length,1);assert.equal(lampRow.attachments[0].name,'lampe.png');assert.match(lampRow.attachments[0].dataUrl,/^data:image\/png;base64,/);assert.match(lampRow.description,/Flackert/);assert.equal(socketRow.attachments.length,0);assert.doesNotMatch(socketRow.description,/Flackert/);assert.equal(w.MORAPortal.getState().data.issue.portalAttachmentCount,1);
 }finally{w.close();}
});

test('tenant: full HTML: quota failure produces no success or portal record and leaves retry control',async()=>{
 const handler=createPortalChatHandler({converse:async()=>({state:lamp(),reply:'Sie können das Anliegen lokal speichern.',navigation:[],modelCalls:1})});
 const d=await dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};});const w=d.window;
 try{w.MoradaRoles.select('tenant');await settle();w.document.getElementById('moraFab').click();await w.MORAPortal.send('Lampe im Wohnzimmer kaputt');Object.defineProperty(w.localStorage.__proto__,'setItem',{configurable:true,value(){throw Error('quota');}});await prepare(w);await saveForm(w);assert.equal(w.MORAPortal.getState().messages.filter(m=>m.role==='receipt').length,0);assert.equal(w.localStorage.getItem('morada-portal-clean-20261011-v1'),null);assert.ok(w.MORAPortal.getState().messages.some(m=>m.role==='error'));}finally{w.close();}
});

test('portal language crosses the client/API boundary without translating customer messages',async()=>{
 const seen=[];
 const handler=createPortalChatHandler({converse:async(message,previous,navigation,timeout,context)=>{seen.push({message,language:context.language});return {state:previous,reply:'Test response',navigation:[],modelCalls:0};}});
 const d=await dom(async(_u,o)=>{const response=await call(handler,JSON.parse(o.body));return {ok:response.status===200,json:async()=>response.body};});
 try{const w=d.window;w.MORAPortal.open();for(const language of ['de','en','fr']){w.MoradaI18n.setLanguage(language);await w.MORAPortal.send('Meine Wohnung');}
  assert.deepEqual(seen,[{message:'Meine Wohnung',language:'de'},{message:'Meine Wohnung',language:'en'},{message:'Meine Wohnung',language:'fr'}]);
 }finally{d.window.close();}
});

test('model and reply instruction path includes the normalized language preference',async()=>{
 for(const [language,name] of [['de','German'],['en','English'],['fr','French']]){
  let instructions;const service=createPortalService({resolve:async()=>({ready:true,provider:'gateway',model:MODEL,createModel:()=>({})}),guard:async()=>{},generate:async o=>{instructions=o.instructions;return {output:plan([],{reply:'Test response',intent:'general',activeIssueRef:null}),usage:{},finalStep:{providerMetadata:{}}};}});
  await service('Hello',hydrateSimple(null),['support'],45000,{language});assert.ok(instructions.includes('Preferred portal language: '+name));assert.ok(instructions.includes('explicitly requests a different language'));
 }
});
