import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createPortalClient} from '../assets/mora-portal-client.js';

const answer=(extra={})=>({ok:true,json:async()=>({architecture:'portal_agent_v1',session:'local-test',reply:'Lokale UI-Testantwort',controls:{},...extra})});
function setup(fetcher=async()=>answer()){
 const dom=new JSDOM('<div id="portalPreview"><button id="moraFab">MORA</button></div>',{url:'https://example.test/portal.html',pretendToBeVisual:true}),w=dom.window;
 w.console.info=()=>{};
 const client=createPortalClient(w.document,w,{role:()=> 'admin',open:()=>true,available:()=>['cases'],currentDraft:()=>null},{fetcher});
 const launcher=w.document.getElementById('moraFab');launcher.focus();client.open();
 return {dom,w,client,launcher,input:client.element.querySelector('textarea'),scroll:client.element.querySelector('.mora-portal-scroll')};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('MORA UI preserves the conversation on close and has accessible controls without duplicate actions',async()=>{
 const x=setup(async()=>answer({controls:{save:{operation:'create'},review:{}}}));
 try{
  await x.client.send('Lokale Testnachricht');
  assert.equal(x.client.element.querySelectorAll('.mora-portal-actions button').length,2);
  assert.equal(x.client.element.querySelector('.mora-portal-primary').textContent,'Anliegen vorbereiten');
  assert.equal(x.client.element.querySelector('.mora-portal-action:not(.mora-portal-primary)').textContent,'Foto hinzufügen');
  const before=x.client.getState();
  x.client.element.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(x.client.element.hidden,true);assert.equal(x.w.document.activeElement,x.launcher);
  x.client.open();x.client.open();
  assert.deepEqual(x.client.getState(),before);
  assert.equal(x.client.element.querySelectorAll('.mora-portal-actions button').length,2);
  for(const label of ['Neues Gespräch','MORA schliessen','Nachricht senden'])assert.ok(x.client.element.querySelector(`[aria-label="${label}"]`));
  x.client.element.querySelector('[data-mp="clear"]').click();
  assert.equal(x.client.getState().messages.length,1);assert.equal(x.client.getState().data,null);
 }finally{x.w.close();}
});

test('Enter sends once, Shift+Enter and IME preserve typing, busy prevents repeated submission',async()=>{
 let release;const calls=[];const x=setup(async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});await new Promise(r=>release=r);return answer();});
 try{
  x.input.value='Mehrzeilige\nTestnachricht';
  x.input.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true,cancelable:true}));
  x.input.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}));
  assert.equal(calls.length,0);
  x.input.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  await x.client.send('Doppelklick');
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/portal-agent');assert.equal(calls[0].body.message,'Mehrzeilige\nTestnachricht');
  assert.equal(x.input.disabled,true);assert.equal(x.client.element.getAttribute('aria-busy'),'true');
  release();await tick();
  assert.equal(x.input.disabled,false);assert.equal(x.client.element.getAttribute('aria-busy'),'false');
 }finally{x.w.close();}
});

test('an arriving reply and reopening do not pull a reader away from older messages',async()=>{
 let release;const x=setup(async()=>{await new Promise(r=>release=r);return answer();});
 try{
  Object.defineProperties(x.scroll,{clientHeight:{value:200},scrollHeight:{value:1000}});
  const pending=x.client.send('Lokale Testnachricht');
  x.scroll.scrollTop=130;x.scroll.dispatchEvent(new x.w.Event('scroll'));
  release();await pending;
  assert.equal(x.scroll.scrollTop,130);
  x.client.close();x.client.open();assert.equal(x.scroll.scrollTop,130);
  const next=x.client.send('Weiter');assert.equal(x.scroll.scrollTop,1000);release();await next;
 }finally{x.w.close();}
});

test('multiline composer grows to its cap, keeps text intact, and collapses after clearing',()=>{
 const x=setup();try{
  let height=100;Object.defineProperty(x.input,'scrollHeight',{get:()=>height});
  x.input.style.minHeight='52px';x.input.style.maxHeight='132px';x.input.style.border='1px solid';
  x.input.value='Eine Nachricht\nmit mehreren Zeilen';x.input.dispatchEvent(new x.w.Event('input'));
  assert.equal(x.input.style.height,'102px');assert.equal(x.input.style.overflowY,'hidden');
  height=400;x.input.dispatchEvent(new x.w.Event('input'));assert.equal(x.input.style.height,'132px');assert.equal(x.input.style.overflowY,'auto');
  assert.equal(x.input.value,'Eine Nachricht\nmit mehreren Zeilen');
  x.input.value='';height=30;x.input.dispatchEvent(new x.w.Event('input'));assert.equal(x.input.style.height,'52px');
 }finally{x.w.close();}
});

test('visual viewport updates keep layout independent from conversation state',()=>{
 const x=setup();try{
  const viewport=new x.w.EventTarget();viewport.height=430;viewport.offsetTop=12;
  Object.defineProperty(x.w,'visualViewport',{value:viewport});
  const before=x.client.getState();x.w.dispatchEvent(new x.w.Event('resize'));
  assert.equal(x.client.element.style.getPropertyValue('--mp-viewport-height'),'430px');
  assert.equal(x.client.element.style.getPropertyValue('--mp-viewport-top'),'12px');assert.deepEqual(x.client.getState(),before);
 }finally{x.w.close();}
});

test('authorized results are transient text, never persisted or sent in the next conversation',async()=>{
 const calls=[];
 const result={status:'verified',kind:'case-status',title:'Geprüfter Teststand',asOf:'2026-10-28T12:00:00Z',rows:[{property:'PRIVATE TEST PROPERTY',equipment:'light',status:'contractor_contacted',reporter:'<script>unsafe()</script>'}]};
 const x=setup(async(_u,o)=>{calls.push(JSON.parse(o.body));return answer({reply:'',portalResult:result});});
 try{
  await x.client.send('Anliegenstände zeigen');
  assert.match(x.client.element.textContent,/PRIVATE TEST PROPERTY/);assert.match(x.client.element.textContent,/Handwerker kontaktiert/);
  assert.equal(x.client.element.querySelectorAll('script').length,0);
  assert.doesNotMatch(JSON.stringify(x.client.getState()),/PRIVATE TEST PROPERTY|unsafe/);
  assert.doesNotMatch(x.w.sessionStorage.getItem('morada.portal.mora.agent.v1.admin'),/PRIVATE TEST PROPERTY|unsafe/);
  x.client.close();x.client.open();assert.doesNotMatch(x.client.element.textContent,/PRIVATE TEST PROPERTY/);
  await x.client.send('Weiter');assert.doesNotMatch(JSON.stringify(calls[1]),/PRIVATE TEST PROPERTY|unsafe/);
  x.w.dispatchEvent(new x.w.Event('mora:access-changed'));
  assert.equal(x.client.element.hidden,true);assert.doesNotMatch(x.client.element.textContent,/PRIVATE TEST PROPERTY/);assert.equal(x.client.getState().messages.length,1);
 }finally{x.w.close();}
});

test('access changes discard an in-flight answer and old session without writing to the new user conversation',async()=>{
 let release;const x=setup(async()=>{await new Promise(r=>release=r);return answer({reply:'OLD USER PRIVATE ANSWER'});});
 try{
  const pending=x.client.send('PRIVATE OLD USER MESSAGE');
  x.w.dispatchEvent(new x.w.Event('mora:access-changed'));release();await pending;x.client.open();
  assert.doesNotMatch(x.client.element.textContent,/PRIVATE|OLD USER/);assert.equal(x.client.getState().session,null);
  assert.equal(x.client.getState().messages.length,1);assert.equal(x.input.disabled,false);
 }finally{x.w.close();}
});

test('server permission-change rejection clears the stale conversation and controls',async()=>{
 const x=setup(async()=>({ok:false,json:async()=>({architecture:'portal_agent_v1',code:'ACCESS_CHANGED',resetConversation:true,error:'Portalzugang geändert.'})}));
 try{await x.client.send('Old private text');assert.doesNotMatch(x.client.element.textContent,/Old private text/);assert.equal(x.client.getState().session,null);assert.equal(x.client.element.querySelectorAll('.mora-portal-actions button').length,0);}finally{x.w.close();}
});

test('late portal-save callbacks cannot move previous user data into a new access context',async()=>{
 const dom=new JSDOM('<div id="portalPreview"><button id="moraFab">MORA</button></div>',{url:'https://example.test/portal.html',pretendToBeVisual:true}),w=dom.window;
 let callbacks;const bridge={role:()=> 'admin',open:()=>true,available:()=>['cases'],currentDraft:()=>null,prepare(_t,_f,cb){callbacks=cb;}};
 const client=createPortalClient(w.document,w,bridge,{fetcher:async(_u,o)=>{
  const p=JSON.parse(o.body);return answer(p.action==='save-issue'?{operation:{issueId:'old-user-issue'},fields:{description:'OLD USER DATA'}}:{controls:{save:{operation:'create'}}});
 }});
 try{
  client.open();await client.send('Lokale Prüfung');client.element.querySelector('.mora-portal-primary').click();await tick();
  assert.ok(callbacks);w.dispatchEvent(new w.Event('mora:access-changed'));
  await callbacks.onSaved({fields:{description:'OLD USER DATA'},mappedFields:{description:'OLD USER DATA'},conflictFields:[],attachmentCount:0});
  await callbacks.onError(Error('OLD USER ERROR'));await callbacks.onClosed();callbacks.onSaving();
  assert.doesNotMatch(JSON.stringify(client.getState()),/OLD USER|old-user-issue/);assert.equal(client.getState().pendingReceipt,null);assert.equal(client.element.getAttribute('aria-busy'),'false');
 }finally{w.close();}
});
