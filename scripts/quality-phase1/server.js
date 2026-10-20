// Isolated evaluation instrumentation. This file is NOT a customer API route.
// The temporary test bundle alone adds api/quality-phase1.js importing it.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID, createHash } from 'node:crypto';
import { createGateway, generateText, Output } from 'ai';
import { createChatHandler } from '../../api/chat.js';
import { readSession, sealSession } from '../../lib/mora/session.js';
import { classifyModelError } from '../../lib/mora/provider.js';
import cases from './cases.json' with {type:'json'};

export const SOURCE_COMMIT='bcd730adc9b5cd8ae52086c8f9db64be82e2a660';
export const MODEL='inception/mercury-2.5';
export const MAX_COST_USD=0.50;
const INITIAL_USED_USD=0.268472694;
export const SIMPLE_PROMPT=`Sie sind MORA, eine professionelle Immobilienassistenz von MORADA für Mieter und Eigentümer in der Schweiz. Antworten Sie freundlich, klar und natürlich im Schweizer Hochdeutsch und in der Sie-Form. Gehen Sie auf das aktuelle Anliegen ein, behalten Sie den Gesprächskontext und fragen Sie nur nach, wenn es sinnvoll ist. Erfinden Sie keine fehlenden Angaben, Diagnosen oder Zusagen. Sie haben keinen Zugriff auf persönliche Unterlagen und können keine externen Vorgänge ausführen. Bei akuter Gefahr hat die Sicherheit von Personen Vorrang; empfehlen Sie keine gefährlichen Eingriffe. Geben Sie keine verbindlichen individuellen Rechtsentscheide oder Zusagen zur Kostenübernahme.`;
export const schedule=cases.flatMap((c,index)=>c.messages.flatMap((_,turn)=>(index%2?['B','A']:['A','B']).map(variant=>({caseId:c.id,turn:turn+1,variant}))));

const scope=new AsyncLocalStorage();
const nativeFetch=globalThis.fetch.bind(globalThis);
const gateway=createGateway({apiKey:process.env.AI_GATEWAY_API_KEY || undefined,
  fetch:(url,options)=>nativeFetch(url,{...options,signal:AbortSignal.timeout(5000)})});
const chat=createChatHandler();
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
  if(!run || run.source!==SOURCE_COMMIT || run.protocol!==1 || run.nextIndex>schedule.length)throw Error('Invalid run');
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
      if(body.retestCase!==undefined && body.retestCase!=='09')throw Error('Only the documented measurement replacement is allowed');
      const subset=body.retestCase?schedule.filter(s=>s.caseId==='09'):schedule;
      const firstIndex=body.retestCase?schedule.findIndex(s=>s.caseId==='09'):0;
      const run={protocol:1,source:SOURCE_COMMIT,id:randomUUID(),startedAt:new Date().toISOString(),nextIndex:firstIndex,
        ...(body.retestCase?{endIndex:firstIndex+subset.length}:{}),
        baselineUsedUsd:INITIAL_USED_USD,reservedUsd:0.002,generationIds:[],price};
      budgetCheck(run,c,0.02);
      return res.status(200).json({runToken:tokenFor(run),sourceCommit:SOURCE_COMMIT,model:MODEL,price,
        credits:c,maxCostUsd:MAX_COST_USD,caseCount:cases.length,turnCount:subset.length,retestCase:body.retestCase || null,
        promptA:SIMPLE_PROMPT,promptAHash:hash(SIMPLE_PROMPT),schedule:subset,manifestHash:hash(JSON.stringify(cases)),inferenceStarted:false});
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
    if(run.endIndex && run.nextIndex>=run.endIndex)throw Error('Replacement conversation complete');
    const expected=schedule[run.nextIndex];
    if(!expected || ['caseId','turn','variant'].some(k=>body[k]!==expected[k]))throw Error('Unexpected evaluation sequence');
    const fixture=cases.find(c=>c.id===body.caseId);
    const message=fixture.messages[body.turn-1];
    if(body.turn===1 && body.session || body.turn>1 && !body.session)throw Error('Missing isolated conversation session');
    if(body.session){
      const previous=readSession(body.session),guard=previous.qualityConversation;
      if(guard?.runId!==run.id || guard.caseId!==body.caseId || guard.variant!==body.variant || guard.nextTurn!==body.turn)throw Error('Conversation identity mismatch');
    }
    const active={run,trace:[],logs:[],fatal:false};
    const start=Date.now();let status=200,result;
    await scope.run(active,async()=>{
      if(body.variant==='A'){
        const state=body.session?readSession(body.session):{version:2,history:[],actions:[],issues:[]};
        try {
          const generated=await generateText({model:createGateway({apiKey:process.env.AI_GATEWAY_API_KEY || undefined,fetch:(...args)=>globalThis.fetch(...args)})(MODEL),instructions:SIMPLE_PROMPT,
            messages:[...state.history,{role:'user',content:message}],output:Output.text(),reasoning:'high',
            maxOutputTokens:6400,maxRetries:0,abortSignal:AbortSignal.timeout(50000),providerOptions:{openai:{store:false}}});
          const reply=generated.text;
          state.history.push({role:'user',content:message},{role:'assistant',content:reply});
          result={reply,actions:[],issues:[],responseMode:'model',modelUsage:generated.usage,session:sealSession(state)};
        }catch(e){status=503;result={reply:null,responseMode:'error',modelAvailability:classifyModelError(e,{provider:'gateway',model:MODEL})};if(e.qualityBoundary)active.fatal=true;}
      }else{
        const relay={setHeader:()=>{},status:n=>{status=n;return relay;},json:value=>{result=value;return value;}};
        await chat({method:'POST',body:{message,...(body.session?{session:body.session}:{})},headers:{}},relay);
      }
    });
    // Failed application turns preserve their exact previous application state;
    // no fabricated successful turn is inserted to make later tests look better.
    const next=result.session?readSession(result.session):body.session?readSession(body.session):{version:2,history:[],actions:[],issues:[]};
    next.qualityConversation={runId:run.id,caseId:body.caseId,variant:body.variant,nextTurn:body.turn+1};
    const session=sealSession(next);run.nextIndex++;
    const final=safeResult(result);
    const candidates=active.trace.map(t=>{try{const j=JSON.parse(t.text);return j.reply || j.dialogue?.reply || null;}catch{return t.text;}});
    const matchingGenerations=active.trace.filter((_,i)=>candidates[i]===final.reply).map(t=>t.index);
    return res.status(200).json({runToken:tokenFor(run),session,caseId:body.caseId,variant:body.variant,turn:body.turn,message,
      applicationStatus:status,result:final,trace:active.trace,logs:active.logs,elapsedMs:Date.now()-start,
      replyOrigin:matchingGenerations.length?{type:'model_verbatim_field',matchingGenerations}:{type:final.responseMode==='safety'?'application_safety':final.responseMode==='recovery'?'application_recovery':'application_or_error'},
      reservedUsd:run.reservedUsd,completedRequests:run.nextIndex,totalRequests:schedule.length,fatal:active.fatal,budgetStop:Boolean(active.budgetStop)});
  }catch(error){
    return res.status(error.qualityBoundary?402:409).json({code:error.qualityBoundary?'EVALUATION_BUDGET_STOP':'INVALID_EVALUATION',reason:error.message,inferenceStarted:false});
  }
}
