import {z} from 'zod';
import {chatInputSchema} from '../lib/mora/schema.js';
import {readSession,sealSession} from '../lib/mora/session.js';
import {portalCapabilities} from '../lib/portal/adapter.js';
import {modelFailure} from '../lib/mora/availability.js';
import {createSimpleService} from '../lib/mora/simple/service.js';
import {operationalTurn,safetyContext} from '../lib/mora/simple/state.js';

const receipt=z.object({operationId:z.string().uuid(),issueId:z.string().uuid(),draftId:z.string().uuid(),
  revision:z.number().int().min(1),contentHash:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['portal_received','error']),
  conflictFields:z.array(z.enum(['description','equipment','defect','count','extent','location','since','details'])).max(8).optional(),
}).strict();
const inputSchema=z.object({...chatInputSchema.shape,draftReceipt:receipt.optional()}).strict()
  .refine(v=>Boolean(v.message || v.actionId || v.attachments || v.draftReceipt))
  .refine(v=>!(v.message && v.actionId))
  .refine(v=>!v.draftReceipt || Boolean(v.session && !v.message && !v.actionId && !v.attachments))
  .refine(v=>!v.attachments || new Set(v.attachments.map(f=>f.id)).size===v.attachments.length);

export function createSimpleChatHandler({converse=createSimpleService()}={}) {
  return async function handler(req,res){
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST')return res.status(405).json({error:'Nur POST-Anfragen sind erlaubt.'});
    const parsed=inputSchema.safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:'Bitte geben Sie eine gültige Nachricht oder Aktion ein.'});
    const start=Date.now();let safety;
    try {
      const previous=parsed.data.session?readSession(parsed.data.session):null;
      const operation=operationalTurn(parsed.data,previous);
      safety=parsed.data.message?safetyContext(parsed.data.message,operation.state):null;
      const result=operation.reply?operation:await converse(parsed.data.message,operation.state,55000-(Date.now()-start));
      const total=Date.now()-start;
      return res.status(200).json({version:2,architecture:'simple_v1',reply:result.reply,actions:result.state.actions,
        issue:result.state.issue,issues:result.state.issues,session:sealSession(result.state),
        capabilities:{...portalCapabilities,integrationScope:'test_app_local',alexanderPortalConnected:false},
        understanding:result.understanding,responseMode:result.responseMode,safety:result.state.safety,
        ...(safety?{safetyNotice:safety.notice}:{}),...(result.operation?{operation:result.operation}:{}),
        modelCalls:result.modelCalls || 0,modelUsage:result.modelUsage || null,repaired:Boolean(result.repaired),
        timingMs:{total,model:result.modelCalls?total:0,application:result.modelCalls?0:total}});
    }catch(error){
      if(['INVALID_SESSION','INVALID_ACTION','ISSUE_LIMIT'].includes(error.code))return res.status(409).json({error:'Diese Unterhaltung oder Aktion ist nicht mehr aktuell. Ihre bisherigen Angaben bleiben erhalten.',code:error.code,retryable:false});
      if(error.code==='MODEL_UNAVAILABLE')return res.status(503).json({...modelFailure(error.availability),modelCalls:error.modelCalls || 0,modelUsage:error.modelUsage || null,
        ...(safety?{safetyNotice:safety.notice}:{}),timingMs:{total:Date.now()-start}});
      console.error('MORA simple failed',{code:'TURN_FAILED'});
      return res.status(500).json({error:'MORA konnte gerade keine verlässliche Antwort geben. Ihre bisherigen Angaben bleiben erhalten.',code:'TURN_FAILED',...(safety?{safetyNotice:safety.notice}:{})});
    }
  };
}
export default createSimpleChatHandler();
