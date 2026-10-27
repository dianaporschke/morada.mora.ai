/** Offline replay of recorded REAL Sonnet facts through actual portal storage.
 * No inference, no live HTTPS, and no claim of rendered browser verification. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {createPortalChatHandler} from '../../api/portal-chat.js';
import {hydrateSimple} from '../../lib/mora/simple/state.js';

const input='docs/evidence/portal-agent-sonnet-2026-10-27.json';
const recorded=JSON.parse(readFileSync(input,'utf8')).conversations.find(c=>c.id==='04').turns.filter(t=>t.status===200);
assert.equal(recorded.length,2);
const html=readFileSync('portal.html','utf8');let n=0;
const evidence={scope:'OFFLINE REPLAY: real previously recorded Sonnet facts, local API handler and actual native HTML saves in JSDOM. Not a fresh model conversation, HTTPS test or rendered device test.',input,portalSha256:createHash('sha256').update(html).digest('hex'),snapshots:[],messages:[]};
const handler=createPortalChatHandler({integration:'portal_agent_v1',converse:async(message,previous)=>{
  const r=recorded[n++];assert.equal(message,r.customer);
  const state=hydrateSimple(previous);state.issues=structuredClone(r.response.issues);state.issue=state.issues.find(i=>i.id===r.response.issue.id);
  // The recorded conversation had no intervening saves. Carry only the real
  // receipts produced by THIS replay; customer facts remain the model's facts.
  for(const i of state.issues){const old=previous.issues.find(p=>p.id===i.id);if(old){i.preparation=old.preparation;i.portalAttachmentCount=old.portalAttachmentCount;}}
  state.conversationTopic='issue';state.safety=r.response.safety;state.portalPending=[];
  return {state,reply:r.response.reply,navigation:[],requestedAction:null,modelCalls:0};
}});
const vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>{if(!['not-implemented','css-parsing'].includes(e.type))errors.push(e.message);});
const dom=new JSDOM(html,{url:'https://local-test.invalid/portal.html?mora=agent',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.structuredClone=structuredClone;w.indexedDB=indexedDB;w.scrollTo=()=>{};w.confirm=()=>true;
  Object.defineProperty(w.navigator,'locks',{value:{request:async(_n,o,f)=>typeof o==='function'?o({}):f({})}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.fetch=async(url,options)=>{assert.equal(url,'/api/portal-agent');let status=200,data;await handler({method:'POST',body:JSON.parse(options.body)},{setHeader(){},status(s){status=s;return this;},json(d){data=d;return this;}});return {ok:status===200,json:async()=>data};};
}}),w=dom.window;
const rows=()=>JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1')||'null')?.cases || [];
const settle=async()=>{for(let i=0;i<200;i++){await new Promise(r=>setTimeout(r,10));if(w.MORAPortal.element.getAttribute('aria-busy')!=='true')return;}throw Error('UI did not settle');};
async function prepare(label){w.MORAPortal.open();const button=[...w.document.querySelectorAll('.mora-portal-actions button')].find(b=>b.textContent===label);assert.ok(button,label);button.click();button.click();await settle();assert.ok(w.document.querySelector('#opsEntryForm[data-mora-issue]'));}
async function save(){const form=w.document.getElementById('opsEntryForm');form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();evidence.snapshots.push(rows());}
try{
  w.document.getElementById('entry-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));w.document.getElementById('moraFab').click();
  await w.MORAPortal.send(recorded[0].customer);await prepare('Anliegen vorbereiten');assert.equal(rows().length,0);await save();
  assert.equal(rows().length,1);const id=rows()[0].id;assert.equal(rows()[0].unit,'Wohnzimmer');assert.match(rows()[0].title,/Lampe \/ Leuchte/);assert.equal(rows()[0].caseInfo.category,'Schaden / Reparatur');
  w.MORAPortal.open();await w.MORAPortal.send(recorded[1].customer);await prepare('Anliegen aktualisieren');await save();
  assert.equal(rows().length,1);assert.equal(rows()[0].id,id);assert.equal(rows()[0].unit,'Schlafzimmer');assert.doesNotMatch(rows()[0].description,/Wohnzimmer/);assert.match(rows()[0].description,/Anzahl: 1/);
  await prepare('Foto hinzufügen');const field=w.document.getElementById('opsFileInput');
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1kAAAAASUVORK5CYII=','base64'),file=new w.File([bytes],'lampe-test.png',{type:'image/png'});file.arrayBuffer=async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  Object.defineProperty(field,'files',{configurable:true,value:[file]});field.dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,100));await save();
  assert.equal(rows()[0].attachments.length,1);assert.equal(rows()[0].id,id);evidence.photoVerified=true;
  await prepare('Foto hinzufügen');const before=JSON.stringify(rows()),receipts=w.MORAPortal.getState().messages.filter(m=>m.role==='receipt').length;
  const proto=w.localStorage.__proto__,original=proto.setItem;w.document.getElementById('opsEntryForm').elements.namedItem('description').value+=' STORAGE FAILURE TEST';
  try{Object.defineProperty(proto,'setItem',{configurable:true,value(){throw Error('Controlled storage failure');}});await save();assert.equal(JSON.stringify(rows()),before);assert.equal(w.MORAPortal.getState().messages.filter(m=>m.role==='receipt').length,receipts);evidence.storageFailureVerified=true;}finally{Object.defineProperty(proto,'setItem',{configurable:true,value:original});}
  assert.equal(errors.length,0);evidence.success=true;
}catch(error){evidence.success=false;evidence.failure=error.message;process.exitCode=1;}
finally{evidence.messages=w.MORAPortal.getState().messages;evidence.errors=errors;w.close();writeFileSync('docs/evidence/portal-agent-native-replay-2026-10-27.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({success:evidence.success,failure:evidence.failure,scope:evidence.scope}));}
