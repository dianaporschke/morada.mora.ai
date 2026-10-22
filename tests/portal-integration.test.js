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
import {checkFreeCredits} from '../lib/mora/portal/budget.js';
import {readSession} from '../lib/mora/session.js';

const plan=(updates=[],more={})=>({reply:'Wo befindet sich die Lampe?',intent:'issue',updates,actions:[],...more});
function update(s,message,changes,more={}) {const p=plan([{ref:s.issue?'active':'new1',quote:message,...changes}],more);return commitDecision(projectDecision(s,message,p),message,p).state;}
function lamp(){return update(hydrateSimple(null),'Eine Lampe im Wohnzimmer geht seit gestern nicht. Keine weiteren Symptome.',{equipment:'light',defect:'Lampe lässt sich nicht einschalten.',location:'Wohnzimmer',count:1,since:'seit gestern',details:'Keine weiteren Symptome.'},{reply:'Sie können noch etwas ergänzen.'});}
async function call(handler,body,method='POST'){let status=200,answer;await handler({method,body},{setHeader(){},status(n){status=n;return this;},json(v){answer=v;return this;}});return {status,body:answer};}
function dom(fetcher){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(e.type!=='css-parsing'&&e.type!=='not-implemented')errors.push(e);});
 const d=new JSDOM(readFileSync('portal.html','utf8'),{url:'https://portal.example/portal.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.structuredClone=structuredClone;w.fetch=fetcher;w.scrollTo=()=>{};w.confirm=()=>true;w.indexedDB=indexedDB;
  Object.defineProperty(w.navigator,'locks',{value:{request:async(_n,_opts,fn)=>typeof _opts==='function'?_opts({}):fn({})}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 }});
 if(errors.length){d.window.close();throw errors[0];}d.window.document.getElementById('entry-form').dispatchEvent(new d.window.Event('submit',{bubbles:true,cancelable:true}));return d;
}
const tick=()=>new Promise(r=>setTimeout(r,0));

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
test('free-credit guard rejects paid top-ups, reserve shortfall and cap',()=>{
 assert.ok(checkFreeCredits({balance:4.64,totalUsed:.36}));for(const c of [{balance:9.64,totalUsed:.36},{balance:.1,totalUsed:4.9},{balance:4.3,totalUsed:.7}])assert.throws(()=>checkFreeCredits(c));
});
test('real service boundaries use a test transport: one decision, lower reasoning, no verifier',async()=>{
 let request,calls=0;const service=createPortalService({resolve:async()=>({ready:true,provider:'gateway',model:'inception/mercury-2.5',createModel:()=>({})}),guard:async()=>{},generate:async options=>{request=options;calls++;return {output:plan([],{reply:'Wie kann ich Ihnen helfen?',intent:'general',activeIssueRef:null}),usage:{},finalStep:{providerMetadata:{}}};}});
 const result=await service('Guten Tag',hydrateSimple(null),['support']);assert.equal(calls,1);assert.equal(request.reasoning,'low');assert.equal(result.modelCalls,1);assert.equal(result.reply,'Wie kann ich Ihnen helfen?');
});
test('failed customer input is signed and passed to next turn as raw evidence',async()=>{
 let calls=0,received;const handler=createPortalChatHandler({converse:async(message,state)=>{calls++;if(calls===1)throw Error('transport');received=message;return {state:lamp(),reply:'Im Wohnzimmer.',navigation:[],modelCalls:1};}});
 const a=await call(handler,{message:'lampe kaputt',messageId:randomUUID()});assert.equal(a.status,503);assert.equal(readSession(a.body.session).portalPending[0].content,'lampe kaputt');
 const b=await call(handler,{session:a.body.session,message:'wohnzimmer',messageId:randomUUID()});assert.equal(b.status,200);assert.equal(received,'lampe kaputt\nwohnzimmer');assert.deepEqual(readSession(b.body.session).portalPending,[]);
});
test('full HTML: actual portal save/readback, double clicks, update same record and no old actions',async()=>{
 let turns=0;const handler=createPortalChatHandler({converse:async(message,s)=>{turns++;const next=turns===1?lamp():update(s,message,{location:'Schlafzimmer',correction:true});return {state:next,reply:turns===1?'Sie können das Anliegen lokal speichern.':'Der Raum ist im Chat korrigiert.',navigation:[],modelCalls:1};}});
 const d=dom(async(_url,opt)=>{const r=await call(handler,JSON.parse(opt.body));return {ok:r.status===200,json:async()=>r.body};});const w=d.window;
 try{
  w.document.getElementById('moraFab').click();await w.MORAPortal.send('Eine Lampe im Wohnzimmer geht seit gestern nicht. Keine weiteren Symptome.');
  let save=[...w.document.querySelectorAll('.mora-portal-actions button')].find(b=>b.textContent==='Anliegen lokal speichern');assert.ok(save);save.click();save.click();
  for(let i=0;i<12;i++)await tick();
  let stored=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1'));assert.equal(stored.cases.length,1);assert.match(stored.cases[0].title,/Lampe/);assert.equal(stored.cases[0].caseInfo.category,'Schaden / Reparatur');assert.equal(stored.cases[0].unit,'Wohnzimmer');assert.match(stored.cases[0].description,/Anzahl: 1/);assert.equal(stored.cases[0].status,'Neu');
  const id=stored.cases[0].id;assert.equal(w.document.querySelectorAll('.mora-portal-actions button').length,1);assert.equal(w.MORAPortal.getState().data.controls.save,null);
  await w.MORAPortal.send('Nein, ich meinte Schlafzimmer.');save=[...w.document.querySelectorAll('.mora-portal-actions button')].find(b=>b.textContent==='Gespeichertes Anliegen aktualisieren');assert.ok(save);save.click();for(let i=0;i<12;i++)await tick();
  stored=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1'));assert.equal(stored.cases.length,1);assert.equal(stored.cases[0].id,id);assert.equal(stored.cases[0].unit,'Schlafzimmer');assert.doesNotMatch(stored.cases[0].description,/Wohnzimmer/);assert.match(stored.cases[0].description,/Anzahl: 1/);
  assert.equal(turns,2);assert.ok(w.MORAPortal.getState().messages.some(m=>m.role==='receipt'));
 }finally{w.close();}
});
test('full HTML: quota failure produces no success or portal record and leaves retry control',async()=>{
 const handler=createPortalChatHandler({converse:async()=>({state:lamp(),reply:'Sie können das Anliegen lokal speichern.',navigation:[],modelCalls:1})});
 const d=dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};});const w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send('Lampe im Wohnzimmer kaputt');Object.defineProperty(w.localStorage.__proto__,'setItem',{configurable:true,value(){throw Error('quota');}});[...w.document.querySelectorAll('.mora-portal-actions button')][0].click();for(let i=0;i<12;i++)await tick();assert.equal(w.MORAPortal.getState().messages.filter(m=>m.role==='receipt').length,0);assert.equal(w.localStorage.getItem('morada-portal-clean-20261011-v1'),null);assert.ok(w.MORAPortal.getState().messages.some(m=>m.role==='error'));}finally{w.close();}
});
test('full HTML: existing navigation/form functions and customer views remain',()=>{
 const d=dom();const w=d.window;try{for(const id of ['cases','properties','units','calendar','tasks','documents','maintenance','owners','leases','rentroll','approvals']){w.eval(`go('${id}')`);assert.ok(w.document.getElementById('main').textContent.trim());}w.eval("newEntry('task')");assert.ok(w.document.getElementById('opsEntryForm'));w.eval('portalCloseDialog()');w.MoradaRoles.select('tenant');w.document.getElementById('moraFab').click();assert.ok(w.MORAPortal.element.textContent.includes('Guten Tag!'));assert.equal(w.MORAPortal.getState().data,null);}finally{w.close();}
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
 const d=dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send('Lampe im Wohnzimmer');w.document.querySelector('.mora-portal-actions button').click();for(let i=0;i<12;i++)await tick();
  await w.eval("companyCommit({cases:state.cases.map(c=>({...c,description:'Manuell ergänzte Angaben'}))},'Manuelle Prüfung')");
  await w.MORAPortal.send('Schlafzimmer statt Wohnzimmer');w.document.querySelector('.mora-portal-actions button').click();for(let i=0;i<12;i++)await tick();
  const saved=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1'));assert.equal(saved.cases[0].description,'Manuell ergänzte Angaben');assert.equal(saved.cases[0].unit,'Wohnzimmer');assert.equal(w.MORAPortal.getState().messages.filter(m=>m.role==='receipt').length,1);
 }finally{w.close();}
});
test('full HTML: lost receipt acknowledgment retries without another portal write',async()=>{
 const handler=createPortalChatHandler({converse:async()=>({state:lamp(),reply:'Im Chat erfasst.',navigation:[],modelCalls:1})});let receipts=0;
 const d=dom(async(_u,o)=>{const input=JSON.parse(o.body);if(input.receipt&&receipts++===0)throw Error('network');const r=await call(handler,input);return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send('Lampe im Wohnzimmer');w.document.querySelector('.mora-portal-actions button').click();for(let i=0;i<12;i++)await tick();assert.ok(w.MORAPortal.getState().pendingReceipt);assert.match(w.document.querySelector('.mora-portal-actions button').textContent,/erneut abgleichen/);w.document.querySelector('.mora-portal-actions button').click();for(let i=0;i<12;i++)await tick();assert.equal(w.MORAPortal.getState().pendingReceipt,null);const saved=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1'));assert.equal(saved.cases.length,1);assert.equal(saved.cases[0].history.length,1);assert.equal(receipts,2);
 }finally{w.close();}
});
test('full HTML: after failed next message an earlier save button is removed',async()=>{
 let n=0;const handler=createPortalChatHandler({converse:async()=>{if(n++)throw Error('model');return {state:lamp(),reply:'Im Chat erfasst.',navigation:[],modelCalls:1};}});
 const d=dom(async(_u,o)=>{const r=await call(handler,JSON.parse(o.body));return {ok:r.status===200,json:async()=>r.body};}),w=d.window;
 try{w.document.getElementById('moraFab').click();await w.MORAPortal.send('Lampe im Wohnzimmer');assert.equal(w.document.querySelectorAll('.mora-portal-actions button').length,1);await w.MORAPortal.send('Noch etwas');assert.equal(w.document.querySelectorAll('.mora-portal-actions button').length,0);}finally{w.close();}
});
