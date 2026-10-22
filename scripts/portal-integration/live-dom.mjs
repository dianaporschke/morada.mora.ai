/** Local DOM integration test with REAL HTTPS backend/model responses.
 * Browser rendering, viewport measurements and browser locks are not claimed.
 * JSDOM's missing Web Locks/Dialog APIs are test shims; portal save code is real. */
import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readFileSync,writeFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
if(process.stdin.isTTY)execFileSync('stty',['-echo'],{stdio:['inherit','ignore','ignore']});
const lines=createInterface({input:process.stdin});const cfg=await new Promise(r=>lines.once('line',s=>r(JSON.parse(s))));lines.close();
const child=spawn('python3',['scripts/portal-integration/live.py'],{stdio:['pipe','pipe','inherit']});
child.stdin.write(JSON.stringify({...cfg,broker:true})+'\n');
const responses=createInterface({input:child.stdout});const pending=[];const transports=[];
responses.on('line',line=>{const value=JSON.parse(line),p=pending.shift();if(p)p(value);});
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!['not-implemented','css-parsing'].includes(e.type))errors.push(e.message);});
const dom=new JSDOM(readFileSync('portal.html','utf8'),{url:cfg.url+'/portal.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.structuredClone=structuredClone;w.indexedDB=indexedDB;w.scrollTo=()=>{};w.confirm=()=>true;
 Object.defineProperty(w.navigator,'locks',{value:{request:async(n,o,f)=>typeof o==='function'?o({}):f({})}});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.fetch=async(_url,opt)=>{const input=JSON.parse(opt.body),p=new Promise(r=>pending.push(r));child.stdin.write(JSON.stringify(input)+'\n');const result=await p;const{session,...safe}=result.data;void session;transports.push({request:{...input,session:input.session?'[signed session omitted]':undefined},status:result.status,data:safe,httpMs:result.httpMs});return {ok:result.status===200,json:async()=>result.data};};
}});
const w=dom.window,evidence={scope:'Local full HTML DOM → real protected HTTPS API → Mercury 2.5 → actual portal save/readback. Not a rendered-browser/device test.',url:cfg.url+'/portal.html',errors,transports};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function snapshot(){const raw=w.localStorage.getItem('morada-portal-clean-20261011-v1');return raw?JSON.parse(raw):null;}
try{
 if(errors.length)throw Error(errors.join('; '));
 w.document.getElementById('entry-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));w.document.getElementById('moraFab').click();
 const messages=['lampe kaputt','wohnzimmer','Nur eine Lampe ist betroffen, sonst ist alles normal.'];
 for(const message of messages){if(transports.length)await delay(20000);await w.MORAPortal.send(message);console.log(JSON.stringify({message,result:w.MORAPortal.getState().messages.at(-1),controls:w.MORAPortal.getState().data?.controls}));if(transports.at(-1)?.data?.code==='MODEL_RATE_LIMIT')throw Error('Gateway request limit; no paid changes');}
 const save=[...w.document.querySelectorAll('.mora-portal-actions button')].find(b=>b.textContent==='Anliegen lokal speichern');if(!save)throw Error('No validated save action after the real conversation');
 save.click();save.click();while(w.MORAPortal.element.getAttribute('aria-busy')==='true')await delay(100);
 const saved=snapshot();if(saved?.cases?.length!==1)throw Error('Expected exactly one actual portal record');
 evidence.savedBeforeCorrection=saved.cases[0];
 await delay(20000);await w.MORAPortal.send('Nein, ich meinte Schlafzimmer.');
 const update=[...w.document.querySelectorAll('.mora-portal-actions button')].find(b=>b.textContent==='Gespeichertes Anliegen aktualisieren');if(!update)throw Error('No update action after real room correction');update.click();while(w.MORAPortal.element.getAttribute('aria-busy')==='true')await delay(100);
 const after=snapshot();evidence.savedAfterCorrection=after.cases[0];if(after.cases.length!==1||after.cases[0].id!==saved.cases[0].id||after.cases[0].unit.toLowerCase()!=='schlafzimmer')throw Error('Correction did not update the same portal record');
 const thread=w.MORAPortal.getState();evidence.messages=thread.messages;evidence.controls=thread.data?.controls;evidence.success=true;
}catch(error){evidence.success=false;evidence.failure=error.message;evidence.messages=w.MORAPortal?.getState()?.messages || [];}
finally{writeFileSync(cfg.output,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({finished:true,success:evidence.success,failure:evidence.failure,transports:transports.length}));w.close();child.kill();responses.close();}
