/** Explicitly authorized synthetic Preview integration run.
 * stdin: {url,share,output,caseIds?,sourceCommit}. No secrets or signed sessions in evidence.
 * Real remote Mercury responses + actual MORA DOM/IndexedDB integration in jsdom.
 * Browser visuals are verified separately. There is no simulated model success.
 */
import { readFileSync,writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { createMora } from '../assets/mora-client.js';
import { mapServiceDraft } from '../assets/mora-data.js';
const config=JSON.parse(readFileSync(0,'utf8'));
if (!/^https:\/\/[^/]+\.vercel\.app$/.test(config.url)) throw Error('Exact Preview required');
const py=spawn('python',['-u','-c',`
import json,sys,urllib.request,urllib.error,http.cookiejar
op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
cfg=json.loads(sys.stdin.readline());op.open(cfg['share'],timeout=30).close()
for line in sys.stdin:
 req=json.loads(line)
 try:
  r=op.open(urllib.request.Request(cfg['url']+req['path'],data=json.dumps(req['body']).encode() if req.get('body') is not None else None,headers={'Content-Type':'application/json'}),timeout=85)
  status=r.status;body=json.load(r)
 except urllib.error.HTTPError as e:
  status=e.code
  try:body=json.load(e)
  except:body={'error':'non_json_http_error'}
 except Exception as e:status=0;body={'error':type(e).__name__}
 print(json.dumps({'status':status,'body':body}),flush=True)
`],{stdio:['pipe','pipe','inherit']});
py.stdin.write(JSON.stringify({url:config.url,share:config.share})+'\n');
const lines=createInterface({input:py.stdout});const pending=[];
lines.on('line',line=>pending.shift()?.(JSON.parse(line)));
const request=(path,body)=>new Promise(resolve=>{pending.push(resolve);py.stdin.write(JSON.stringify({path,body})+'\n');});
const ready=await request('/api/ai-readiness');if(!ready.body.inferenceEnabled || ready.body.configuration?.model!=='inception/mercury-2.5')throw Error('Model not ready');
const cases=JSON.parse(readFileSync('scripts/reliability-cases.json','utf8')).filter(c=>!config.caseIds || config.caseIds.includes(c.id));
const evidence={url:config.url,sourceCommit:config.sourceCommit,model:'inception/mercury-2.5',synthetic:true,dom:'jsdom + real HTTP + IndexedDB',cases:[],rows:[]};
const persist=()=>writeFileSync(config.output,JSON.stringify(evidence,null,2)+'\n');
const fields=['category','equipment','description','defect','count','location','since','extent','details','cause','urgency','hazard','unknownFields','fieldFacts','revision','preparation'];
const safeIssue=issue=>issue ? Object.fromEntries(['id',...fields].map(k=>[k,issue[k] ?? null])) : null;
let nextModelAt=0;
try {
 for(const c of cases){
  const dom=new JSDOM(readFileSync('index.html','utf8'),{url:config.url,pretendToBeVisual:true});
  const {window}=dom;window.indexedDB=new IDBFactory();window.scrollTo=()=>{};let lastStatus=200;
  const result={id:c.id,name:c.name,checks:[],drafts:[]};
  const ui=createMora(window.document,window,async(path,opts)=>{
   const body=JSON.parse(opts.body),receipt=Boolean(body.draftReceipt);
   if (!receipt){await new Promise(resolve=>setTimeout(resolve,Math.max(0,nextModelAt-Date.now())));nextModelAt=Date.now()+25000;}
   const started=Date.now(),reply=await request(path,body);lastStatus=reply.status;
   const row={caseId:c.id,kind:receipt?'local_receipt':'conversation',message:body.message || null,status:reply.status,seconds:(Date.now()-started)/1000,
    reply:reply.body.reply || reply.body.error,actions:reply.body.actions,issues:(reply.body.issues || []).map(safeIssue),
    responseMode:reply.body.responseMode,recoveredFacts:reply.body.recoveredFacts || false,modelCalls:reply.body.modelCalls,timingMs:reply.body.timingMs,modelUsage:reply.body.modelUsage,modelAvailability:reply.body.modelAvailability};
   evidence.rows.push(row);persist();console.log(JSON.stringify({case:c.id,kind:row.kind,status:row.status,reply:row.reply,equipment:row.issues.map(i=>i.equipment)}));
   if(reply.status!==200 && reply.body.modelAvailability?.reason!=='invalid_model_output')throw Object.assign(Error('Access, transport, quota or billing boundary'),{stopRun:true});
   return {ok:reply.status===200,status:reply.status,json:async()=>reply.body};
  });
  try {
   await ui.ready;
   for(const [index,message]of c.messages.entries()){
    await ui.submit({message},message);
    if(lastStatus!==200)break;
    if(c.prepareAfterTurn===index+1)await ui.onAction({type:'handover'});
   }
   const state=ui.getState();result.issues=state.issues.map(safeIssue);
   if(lastStatus!==200){result.checks.push({check:'genuine_model_response',pass:false,status:lastStatus});}
   else {
    if(!c.safety)result.checks.push({check:'normal_model_reply',pass:evidence.rows.filter(r=>r.caseId===c.id && r.kind==='conversation').every(r=>r.responseMode==='model')});
    for(const [key,value]of Object.entries(c.expected || {}))result.checks.push({check:`expected.${key}`,pass:state.issue?.[key]===value,actual:state.issue?.[key] ?? null,expected:value});
    if(c.detailsPattern)result.checks.push({check:'negative_observations_preserved',pass:new RegExp(c.detailsPattern,'iu').test(state.issue?.details || '')});
    for(const field of c.uncertain || [])result.checks.push({check:`uncertain.${field}`,pass:state.issue?.fieldFacts?.[field]?.status==='uncertain'});
    for(const expected of c.expectedIssues || [])result.checks.push({check:`separate_issue.${expected.equipment}`,pass:state.issues.some(issue=>Object.entries(expected).every(([key,value])=>issue[key]===value))});
    if(c.issueCount)result.checks.push({check:'issue_count',pass:state.issues.length===c.issueCount,actual:state.issues.length});
    for(const field of c.unknown || [])result.checks.push({check:`explicit_unknown.${field}`,pass:state.issue?.unknownFields.includes(field)});
    if(c.safety)result.checks.push({check:'immediate_safety',pass:state.issue?.urgency==='emergency' && evidence.rows.filter(r=>r.caseId===c.id && r.kind==='conversation').every(r=>r.modelCalls===0)});
    if(state.issue){
     if(c.failStorage){const factory=window.indexedDB;window.indexedDB={open(){throw Error('synthetic_storage_failure');}};await ui.onAction({type:'handover'});result.checks.push({check:'failed_handover_no_success',pass:ui.getDrafts().length===0 && ui.getPreparationState()==='error'});window.indexedDB=factory;}
     await ui.onAction({type:'handover'});
     if(c.repeatClicks)await Promise.all([ui.onAction({type:'handover'}),ui.onAction({type:'handover'}),ui.onAction({type:'handover'})]);
     const draft=ui.getDrafts().find(d=>d.id===state.issue.id),mapped=mapServiceDraft(state.issue);
     result.drafts=ui.getDrafts().map(safeIssue);
     if(c.sameDraft)result.checks.push({check:'same_single_draft',pass:result.drafts.length===1 && result.drafts[0].id===evidence.rows.find(r=>r.caseId===c.id && r.kind==='conversation')?.issues[0]?.id});
     result.dom={label:window.document.getElementById('moraDraftPicker').textContent,equipment:window.document.getElementById('moraDraftEquipment').value,location:window.document.getElementById('moraDraftLocation').value,defect:window.document.getElementById('moraDraftDefect').value,count:window.document.getElementById('moraDraftCount').value,notice:window.document.getElementById('moraDraftNotice').textContent};
     result.checks.push({check:'all_mapped_fields_equal',pass:!!draft && fields.filter(k=>!['preparation','revision'].includes(k)).every(k=>JSON.stringify(draft[k]??null)===JSON.stringify(mapped[k]??null))});
     result.checks.push({check:'one_draft_per_issue',pass:ui.getDrafts().filter(d=>d.id===state.issue.id).length===1});
     result.checks.push({check:'not_transmitted',pass:draft?.delivery==='not_sent' && !draft?.requestId});
    }
   }
  } finally {window.close();evidence.cases.push(result);persist();}
  console.log(JSON.stringify({case:c.id,passed:result.checks.every(k=>k.pass),checks:result.checks}));
  const last=evidence.rows.at(-1);if(last?.status!==200 && last?.modelAvailability?.reason!=='invalid_model_output')break;
 }
}finally{py.stdin.end();}
