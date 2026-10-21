// Fixed C evaluation. This file is NOT a customer API route. Source-info is generated only in the isolated bundle.
// The temporary test bundle alone adds api/quality-phase2.js importing it.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID, createHash } from 'node:crypto';
import { createGateway } from 'ai';
import { createSimpleChatHandler } from '../../api/chat-simple.js';
import { hydrateSimple } from '../../lib/mora/simple/state.js';
import { SIMPLE_INSTRUCTIONS, AUDIT_INSTRUCTIONS, generateSimpleStage } from '../../lib/mora/simple/model.js';
import source from './source-info.json' with {type:'json'};
import auditCases from './audit-cases.json' with {type:'json'};
import { readSession, sealSession } from '../../lib/mora/session.js';
import { classifyModelError } from '../../lib/mora/provider.js';
import cases from '../quality-phase1/cases.json' with {type:'json'};

export const SOURCE_COMMIT=source.commit;
export const MODEL='inception/mercury-2.5';
export const MAX_COST_USD=0.50;
const INITIAL_USED_USD=source.baselineUsedUsd;
const pilot=[{id:'P01',messages:['Eine Lampe im Arbeitszimmer funktioniert nicht.','Nur eine, seit gestern.','Nein, ich meinte Gästezimmer.']}];
const suites={main:cases,pilot,verification:auditCases.map(c=>({id:c.id,messages:[c.customerMessage]}))};
const scheduleFor=suite=>suites[suite].flatMap(c=>c.messages.map((_,turn)=>({caseId:c.id,turn:turn+1,variant:suite==='verification'?'V':'C'})));
export const schedule=scheduleFor('main');

const scope=new AsyncLocalStorage();
const nativeFetch=globalThis.fetch.bind(globalThis);
const gateway=createGateway({apiKey:process.env.AI_GATEWAY_API_KEY || undefined,
  fetch:(url,options)=>nativeFetch(url,{...options,signal:AbortSignal.timeout(5000)})});
const chat=createSimpleChatHandler();
const hash=value=>createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const credits=async()=>{
  let c,readAttempts=0;
  for(let attempt=0;attempt<2;attempt++){
    readAttempts++;
    try{c=await gateway.getCredits();break;}
    catch(error){
      // Retry only a failed read-only metadata request, never model output,
      // authentication, insufficient funds or budget decisions.
      if(attempt || !(error.statusCode>=500))throw error;
      await new Promise(resolve=>setTimeout(resolve,250));
    }
  }
  const balance=Number(c.balance),used=Number(c.totalUsed);
  if(!Number.isFinite(balance)||!Number.isFinite(used))throw Error('Unreadable credits');
  return {balanceUsd:balance,totalUsedUsd:used,readAttempts};
};
const boundary=message=>Object.assign(new Error(message),{qualityBoundary:true});
const budgetCheck=(run,c,reserve)=>{
  // Historical account evidence: one USD 5 Free AI Credit grant, no reload.
  // Refuse a different funding total rather than assuming purchased funds are free.
  if(Math.abs(c.balanceUsd+c.totalUsedUsd-5)>0.00001)throw boundary('Credit origin requires renewed verification');
  if(c.balanceUsd<reserve+0.25)throw boundary('Insufficient verified free-credit reserve');
  if(run.reservedUsd+reserve>MAX_COST_USD || c.totalUsedUsd-run.baselineUsedUsd+reserve>MAX_COST_USD)throw boundary('Evaluation cost cap reached');
};

// Read-only transport observer: sends the original SDK request unchanged and
// returns the original Response unchanged. No prompt, output or validator edits.
globalThis.fetch=async(input,options={})=>{
  const active=scope.getStore();
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(!active || url.hostname!=='ai-gateway.vercel.sh' || !url.pathname.endsWith('/language-model'))return nativeFetch(input,options);
  const body=JSON.parse(options.body);
  const headers=new Headers(options.headers);
  if(headers.get('ai-language-model-id')!==MODEL)throw boundary('Unexpected model');
  if(active.trace.length>=4)throw boundary('Unexpected generation count');
  const inputBytes=Buffer.byteLength(JSON.stringify(body));
  const outputLimit=body.maxOutputTokens;
  if(!Number.isInteger(outputLimit)||outputLimit>6400)throw boundary('Unbounded output');
  // A byte upper bound exceeds token count for these text-only SDK requests.
  const reserve=inputBytes*active.run.price.input+outputLimit*active.run.price.output+0.00001;
  const guardStart=Date.now();
  let creditBefore;
  try{creditBefore=await credits();budgetCheck(active.run,creditBefore,reserve);}
  catch(error){active.fatal=true;active.budgetStop=Boolean(error.qualityBoundary);throw error;}
  active.run.reservedUsd+=reserve;
  const trace={index:active.trace.length+1,startedAt:new Date().toISOString(),model:MODEL,
    request:{prompt:body.prompt,maxOutputTokens:outputLimit,reasoning:body.reasoning,responseFormat:body.responseFormat || null},
    requestHash:hash(JSON.stringify(body)),inputBytes,reservedUsd:reserve,creditBefore,guardMs:Date.now()-guardStart};
  active.trace.push(trace);
  const start=Date.now();
  try {
    const response=await nativeFetch(input,options);trace.durationMs=Date.now()-start;trace.httpStatus=response.status;
    const raw=await response.clone().json();
    trace.text=(raw.content || []).filter(p=>p.type==='text').map(p=>p.text).join('');
    trace.usage=raw.usage || null;trace.finishReason=raw.finishReason || null;
    trace.generationId=raw.providerMetadata?.gateway?.generationId || raw.response?.id || null;
    if(trace.generationId && /^gen_[a-zA-Z0-9_-]+$/.test(trace.generationId))active.run.generationIds.push(trace.generationId);
    if(!response.ok){trace.errorCode=raw.error?.code || raw.error?.type || 'gateway_error';active.fatal=true;}
    return response;
  }catch(error){trace.durationMs=Date.now()-start;trace.transportError=error.name;active.fatal=true;throw error;}
};
for(const level of ['info','warn','error']){
  const original=console[level].bind(console);
  console[level]=(...args)=>{const active=scope.getStore();if(active)active.logs.push({level,args:plain(args)});original(...args);};
}

function readRun(token){
  const run=readSession(token).qualityRun;
  if(!run || run.source!==SOURCE_COMMIT || run.protocol!==2 || run.nextIndex>scheduleFor(run.suite).length)throw Error('Invalid run');
  return run;
}
const tokenFor=run=>sealSession({version:2,history:[],actions:[],issues:[],qualityRun:run});
const safeResult=body=>{const {session,...rest}=body;void session;return rest;};

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(process.env.VERCEL_ENV!=='preview')return res.status(404).json({code:'NOT_FOUND'});
  if(req.method!=='POST')return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  const body=req.body || {};
  try {
    if(body.op==='start'){
      if(process.env.AI_GATEWAY_MODEL!==MODEL || process.env.MORA_AI_PROVIDER!=='gateway' || process.env.MORA_AI_REQUIRED!=='true' || process.env.MORA_AI_ENABLED!=='true')throw Error('Existing Preview configuration not inherited');
      const c=await credits();
      const catalog=await gateway.getAvailableModels();
      const model=catalog.models.find(m=>m.id===MODEL);
      if(!model?.pricing)throw Error('Live model pricing unavailable');
      const price={input:Number(model.pricing.input),output:Number(model.pricing.output)};
      if(!(price.input>0&&price.output>0))throw Error('Unreadable price');
      const suite=body.suite || 'main';
      if(!Object.hasOwn(suites,suite))throw Error('Unknown fixed evaluation suite');
      const subset=scheduleFor(suite);
      const run={protocol:2,suite,source:SOURCE_COMMIT,id:randomUUID(),startedAt:new Date().toISOString(),nextIndex:0,
        baselineUsedUsd:INITIAL_USED_USD,reservedUsd:0,generationIds:[],price};
      budgetCheck(run,c,0.02);
      return res.status(200).json({runToken:tokenFor(run),sourceCommit:SOURCE_COMMIT,model:MODEL,price,
        credits:c,maxCostUsd:MAX_COST_USD,caseCount:cases.length,suite,conversationCount:suites[suite].length,turnCount:subset.length,
        prompt:SIMPLE_INSTRUCTIONS,promptHash:hash(SIMPLE_INSTRUCTIONS),verificationPrompt:AUDIT_INSTRUCTIONS,verificationPromptHash:hash(AUDIT_INSTRUCTIONS),
        schedule:subset,manifestHash:hash(JSON.stringify(cases)),source, inferenceStarted:false});
    }

    const run=readRun(body.runToken);
    if(body.op==='audit'){
      const ids=body.generationIds || [];
      if(ids.length>12 || ids.some(id=>!run.generationIds.includes(id)))throw Error('Invalid audit IDs');
      const costs=[];
      for(const id of ids){
        try{costs.push({id,info:await gateway.getGenerationInfo({id})});}
        catch(e){costs.push({id,pending:true,status:e.statusCode || null});}
      }
      return res.status(200).json({costs,credits:await credits(),inferenceStarted:false});
    }
    if(body.op!=='turn')throw Error('Unknown evaluation operation');
    const sequence=scheduleFor(run.suite);
    const expected=sequence[run.nextIndex];
    if(!expected || ['caseId','turn','variant'].some(k=>body[k]!==expected[k]))throw Error('Unexpected evaluation sequence');
    const fixture=suites[run.suite].find(c=>c.id===body.caseId);
    const message=fixture.messages[body.turn-1];
    if(body.turn===1 && body.session || body.turn>1 && !body.session)throw Error('Missing isolated conversation session');
    if(body.session){
      const previous=readSession(body.session),guard=previous.qualityConversation;
      if(guard?.runId!==run.id || guard.caseId!==body.caseId || guard.variant!==body.variant || guard.nextTurn!==body.turn)throw Error('Conversation identity mismatch');
    }
    const active={run,trace:[],logs:[],fatal:false};
    const start=Date.now();let status=200,result;
    await scope.run(active,async()=>{
      if(run.suite==='verification'){
        const fixture=auditCases.find(c=>c.id===body.caseId);
        try {
          const selection={provider:'gateway',model:MODEL,createModel:()=>createGateway({apiKey:process.env.AI_GATEWAY_API_KEY || undefined})(MODEL)};
          const generated=await generateSimpleStage('verification',fixture.payload,selection,50000);
          result={reply:null,responseMode:'verification',verification:generated.data,expectedViolation:fixture.expectedViolation};
        }catch(e){status=503;result={reply:null,responseMode:'error',modelAvailability:classifyModelError(e,{provider:'gateway',model:MODEL})};}
      }else{
        const relay={setHeader:()=>{},status:n=>{status=n;return relay;},json:value=>{result=value;return value;}};
        await chat({method:'POST',body:{message,...(body.session?{session:body.session}:{})},headers:{}},relay);
      }
    });
    // Failed application turns preserve their exact previous application state;
    // no fabricated successful turn is inserted to make later tests look better.
    const next=result.session?readSession(result.session):body.session?readSession(body.session):hydrateSimple(null);
    next.qualityConversation={runId:run.id,caseId:body.caseId,variant:body.variant,nextTurn:body.turn+1};
    const session=sealSession(next);run.nextIndex++;
    const final=safeResult(result);
    const candidates=active.trace.map(t=>{try{const j=JSON.parse(t.text);return j.reply || j.dialogue?.reply || null;}catch{return t.text;}});
    const matchingGenerations=final.reply?active.trace.filter((_,i)=>candidates[i]===final.reply).map(t=>t.index):[];
    return res.status(200).json({runToken:tokenFor(run),session,caseId:body.caseId,variant:body.variant,turn:body.turn,message,
      applicationStatus:status,result:final,trace:active.trace,logs:active.logs,elapsedMs:Date.now()-start,
      replyOrigin:matchingGenerations.length?{type:'model_verbatim_field',matchingGenerations}:{type:final.responseMode==='verification'?'model_verification':final.responseMode==='safety'?'application_safety':'application_or_error'},
      reservedUsd:run.reservedUsd,completedRequests:run.nextIndex,totalRequests:sequence.length,fatal:active.fatal,budgetStop:Boolean(active.budgetStop)});
  }catch(error){
    return res.status(error.qualityBoundary?402:409).json({code:error.qualityBoundary?'EVALUATION_BUDGET_STOP':'INVALID_EVALUATION',reason:error.message,inferenceStarted:false});
  }
}
