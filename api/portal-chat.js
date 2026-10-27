import {z} from 'zod';
import {readSession,sealSession} from '../lib/mora/session.js';
import {hydrateSimple,beginPreparation,acceptReceipt,safetyContext,contentHash} from '../lib/mora/simple/state.js';
import {createPortalService,targets} from '../lib/mora/portal/service.js';
import {createPreviewCreditGuard} from '../lib/mora/portal/budget.js';
import {rememberPreparationOffer} from '../lib/mora/actions.js';
import {portalCaseFields,portalCaseEvidence} from '../assets/mora-portal-map.js';
import {portalControls} from '../lib/mora/portal/action-state.js';

const receipt=z.object({operationId:z.string().uuid(),issueId:z.string().uuid(),draftId:z.string().uuid(),revision:z.number().int().positive(),contentHash:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['portal_received','error']),attachmentCount:z.number().int().min(0).max(3).optional(),conflictFields:z.array(z.enum(['title','description','unit','category'])).max(4).optional()}).strict();
const schema=z.object({session:z.string().max(180000).optional(),message:z.string().trim().min(1).max(2000).optional(),messageId:z.string().uuid().optional(),action:z.enum(['save-issue','review-issue','switch-issue','draft-opened','draft-closed','draft-error','new-conversation']).optional(),issueId:z.string().uuid().optional(),receipt:receipt.optional(),navigation:z.array(z.enum(targets)).max(targets.length).default([])}).strict()
  .refine(v=>[v.message,v.action,v.receipt].filter(Boolean).length===1)
  .refine(v=>!v.message||Boolean(v.messageId));
export const controls=portalControls;
export function createPortalChatHandler({converse=createPortalService(),preflight=createPreviewCreditGuard(),integration='portal_v1'}={}) {
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  // An isolated Preview route; never activate this integration on production.
  if(process.env.VERCEL_ENV==='production')return res.status(404).json({code:'NOT_FOUND'});
  if(req.method==='GET'){
    try{return res.status(200).json({architecture:integration,inferenceStarted:false,...await preflight()});}
    catch{return res.status(503).json({code:'PREVIEW_CREDIT_BOUNDARY',error:'Das freigegebene KI-Testbudget konnte nicht bestätigt werden.'});}
  }
  if(req.method!=='POST')return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  const parsed=schema.safeParse(req.body);if(!parsed.success)return res.status(400).json({code:'INVALID_INPUT',error:'Bitte prüfen Sie die Nachricht.'});
  const input=parsed.data,start=Date.now();let state;
  const reply=(status,data)=>res.status(status).json({architecture:integration,...data,...(state?{session:sealSession(state),issue:state.issue,issues:state.issues,controls:controls(state,data.navigation || [],input.navigation.includes('cases')),safety:state.safety || null}:{}),timingMs:{...(data.timingMs||{}),total:Date.now()-start}});
  try{
    const previous=input.session?readSession(input.session):null;
    if(previous&&previous.integration!==integration)throw Object.assign(Error('Wrong integration'),{code:'INVALID_SESSION'});
    state=hydrateSimple(previous);state.integration=integration;state.portalJournal ||= [];state.portalPending ||= [];
    if(input.action==='new-conversation'){state=hydrateSimple(null);state.integration=integration;state.portalJournal=[];state.portalPending=[];return reply(200,{mode:'control',modelCalls:0});}
    if(input.receipt){
      acceptReceipt(state,input.receipt);
      if(input.receipt.status==='portal_received'){const i=state.issues.find(i=>i.id===input.receipt.issueId);i.portalAttachmentCount=input.receipt.attachmentCount ?? i.portalAttachmentCount ?? 0;}
      state.portalDraftOpen=null;
      return reply(200,{mode:'receipt',modelCalls:0,receiptAccepted:input.receipt.status==='portal_received'});
    }
    if(input.action==='switch-issue'){
      const issue=state.issues.find(i=>i.id===input.issueId);if(!issue||state.portalDraftOpen)throw Object.assign(Error('Unknown issue or open form'),{code:'INVALID_ACTION'});
      state.issue=issue;state.pendingKey=issue.pendingKey || null;state.conversationTopic='issue';
      return reply(200,{mode:'control',modelCalls:0});
    }
    if(['draft-opened','draft-closed','draft-error'].includes(input.action)){
      if(input.action==='draft-opened'||input.action==='draft-error'){
        if(state.pendingPreparation?.issueId!==input.issueId)throw Object.assign(Error('Missing ticket'),{code:'INVALID_ACTION'});
        state.portalDraftOpen={issueId:input.issueId,revision:state.pendingPreparation.revision,status:input.action==='draft-error'?'error':'prepared'};
      }else if(state.portalDraftOpen?.issueId===input.issueId)state.portalDraftOpen=null;
      return reply(200,{mode:'control',modelCalls:0});
    }
    if(input.action==='save-issue'||input.action==='review-issue'){
      if(!input.navigation.includes('cases')||!(input.action==='save-issue'?controls(state).save:controls(state).review))throw Object.assign(Error('Action unavailable'),{code:'INVALID_ACTION'});
      // A current saved case may be reopened for review/photos without changing
      // its chat revision. A ticket remains permission, never storage evidence.
      const current=state.issue.preparation?.receipt;
      const operation=current?.contentHash===contentHash(state.issue)?Object.fromEntries(['operationId','issueId','draftId','revision','contentHash'].map(k=>[k,current[k]])):beginPreparation(state);
      state.pendingPreparation=operation;
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
    const journal=state.portalJournal;state=result.state;state.integration=integration;
    state.portalJournal=[...journal,{role:'assistant',content:result.reply}].slice(-48);state.portalPending=[];
    // Portal controls are derived separately from plan.actions. Record the
    // actual offer returned to this client, so the next model turn sees it.
    // A visible offer is neither an opened form nor a successful save.
    if(input.navigation.includes('cases')&&controls(state).save)rememberPreparationOffer(state);
    const actionable=controls(state).save||controls(state).review;
    return reply(200,{mode:'model',reply:result.reply,navigation:result.navigation,requestedAction:actionable?result.requestedAction:null,modelCalls:result.modelCalls,generationIds:result.generationIds,usage:result.usage,repaired:result.repaired,repairScope:result.repairScope || null,...('toolEvents' in result?{toolEvents:result.toolEvents}:{}),timingMs:{model:result.modelMs,creditGuard:result.guardMs}});
  }catch(error){
    if(integration==='portal_agent_v1'&&error.conversationState&&state){
      const journal=state.portalJournal,pending=state.portalPending;
      state=hydrateSimple(error.conversationState);state.integration=integration;state.portalJournal=journal;
      state.portalPending=error.toolEvents?.some(e=>e.tool==='record_issues'&&e.ok)?[]:pending;
    }
    const conflict=['INVALID_ACTION','INVALID_SESSION','ISSUE_LIMIT'].includes(error.code);
    const code=conflict?error.code:error.code==='PREVIEW_CREDIT_BOUNDARY'?'PREVIEW_CREDIT_BOUNDARY':'MODEL_UNAVAILABLE';
    const limited=error.availability?.reason==='rate_limit_exceeded'||error.availability?.status===429;
    // Isolated Preview diagnostics return only to this conversation's caller;
    // never log customer text or display rejected model text as an answer.
    const diagnostic=integration==='portal_agent_v1'?{toolEvents:error.toolEvents || [],...(error.diagnostic?{diagnostic:error.diagnostic}:{})}:{};
    return reply(conflict?409:limited?429:503,{code:limited?'MODEL_RATE_LIMIT':code,error:conflict?'Diese Aktion ist nicht mehr verfügbar. Ihre gespeicherten Angaben bleiben erhalten.':code==='PREVIEW_CREDIT_BOUNDARY'?'Das freigegebene KI-Testbudget erlaubt gerade keine weitere Modellanfrage. Ihre Angaben bleiben erhalten.':limited?'Die KI-Anbindung hat gerade ihr Anfragelimit erreicht. Bitte versuchen Sie es später erneut. Ihre Nachricht bleibt erhalten.':'MORA konnte gerade keine verlässliche Antwort geben. Ihre Nachricht bleibt für den nächsten Versuch erhalten.',...diagnostic,availability:error.availability || null,modelCalls:error.modelCalls||0,generationIds:error.generationIds || []});
  }
 };
}
export default createPortalChatHandler();
