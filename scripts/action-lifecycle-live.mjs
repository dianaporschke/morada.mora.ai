// Real Preview Mercury conversations through the browser client and IndexedDB.
// stdin: {url,share,output,sourceCommit,cases:[{id,steps:[{message}|{prepare:true}|{reload:true}]}]}
// Evidence excludes authentication links and signed sessions. No generated responses are mocked.
import {readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {JSDOM} from 'jsdom';
import {IDBFactory} from 'fake-indexeddb';
import {createMora} from '../assets/mora-client.js';
const config=JSON.parse(readFileSync(0,'utf8'));
if(!/^https:\/\/[^/]+\.vercel\.app$/.test(config.url))throw Error('Exact Preview required');
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
const pending=[];createInterface({input:py.stdout}).on('line',line=>pending.shift()?.(JSON.parse(line)));
const request=(path,body)=>new Promise(resolve=>{pending.push(resolve);py.stdin.write(JSON.stringify({path,body})+'\n');});
const readiness=await request('/api/ai-readiness');
if(!readiness.body.inferenceEnabled || readiness.body.configuration?.model!=='inception/mercury-2.5')throw Error('Mercury not ready');
const evidence={url:config.url,sourceCommit:config.sourceCommit,model:'inception/mercury-2.5',realHTTP:true,dom:'jsdom + IndexedDB',cases:[]};
const persist=()=>writeFileSync(config.output,JSON.stringify(evidence,null,2)+'\n');
const safeIssue=issue=>issue && Object.fromEntries(['id','equipment','category','defect','description','location','count','since','details','revision','preparation','draftOfferShown','draftAction'].map(k=>[k,issue[k]??null]));
let nextModelAt=0;
try {
 for(const c of config.cases){
  const result={id:c.id,http:[],steps:[]};evidence.cases.push(result);const indexedDB=new IDBFactory();
  let dom,ui;const open=async(saved)=>{
   dom=new JSDOM(readFileSync('index.html','utf8'),{url:config.url,pretendToBeVisual:true});
   dom.window.indexedDB=indexedDB;dom.window.scrollTo=()=>{};
   if(saved)dom.window.sessionStorage.setItem('morada.mora.v2.thread',saved);
   ui=createMora(dom.window.document,dom.window,async(path,opts)=>{
    const body=JSON.parse(opts.body),receipt=!!body.draftReceipt;
    if(!receipt){await new Promise(resolve=>setTimeout(resolve,Math.max(0,nextModelAt-Date.now())));nextModelAt=Date.now()+25000;}
    const response=await request(path,body);
    const {session,...safe}=response.body;
    result.http.push({message:body.message||null,receipt:receipt?body.draftReceipt:null,status:response.status,...safe});persist();
    console.log(JSON.stringify({case:c.id,message:body.message||'receipt',status:response.status,reply:safe.reply,actions:safe.actions,responseMode:safe.responseMode,modelCalls:safe.modelCalls}));
    if(response.status!==200)throw Error(`Real request failed: ${response.status}`);
    return {ok:true,status:response.status,json:async()=>response.body};
   });await ui.ready;
  };await open();
  try {
   for(const step of c.steps){
    if(step.message)await ui.submit({message:step.message},step.message);
    if(step.prepare)await Promise.all([ui.onAction({type:'handover'}),ui.onAction({type:'handover'})]);
    if(step.reload){const saved=dom.window.sessionStorage.getItem('morada.mora.v2.thread');dom.window.close();await open(saved);}
    const doc=dom.window.document,state=ui.getState();
    result.steps.push({step,issue:safeIssue(state.issue),drafts:ui.getDrafts().map(safeIssue),phase:ui.getPreparationState(),
     visibleChatActions:[...doc.querySelectorAll('#moraMessages .mora-action')].map(b=>({label:b.textContent,type:b.dataset.actionType,disabled:b.disabled})),
     prepareControl:{hidden:doc.getElementById('moraPrepareIssue').hidden,label:doc.getElementById('moraPrepareIssue').textContent},
     form:{equipment:doc.getElementById('moraDraftEquipment').value,location:doc.getElementById('moraDraftLocation').value,details:doc.getElementById('moraDraftDetails').value},
     thread:state.thread.map(({content,who})=>({content,who}))});persist();
   }
  }finally{dom.window.close();}
 }
}finally{persist();py.stdin.end();}
