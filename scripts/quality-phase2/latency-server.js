// Isolated diagnostic route only; never installed in the customer preview.
import {createGateway,generateText,streamText} from 'ai';
import {createHash} from 'node:crypto';
import {sealSession,readSession} from '../../lib/mora/session.js';
const MODEL='inception/mercury-2.5',BASELINE_USED=0.30594161,MAX_COST=0.50;
export const PROMPT='Sie sind MORA, eine professionelle Immobilienassistenz von MORADA für Mieter und Eigentümer in der Schweiz. Antworten Sie freundlich, klar und natürlich im Schweizer Hochdeutsch und in der Sie-Form. Gehen Sie auf das aktuelle Anliegen ein, behalten Sie den Gesprächskontext und fragen Sie nur nach, wenn es sinnvoll ist. Erfinden Sie keine fehlenden Angaben, Diagnosen oder Zusagen. Sie haben keinen Zugriff auf persönliche Unterlagen und können keine externen Vorgänge ausführen. Bei akuter Gefahr hat die Sicherheit von Personen Vorrang; empfehlen Sie keine gefährlichen Eingriffe. Geben Sie keine verbindlichen individuellen Rechtsentscheide oder Zusagen zur Kostenübernahme.';
const schedule=['buffered','streamed'].flatMap(mode=>['lampe kaputt','wohnzimmer'].map((message,index)=>({mode,message,turn:index+1})));
const nativeFetch=globalThis.fetch.bind(globalThis);
const meta=createGateway({apiKey:process.env.AI_GATEWAY_API_KEY || undefined,fetch:(url,options)=>nativeFetch(url,{...options,signal:AbortSignal.timeout(5000)})});
const credits=async()=>{const c=await meta.getCredits();return {balanceUsd:Number(c.balance),totalUsedUsd:Number(c.totalUsed)};};
const boundary=()=>Object.assign(new Error('Verified free-credit boundary'),{boundary:true});
function check(c,reserve=0){if(!Number.isFinite(c.balanceUsd)||!Number.isFinite(c.totalUsedUsd)||Math.abs(c.balanceUsd+c.totalUsedUsd-5)>0.00001||c.balanceUsd<0.25+reserve||c.totalUsedUsd-BASELINE_USED+reserve>MAX_COST)throw boundary();}
const token=run=>sealSession({version:2,history:[],actions:[],issues:[],latencyRun:run});
export default async function handler(req,res){
 if(process.env.VERCEL_ENV!=='preview')return res.status(404).end();
 res.setHeader('Cache-Control','private,no-store');
 if(req.method!=='POST')return res.status(405).end();
 const body=req.body || {};
 try{
  if(process.env.AI_GATEWAY_MODEL!==MODEL)throw new Error('Unexpected existing model configuration');
  if(body.op==='start'){
   const c=await credits();check(c,0.02);const catalog=await meta.getAvailableModels(),model=catalog.models.find(m=>m.id===MODEL);
   const price={input:Number(model?.pricing?.input),output:Number(model?.pricing?.output)};
   if(!(price.input>0&&price.output>0))throw new Error('Missing live model price');
   return res.json({runToken:token({index:0,price,ids:[],histories:{buffered:[],streamed:[]}}),model:MODEL,schedule,prompt:PROMPT,promptHash:createHash('sha256').update(PROMPT).digest('hex'),price,credits:c,maxCostUsd:MAX_COST,inferenceStarted:false});
  }
  const run=readSession(body.runToken).latencyRun;if(!run)throw new Error('Invalid diagnostic run');
  if(body.op==='audit'){
   const costs=[];for(const id of run.ids){try{costs.push({id,info:await meta.getGenerationInfo({id})});}catch{costs.push({id,pending:true});}}
   return res.json({costs,credits:await credits(),inferenceStarted:false});
  }
  if(body.op!=='turn'||body.index!==run.index||!schedule[run.index])throw new Error('Unexpected diagnostic step');
  const step=schedule[run.index],start=performance.now(),messages=[...run.histories[step.mode],{role:'user',content:step.message}];
  const guardStart=performance.now(),c=await credits();
  const reserve=Buffer.byteLength(JSON.stringify({PROMPT,messages}))*run.price.input+6400*run.price.output+0.00001;check(c,reserve);
  const guardMs=performance.now()-guardStart;let transportHeadersMs=null,firstTextMs=null,firstOutputMs=null,chunks=0,failed;
  const gateway=createGateway({apiKey:process.env.AI_GATEWAY_API_KEY || undefined,fetch:async(url,options)=>{const t=performance.now(),r=await nativeFetch(url,options);transportHeadersMs=performance.now()-t;return r;}});
  res.status(200);res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();
  const emit=(event,data)=>res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  emit('start',{step,guardMs});const modelStart=performance.now();let result,reply='';
  try{
   const options={model:gateway(MODEL),instructions:PROMPT,messages,maxOutputTokens:6400,reasoning:/** @type {const} */('high'),maxRetries:0,abortSignal:AbortSignal.timeout(50000)};
   if(step.mode==='streamed'){
    result=streamText({...options,onError:({error})=>{failed=error;}});
    for await(const part of result.stream){
     if((part.type==='text-delta'||part.type==='reasoning-delta')&&firstOutputMs===null)firstOutputMs=performance.now()-modelStart;
     if(part.type==='text-delta'&&part.text){firstTextMs??=performance.now()-modelStart;reply+=part.text;chunks++;emit('text',{text:part.text});}
     if(part.type==='error')failed=part.error;
    }
    if(failed)throw failed;
   }else{result=await generateText(options);reply=result.text;firstTextMs=performance.now()-modelStart;chunks=1;emit('text',{text:reply});}
   const final=await result.finalStep,usage=await result.usage,finishReason=await result.finishReason;
   const generationId=final.providerMetadata?.gateway?.generationId || final.response?.id;
   if(typeof generationId!=='string'||!/^gen_[A-Za-z0-9_-]+$/.test(generationId))throw new Error('Missing generation ID');
   run.ids.push(generationId);run.histories[step.mode].push({role:'user',content:step.message},{role:'assistant',content:reply});run.index++;
   emit('end',{runToken:token(run),step,reply,generationId,finishReason,usage,performance:final.performance,
    timings:{guardMs,transportHeadersMs,firstGeneratedOutputMs:firstOutputMs,firstTextMs,modelCompleteMs:performance.now()-modelStart,serverCompleteMs:performance.now()-start,chunks},complete:run.index===schedule.length});
  }catch(error){run.index++;emit('error',{runToken:token(run),step,error:error?.name || 'ModelError',message:'No successful diagnostic response',serverCompleteMs:performance.now()-start,complete:run.index===schedule.length});}
  res.end();
 }catch(error){res.status(error.boundary?402:409).json({code:error.boundary?'CREDIT_BOUNDARY':'DIAGNOSTIC_ERROR',inferenceStarted:false});}
}
