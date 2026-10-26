/** Real model/HTTPS responses + supplied native portal code and durable data.
 * JSDOM dialog/Web Locks/File APIs are shims, not rendered-device evidence. */
import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readFileSync,writeFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
if(process.stdin.isTTY)execFileSync('stty',['-echo'],{stdio:['inherit','ignore','ignore']});
const lines=createInterface({input:process.stdin});const cfg=await new Promise(r=>lines.once('line',s=>r(JSON.parse(s))));lines.close();
const child=spawn('python3',['scripts/portal-integration/live.py'],{stdio:['pipe','pipe','inherit']});child.stdin.write(JSON.stringify({...cfg,broker:true})+'\n');
const responses=createInterface({input:child.stdout}),pending=[];responses.on('line',s=>pending.shift()?.(JSON.parse(s)));
const transport=body=>{const p=new Promise(r=>pending.push(r));child.stdin.write(JSON.stringify(body)+'\n');return p;};
const delay=ms=>new Promise(r=>setTimeout(r,ms));let lastModelAt=0;
const html=readFileSync('portal.html','utf8');
const evidence={portalSha256:createHash('sha256').update(html).digest('hex'),scope:'Real HTTPS Gateway conversations and actual native HTML portal saves/readbacks in JSDOM. No rendered browser/device claim.',url:cfg.url+'/portal.html',conversations:[]};
const before=await transport(null);assert.equal(before.status,200);assert.equal(before.data.inferenceStarted,false);evidence.before=before.data;evidence.model=before.data.model;if(cfg.expectedModel)assert.equal(evidence.model,cfg.expectedModel);
const cases=[
 {id:'lamp',messages:['lampe kaputt','wohnzimmer','Nur eine Lampe ist betroffen, sonst ist alles normal.','Bitte bereiten Sie das Anliegen jetzt vor.'],room:'Wohnzimmer',label:/Lampe \/ Leuchte/,correction:'Nein, ich meinte Schlafzimmer.',correctedRoom:'Schlafzimmer'},
 {id:'socket',messages:['Die Steckdose im Büro funktioniert nicht. Es gibt weder Funken noch Geruch oder Wärme.','Bitte das Anliegen vorbereiten.'],room:'Büro',label:/Steckdose/},
 {id:'water',messages:['Ein alter trockener Wasserfleck ist an der Wand im Schlafzimmer. Es tropft nichts, es gibt keine Elektrik in der Nähe.','Bitte das Anliegen vorbereiten.'],room:'Schlafzimmer',label:/Wasser|Feuchtigkeit|Wand/},
 {id:'unknown',messages:['Das Spezialteil im Bad sitzt lose. Den Beginn kenne ich nicht.','Bitte als Anliegen vorbereiten.'],room:'Bad',label:/Spezialteil/},
 {id:'multiple',messages:['Die Lampe im Wohnzimmer funktioniert nicht. Ausserdem ist der Türgriff im Flur lose.'],multiple:true},
];
try{
 for(const c of cases.filter(c=>!cfg.caseIds||cfg.caseIds.includes(c.id))){
  const entry={id:c.id,transports:[],snapshots:[],clientTimings:[]};evidence.conversations.push(entry);let failure;
  const vc=new VirtualConsole(),errors=[];vc.on('info',(label,value)=>{if(['MORA portal timing','MORA portal visible response'].includes(label))entry.clientTimings.push({label,...value});});vc.on('jsdomError',e=>{if(!['not-implemented','css-parsing'].includes(e.type))errors.push(e.message);});
  const d=new JSDOM(html,{url:cfg.url+'/portal.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.structuredClone=structuredClone;w.indexedDB=indexedDB;w.scrollTo=()=>{};w.confirm=()=>true;
   Object.defineProperty(w.navigator,'locks',{value:{request:async(n,o,f)=>typeof o==='function'?o({}):f({})}});
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
   w.fetch=async(_u,opt)=>{const input=JSON.parse(opt.body);if(input.message){await delay(Math.max(0,(cfg.delaySeconds||21)*1000-(Date.now()-lastModelAt)));lastModelAt=Date.now();}const result=await transport(input),{session,...safe}=result.data;void session;entry.transports.push({request:{...input,session:input.session?'[signed session omitted]':undefined},status:result.status,data:safe,httpMs:result.httpMs});if(result.data.code==='MODEL_RATE_LIMIT'||result.data.code==='PREVIEW_CREDIT_BOUNDARY')failure=result.data.code;return {ok:result.status===200,json:async()=>result.data};};
  }}),w=d.window;
  const snapshot=()=>{const s=JSON.parse(w.localStorage.getItem('morada-portal-clean-20261011-v1')||'null');return s?.cases||[];};
  async function settle(){for(let n=0;n<600;n++){await delay(50);if(w.MORAPortal.element.getAttribute('aria-busy')!=='true')return;}throw Error('UI operation timed out');}
  async function prepare(label='Anliegen vorbereiten'){
   if(!w.document.querySelector('#opsEntryForm[data-mora-issue]')){w.MORAPortal.open();const b=[...w.document.querySelectorAll('.mora-portal-actions button')].find(b=>b.textContent===label);assert.ok(b,'Missing '+label);b.click();b.click();await settle();}
   assert.ok(w.document.querySelector('#opsEntryForm[data-mora-issue]'),'No prefilled native form');
  }
  async function save(){const f=w.document.getElementById('opsEntryForm');f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();entry.snapshots.push(snapshot());}
  try{
   assert.equal(errors.length,0);w.document.getElementById('entry-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));w.document.getElementById('moraFab').click();
   for(const message of c.messages){await w.MORAPortal.send(message);assert.equal(entry.transports.at(-1).status,200,'Real model turn failed');console.log(JSON.stringify({case:c.id,customer:message,last:w.MORAPortal.getState().messages.at(-1)}));if(failure)throw Error(failure);}
   if(c.multiple){
    const data=w.MORAPortal.getState().data;assert.equal(data.issues.length,2);const ids=data.issues.map(i=>i.id);await prepare();await save();w.MORAPortal.open();const sel=w.document.querySelector('select[aria-label="Anliegen auswählen"]');sel.value=ids.find(id=>id!==data.issue.id);sel.dispatchEvent(new w.Event('change'));await settle();await prepare();await save();assert.equal(snapshot().length,2);assert.deepEqual(new Set(snapshot().map(r=>r.unit.toLowerCase())),new Set(['wohnzimmer','flur']));
   }else{
    await prepare();assert.equal(snapshot().length,0,'Preparation must not claim persistence');assert.equal(w.document.querySelector('[name="unit"]').value.toLowerCase(),c.room.toLowerCase());await save();let rows=snapshot();assert.equal(rows.length,1);assert.match(rows[0].title,c.label);assert.equal(rows[0].unit.toLowerCase(),c.room.toLowerCase());const id=rows[0].id;
    if(c.correction){w.MORAPortal.open();await w.MORAPortal.send(c.correction);await prepare('Anliegen aktualisieren');await save();rows=snapshot();assert.equal(rows.length,1);assert.equal(rows[0].id,id);assert.equal(rows[0].unit.toLowerCase(),c.correctedRoom.toLowerCase());}
    if(c.id==='lamp'){
     w.MORAPortal.open();await prepare('Foto hinzufügen');
     const input=w.document.getElementById('opsFileInput'),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1kAAAAASUVORK5CYII=','base64');
     const file=new w.File([bytes],'lampe-test.png',{type:'image/png'});file.arrayBuffer=async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
     Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new w.Event('change',{bubbles:true}));await delay(100);await save();
     assert.equal(snapshot()[0].id,id);assert.equal(snapshot()[0].attachments.length,1);assert.equal(snapshot()[0].attachments[0].name,'lampe-test.png');entry.photoVerified=true;
     w.MORAPortal.open();await prepare('Foto hinzufügen');
     const original=w.localStorage.__proto__.setItem,storedBefore=JSON.stringify(snapshot()),receiptCount=w.MORAPortal.getState().messages.filter(m=>m.role==='receipt').length;
     w.document.getElementById('opsEntryForm').elements.namedItem('description').value+=' TEST STORAGE FAILURE';
     try{
      Object.defineProperty(w.localStorage.__proto__,'setItem',{configurable:true,value(){throw Error('Controlled storage quota failure');}});
      await save();assert.equal(JSON.stringify(snapshot()),storedBefore);assert.equal(w.MORAPortal.getState().messages.filter(m=>m.role==='receipt').length,receiptCount);assert.ok(w.MORAPortal.getState().messages.some(m=>m.role==='error'));entry.storageFailureVerified=true;
     }finally{Object.defineProperty(w.localStorage.__proto__,'setItem',{configurable:true,value:original});}
    }
   }
   entry.success=true;
  }catch(e){entry.success=false;entry.failure=e.message;if(failure)evidence.stopped=failure;}
  finally{entry.messages=w.MORAPortal?.getState()?.messages;entry.controls=w.MORAPortal?.getState()?.data?.controls;entry.errors=errors;w.close();writeFileSync(cfg.output,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({case:c.id,success:entry.success,failure:entry.failure}));}
  if(evidence.stopped)break;
 }
}finally{const after=await transport(null);evidence.after=after.data;evidence.actualAccountDeltaUsd=after.data.totalUsedUsd-evidence.before.totalUsedUsd;writeFileSync(cfg.output,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({finished:true,passed:evidence.conversations.filter(c=>c.success).length,total:evidence.conversations.length,accountDeltaUsd:evidence.actualAccountDeltaUsd}));child.kill();responses.close();}
