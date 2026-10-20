import { z } from 'zod';
import cases from '../scripts/premium-cases.json' with { type:'json' };
import { createChatHandler } from './chat.js';
import { createUnderstandingService } from '../lib/mora/understanding.js';
import { readSession, sealSession } from '../lib/mora/session.js';
import { generateText, Output } from 'ai';
import { resolveProvider, modelUnavailable, classifyModelError, safeUsage, logModelUsage } from '../lib/mora/provider.js';
import { modelFailure } from '../lib/mora/availability.js';
import { CONVERSATION_INSTRUCTIONS } from '../lib/mora/instructions.js';

// Evaluation only: never a customer-selectable model, arbitrary-prompt proxy,
// fallback model, portal data access or production endpoint.
const inputSchema=z.object({
  model:z.enum(['openai/gpt-6-luna','anthropic/claude-sonnet-5.5','inception/mercury-3','inception/mercury-2.5']),
  mode:z.enum(['structured','dialogue_only']).optional(),
  caseId:z.enum(['01','03','05','09','19','24','27','29','30']),
  turn:z.number().int().min(1).max(3),session:z.string().max(180000).optional(),
}).strict();

export function createEvaluationHandler({env=process.env,makeUnderstanding=createUnderstandingService,generate=generateText}={}) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    if (env.VERCEL_ENV!=='preview' || env.VERCEL_GIT_COMMIT_REF!=='codex/mora-ai-2.0' || env.MORA_AI_CREDIT_CHECK!=='true')
      return res.status(404).json({code:'NOT_FOUND'});
    if (req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).json({code:'METHOD_NOT_ALLOWED'});}
    const parsed=inputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({code:'INVALID_EVALUATION'});
    const {model,caseId,turn,session,mode='structured'}=parsed.data;
    const fixture=cases.find(item=>item.id===caseId);
    if (!fixture || turn>fixture.messages.length) return res.status(400).json({code:'INVALID_EVALUATION'});
    try {
      if (turn===1 && session || turn>1 && !session) throw new Error('Invalid evaluation sequence');
      if (session) {
        const state=readSession(session),run=state.evaluationRun;
        const users=state.history.filter(entry=>entry.role==='user').map(entry=>entry.content);
        if (!run || run.model!==model || run.caseId!==caseId || run.nextTurn!==turn || (run.mode || 'structured')!==mode ||
          JSON.stringify(users)!==JSON.stringify(fixture.messages.slice(0,turn-1))) throw new Error('Not an isolated synthetic session');
      }
    } catch { return res.status(409).json({code:'INVALID_EVALUATION_SESSION'}); }
    const evaluationEnv={...env,MORA_AI_PROVIDER:'gateway',AI_GATEWAY_MODEL:model,MORA_AI_REQUIRED:'true'};
    if (mode==='dialogue_only') {
      // Bounded diagnostic control only: same personality/capabilities, no JSON
      // schema, extraction, action generation or portal execution. This is not a
      // customer-facing product mode and never accepts normal customer sessions.
      const started=Date.now();let selection;
      try {
        selection=await resolveProvider(evaluationEnv);
        if (!selection.ready) throw modelUnavailable(selection.availability);
        const state=session ? readSession(session) : {version:2,history:[],actions:[],issues:[],issue:null};
        const message=fixture.messages[turn-1];
        const result=await generate({model:selection.createModel(),instructions:CONVERSATION_INSTRUCTIONS.split('KLEINE NOTIZEN')[0]+'\nAntworten Sie als normaler Gesprächstext.',
          messages:[...state.history,{role:'user',content:message}],output:Output.text(),reasoning:'high',maxOutputTokens:6400,maxRetries:0,
          abortSignal:AbortSignal.timeout(50000)});
        const reply=result.text;
        if (typeof reply!=='string' || !reply.trim() || reply.length>4000) throw Object.assign(new Error('Invalid evaluation output'),{type:'invalid_model_output'});
        state.history.push({role:'user',content:message},{role:'assistant',content:reply});state.evaluationRun={model,caseId,nextTurn:turn+1,mode};
        const duration=Date.now()-started;
        logModelUsage('dialogue_only_evaluation',selection,result.usage,duration,result.finalStep?.providerMetadata);
        return res.status(200).json({reply,session:sealSession(state),issues:[],issue:null,actions:[],responseMode:'model',understanding:'model',
          timingMs:{total:duration,model:duration,application:0},modelCalls:1,modelUsage:safeUsage(result.usage),
          evaluation:{model,caseId,turn,mode,synthetic:true,productModelChanged:false}});
      } catch (error) {
        return res.status(503).json({...modelFailure(error.availability || classifyModelError(error,selection || {provider:'gateway',model})),
          evaluation:{model,caseId,turn,mode,synthetic:true,productModelChanged:false}});
      }
    }
    const handler=createChatHandler(makeUnderstanding({env:evaluationEnv}),{env:evaluationEnv});
    const relay={
      setHeader:(name,value)=>res.setHeader(name,value),
      status:code=>{res.status(code);return relay;},
      json:body=>{
        if (body.session) {
          const state=readSession(body.session);state.evaluationRun={model,caseId,nextTurn:turn+1,mode};body.session=sealSession(state);
        }
        return res.json({...body,evaluation:{model,caseId,turn,synthetic:true,productModelChanged:false}});
      },
    };
    return handler({method:'POST',body:{message:fixture.messages[turn-1],...(session ? {session} : {})}},relay);
  };
}
export default createEvaluationHandler();
