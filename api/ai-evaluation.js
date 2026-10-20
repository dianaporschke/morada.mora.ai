import { z } from 'zod';
import cases from '../scripts/premium-cases.json' with { type:'json' };
import { createChatHandler } from './chat.js';
import { createUnderstandingService } from '../lib/mora/understanding.js';
import { readSession, sealSession } from '../lib/mora/session.js';

// Evaluation only: never a customer-selectable model, arbitrary-prompt proxy,
// fallback model, portal data access or production endpoint.
const inputSchema=z.object({
  model:z.enum(['openai/gpt-6-luna','anthropic/claude-sonnet-5.5']),
  caseId:z.enum(['01','03','05','09','19','24','27','29','30']),
  turn:z.number().int().min(1).max(3),session:z.string().max(180000).optional(),
}).strict();

export function createEvaluationHandler({env=process.env,makeUnderstanding=createUnderstandingService}={}) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    if (env.VERCEL_ENV!=='preview' || env.VERCEL_GIT_COMMIT_REF!=='codex/mora-ai-2.0' || env.MORA_AI_CREDIT_CHECK!=='true')
      return res.status(404).json({code:'NOT_FOUND'});
    if (req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).json({code:'METHOD_NOT_ALLOWED'});}
    const parsed=inputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({code:'INVALID_EVALUATION'});
    const {model,caseId,turn,session}=parsed.data;
    const fixture=cases.find(item=>item.id===caseId);
    if (!fixture || turn>fixture.messages.length) return res.status(400).json({code:'INVALID_EVALUATION'});
    try {
      if (turn===1 && session || turn>1 && !session) throw new Error('Invalid evaluation sequence');
      if (session) {
        const state=readSession(session),run=state.evaluationRun;
        const users=state.history.filter(entry=>entry.role==='user').map(entry=>entry.content);
        if (!run || run.model!==model || run.caseId!==caseId || run.nextTurn!==turn ||
          JSON.stringify(users)!==JSON.stringify(fixture.messages.slice(0,turn-1))) throw new Error('Not an isolated synthetic session');
      }
    } catch { return res.status(409).json({code:'INVALID_EVALUATION_SESSION'}); }
    const evaluationEnv={...env,MORA_AI_PROVIDER:'gateway',AI_GATEWAY_MODEL:model,MORA_AI_REQUIRED:'true'};
    const handler=createChatHandler(makeUnderstanding({env:evaluationEnv}),{env:evaluationEnv});
    const relay={
      setHeader:(name,value)=>res.setHeader(name,value),
      status:code=>{res.status(code);return relay;},
      json:body=>{
        if (body.session) {
          const state=readSession(body.session);state.evaluationRun={model,caseId,nextTurn:turn+1};body.session=sealSession(state);
        }
        return res.json({...body,evaluation:{model,caseId,turn,synthetic:true,productModelChanged:false}});
      },
    };
    return handler({method:'POST',body:{message:fixture.messages[turn-1],...(session ? {session} : {})}},relay);
  };
}
export default createEvaluationHandler();
