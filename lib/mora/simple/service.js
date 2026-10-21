import {decisionSchema,auditSchema,generateSimpleStage} from './model.js';
import {simpleContext,projectDecision,verificationData,commitDecision} from './state.js';
import {resolveProvider,classifyModelError,modelUnavailable,safeUsage} from '../provider.js';

/** One conversational decision. Verification cannot change questions, facts or prose. */
export function createSimpleService({env=process.env,resolve=resolveProvider,generate=generateSimpleStage}={}) {
  return async function converse(message,previous,timeoutMs=55000) {
    const selection=await resolve(env);
    if(!selection.ready)throw modelUnavailable(selection.availability);
    if(selection.provider!=='gateway' || selection.model!=='inception/mercury-2.5')throw modelUnavailable({provider:selection.provider,model:selection.model,status:null,reason:'unexpected_model'});
    const deadline=Date.now()+timeoutMs,{context,history}=simpleContext(previous),usages=[];
    let calls=0,repair;
    const invoke=async(stage,payload)=>{
      calls++;
      try {const result=await generate(stage,payload,selection,deadline-Date.now());if(result.usage)usages.push(safeUsage(result.usage));return result.data;}
      catch(error){if(error.usage)usages.push(safeUsage(error.usage));throw error;}
    };
    const usage=()=>Object.fromEntries(['inputTokens','outputTokens','reasoningTokens','cachedInputTokens'].map(k=>[k,usages.length && usages.every(u=>Number.isSafeInteger(u[k]))?usages.reduce((sum,u)=>sum+u[k],0):null]));
    try {
      for(let attempt=0;attempt<2;attempt++){
        try {
          const plan=decisionSchema.parse(await invoke('decision',{context,history,message,repair}));
          const candidate=projectDecision(previous,message,plan);
          const audit=auditSchema.parse(await invoke('verification',verificationData(previous,candidate,message,plan)));
          if(audit.violations.length)throw Object.assign(new Error('Semantic contract rejected'),{type:'invalid_model_output',violations:audit.violations});
          return {...commitDecision(candidate,message,plan),modelCalls:calls,modelUsage:usage(),repaired:attempt===1};
        }catch(error){
          const invalid=error.type==='invalid_model_output' || error.name==='ZodError';
          if(!invalid || attempt)throw error;
          repair=error.violations || [{kind:'contract',reason:error.name==='ZodError'?'Return exactly the required schema.':error.message}];
          console.warn('MORA simple candidate rejected',{kinds:repair.map(v=>v.kind),attempt:1});
        }
      }
    }catch(error){
      throw Object.assign(modelUnavailable(classifyModelError(error,selection)),{modelCalls:calls,modelUsage:usage()});
    }
  };
}
