import {z} from 'zod';
import {readSession,sealSession} from '../lib/mora/session.js';
import {hydrateSimple,beginPreparation,acceptReceipt,safetyContext,contentHash} from '../lib/mora/simple/state.js';
import {createPortalService,targets} from '../lib/mora/portal/service.js';
import {createFreeCreditGuard} from '../lib/mora/portal/budget.js';
import {portalCaseFields,portalCaseEvidence} from '../assets/mora-portal-map.js';

const receipt=z.object({operationId:z.string().uuid(),issueId:z.string().uuid(),draftId:z.string().uuid(),revision:z.number().int().positive(),contentHash:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['portal_received','error'])}).strict();
const schema=z.object({session:z.string().max(180000).optional(),message:z.string().trim().min(1).max(2000).optional(),messageId:z.string().uuid().optional(),action:z.enum(['save-issue','new-conversation']).optional(),receipt:receipt.optional(),navigation:z.array(z.enum(targets)).max(targets.length).default([])}).strict()
  .refine(v=>[v.message,v.action,v.receipt].filter(Boolean).length===1)
  .refine(v=>!v.message||Boolean(v.messageId));
export function controls(state,navigation=[]) {
  const i=state.issue,current=Boolean(i?.preparation?.receipt?.contentHash=== (i?contentHash(i):''));
  const ready=i&&i.equipment&&i.equipment!=='unknown'&&i.defect&&i.location&& !['equipment','defect','location'].some(k=>['unknown','uncertain'].includes(i.fieldFacts?.[k]?.status));
  const save=ready&&!current&&!state.safety&&!state.pendingKey&&!state.portalPending?.length&&state.conversationTopic==='issue';
  return {save:save?{operation:i.preparation?.receipt?'update':'create',issueId:i.id}:null,
    stored:current&&state.conversationTopic==='issue'?{id:i.id,scope:'this_device',transmitted:false}:null,
    navigation:state.pendingKey||save||state.safety?[]:navigation};
}
export function createPortalChatHandler({converse=createPortalService(),preflight=createFreeCreditGuard()}={}) {
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  // An isolated Preview route; never activate this integration on production.
  if(process.env.VERCEL_ENV==='production')return res.status(404).json({code:'NOT_FOUND'});
  if(req.method==='GET'){
    try{return res.status(200).json({architecture:'portal_v1',inferenceStarted:false,...await preflight()});}
    catch{return res.status(503).json({code:'FREE_CREDIT_BOUNDARY',error:'Das verfügbare kostenlose KI-Guthaben konnte nicht bestätigt werden.'});}
  }
  if(req.method!=='POST')return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  const parsed=schema.safeParse(req.body);if(!parsed.success)return res.status(400).json({code:'INVALID_INPUT',error:'Bitte prüfen Sie die Nachricht.'});
  const input=parsed.data,start=Date.now();let state;
  const reply=(status,data)=>res.status(status).json({architecture:'portal_v1',...data,...(state?{session:sealSession(state),issue:state.issue,issues:state.issues,controls:controls(state,data.navigation || []),safety:state.safety || null}:{}),timingMs:{...(data.timingMs||{}),total:Date.now()-start}});
  try{
    const previous=input.session?readSession(input.session):null;
    if(previous&&previous.integration!=='portal_v1')throw Object.assign(Error('Wrong integration'),{code:'INVALID_SESSION'});
    state=hydrateSimple(previous);state.integration='portal_v1';state.portalJournal ||= [];state.portalPending ||= [];
    if(input.action==='new-conversation'){state=hydrateSimple(null);state.integration='portal_v1';state.portalJournal=[];state.portalPending=[];return reply(200,{mode:'control',modelCalls:0});}
    if(input.receipt){
      acceptReceipt(state,input.receipt);
      return reply(200,{mode:'receipt',modelCalls:0,receiptAccepted:input.receipt.status==='portal_received'});
    }
    if(input.action==='save-issue'){
      if(!controls(state).save)throw Object.assign(Error('Action unavailable'),{code:'INVALID_ACTION'});
      const operation=beginPreparation(state);
      return reply(200,{mode:'write_ticket',operation,fields:portalCaseFields(state.issue),sourceEvidence:portalCaseEvidence(state.issue),modelCalls:0});
    }
    if(state.portalJournal.some(m=>m.id===input.messageId))return reply(409,{code:'ALREADY_PROCESSED',error:'Diese Nachricht ist bereits im Gespräch enthalten.'});
    if(state.portalPending.length>=6)return reply(409,{code:'PENDING_LIMIT',error:'Mehrere Nachrichten sind noch unbeantwortet. Bitte starten Sie ein neues Gespräch; der bisherige Chat bleibt sichtbar.'});
    const message=[...state.portalPending.map(p=>p.content),input.message].join('\n');
    const safety=safetyContext(message,state);state.safety=safety?(({notice,...rest})=>rest)(safety):null;
    const before=structuredClone(state);
    state.portalJournal.push({role:'user',content:input.message,id:input.messageId});
    state.portalJournal=state.portalJournal.slice(-48);
    state.portalPending.push({content:input.message,id:input.messageId});
    const result=await converse(message,before,input.navigation,45000);
    const journal=state.portalJournal;state=result.state;state.integration='portal_v1';
    state.portalJournal=[...journal,{role:'assistant',content:result.reply}].slice(-48);state.portalPending=[];
    return reply(200,{mode:'model',reply:result.reply,navigation:result.navigation,modelCalls:result.modelCalls,generationIds:result.generationIds,usage:result.usage,repaired:result.repaired,timingMs:{model:result.modelMs,creditGuard:result.guardMs}});
  }catch(error){
    const conflict=['INVALID_ACTION','INVALID_SESSION','ISSUE_LIMIT'].includes(error.code);
    const code=conflict?error.code:error.code==='FREE_CREDIT_BOUNDARY'?'FREE_CREDIT_BOUNDARY':'MODEL_UNAVAILABLE';
    const limited=error.availability?.reason==='rate_limit_exceeded'||error.availability?.status===429;
    return reply(conflict?409:limited?429:503,{code:limited?'MODEL_RATE_LIMIT':code,error:conflict?'Diese Aktion ist nicht mehr verfügbar. Ihre gespeicherten Angaben bleiben erhalten.':code==='FREE_CREDIT_BOUNDARY'?'Die Prüfung des kostenlosen KI-Guthabens erlaubt gerade keine weitere Modellanfrage.':limited?'Die KI-Anbindung hat gerade ihr Anfragelimit erreicht. Bitte versuchen Sie es später erneut. Ihre Nachricht bleibt erhalten.':'MORA konnte gerade keine verlässliche Antwort geben. Ihre Nachricht bleibt für den nächsten Versuch erhalten.',availability:error.availability || null,modelCalls:error.modelCalls||0,generationIds:error.generationIds || []});
  }
 };
}
export default createPortalChatHandler();
