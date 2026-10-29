/** Offline replay of captured real model facts through the actual customer HTML.
 * No inference; not a fresh conversation or a rendered-browser test. */
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {createPortalChatHandler} from '../../api/portal-chat.js';
import {hydrateSimple} from '../../lib/mora/simple/state.js';
const input='docs/evidence/mora-quality-acceptance-release-live-2026-10-29.json';
const evidence=JSON.parse(readFileSync(input,'utf8'));
const turns=evidence.conversations.find(c=>c.id==='07-short-correction').turns;
assert.equal(turns.length,4);assert.ok(turns.every(t=>t.status===200));
let index=0;const handler=createPortalChatHandler({integration:'portal_agent_v1',converse:async(message,previous)=>{
 const r=turns[index++];assert.equal(message,r.customer);const state=hydrateSimple(previous);
 state.issues=structuredClone(r.issues);for(const i of state.issues){const old=previous.issues.find(p=>p.id===i.id);if(old){i.preparation=old.preparation;i.portalAttachmentCount=old.portalAttachmentCount;}}
 state.issue=state.issues.find(i=>i.id===r.issue?.id);state.safety=r.safety;state.conversationTopic='issue';state.portalPending=[];
 return {state,reply:r.reply,navigation:r.navigation||[],requestedAction:null,modelCalls:0};
}});
const vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>{if(!['not-implemented','css-parsing'].includes(e.type))errors.push(e.message);});
const d=new JSDOM(readFileSync('portal.html','utf8'),{url:'https://local.invalid/portal.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.structuredClone=structuredClone;w.indexedDB=indexedDB;w.scrollTo=()=>{};w.confirm=()=>true;
 Object.defineProperty(w.navigator,'locks',{value:{request:async(_n,o,f)=>typeof o==='function'?o({}):f({})}});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.fetch=async(_url,opt)=>{let status=200,data;await handler({method:'POST',body:JSON.parse(opt.body)},{setHeader(){},status(s){status=s;return this;},json(r){data=r;return this;}});return {ok:status===200,json:async()=>data};};
}}),w=d.window;
const settle=async()=>{for(let n=0;n<60;n++)await new Promise(r=>setTimeout(r,5));};
const result={scope:'Offline replay of real recorded model facts into native customer case storage; not fresh inference or a browser/device rendering test.',input,snapshots:[]};
async function save(label){w.MORAPortal.open();const b=[...w.document.querySelectorAll('.mora-portal-actions button')].find(b=>b.textContent===label);assert.ok(b,label);b.click();b.click();await settle();const f=w.document.getElementById('opsEntryForm');assert.ok(f);f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();const stored=(await w.eval('portalReadStored()')).next.cases;result.snapshots.push(structuredClone(stored));return stored;}
try{
 await settle();assert.equal(w.eval('portalLoading'),false);w.document.getElementById('entry-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));w.MoradaRoles.select('tenant');await settle();w.MORAPortal.open();
 await w.MORAPortal.send(turns[0].customer);await w.MORAPortal.send(turns[1].customer);
 let rows=await save('Anliegen vorbereiten');assert.equal(rows.length,1);assert.equal(rows[0].unit,'Wohnzimmer');assert.match(rows[0].title,/Lampe \/ Leuchte/);const id=rows[0].id;
 await w.MORAPortal.send(turns[2].customer);rows=await save('Anliegen aktualisieren');assert.equal(rows.length,1);assert.equal(rows[0].id,id);assert.equal(rows[0].unit,'Schlafzimmer');assert.doesNotMatch(rows[0].description,/Wohnzimmer/);
 await w.MORAPortal.send(turns[3].customer);rows=await save('Anliegen aktualisieren');assert.equal(rows.length,1);assert.equal(rows[0].id,id);assert.match(rows[0].description,/Beginn: unbekannt/);assert.equal(errors.length,0);result.success=true;
}catch(e){result.success=false;result.error=e.message;process.exitCode=1;}finally{w.close();writeFileSync('docs/evidence/mora-quality-native-replay.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({success:result.success,error:result.error}));}
