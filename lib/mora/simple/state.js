import {createHash} from 'node:crypto';
import {createIssue,applyPatch,refresh} from '../issue-state.js';
import {emptyUnderstanding} from '../schema.js';
import {modelContext} from '../context.js';
import {action,report,photo,validateActions,rememberPreparationOffer} from '../actions.js';
import {draftActionState,issueContent} from '../../../assets/mora-data.js';
import {detectHazard,explicitHazardDenial,safetyNotice} from '../safety.js';

export const contentHash=issue=>createHash('sha256').update(issueContent(issue)).digest('hex');
export const invalid=reason=>Object.assign(new Error(reason),{code:'INVALID_ACTION'});
export const contract=reason=>Object.assign(new Error(reason),{type:'invalid_model_output'});
export function hydrateSimple(previous) {
  if(previous && previous.architecture!=='simple_v1')throw Object.assign(new Error('Separate test session required'),{code:'INVALID_SESSION'});
  const state=previous?structuredClone(previous):{version:2,architecture:'simple_v1',issues:[],issue:null,history:[],actions:[],pendingKey:null};
  state.issue=state.issues.find(i=>i.id===state.issue?.id)||null;
  return state;
}
export function safetyContext(message,state) {
  const detected=detectHazard(message),prior=state?.safety;
  const safety=detected.hazard!=='none'?{...detected,source:message}
    :prior && !explicitHazardDenial(message,prior.hazard)?prior:null;
  return safety?{...safety,notice:safetyNotice(safety.hazard)}:null;
}
const brief=i=>({ref:i.id,equipment:i.equipment,defect:i.defect,location:i.location,count:i.count,since:i.since,extent:i.extent,details:i.details,cause:i.cause,fieldFacts:i.fieldFacts});
function stored(issue) {
  const receipt=issue?.preparation?.receipt;
  return {exists:Boolean(receipt),current:Boolean(receipt && receipt.contentHash===contentHash(issue) && !receipt.conflictFields?.length),receiptId:receipt?.operationId || null,scope:'this_device_test_app',transmitted:false};
}
export function simpleContext(state) {
  const {history}=modelContext(state),refs=new Map();
  if(state.issue)refs.set('active',state.issue);
  state.issues.filter(i=>i.id!==state.issue?.id).forEach((i,n)=>refs.set(`other${n+1}`,i));
  const issueContexts=[...refs].map(([ref,i])=>{const policy=draftActionState(i);return {...brief(i),ref,draft:stored(i),draftAction:{...policy,status:policy.status==='portal_received'?'local_saved':policy.status}};});
  return {history,refs,context:{issues:issueContexts,activeRef:state.issue?'active':null,
    pendingQuestion:state.pendingKey || null,topic:state.conversationTopic || null,safety:state.safety || null,
    capabilities:{localDraft:true,requiresCustomerClick:true,scope:'MORA test app on this device; Alexander portal not connected',externalDelivery:false,paidOrders:false,repairs:false,bookings:false,futureContact:false,personalRecords:false,imageAnalysis:false,localPhotos:true,navigation:['docs','service','profile','portfolio']},effectsExecutedThisTurn:[]}};
}

/** Project on a clone. No facts, offers or history are committed before acceptance. */
export function projectDecision(previous,message,plan) {
  const state=hydrateSimple(previous),{refs}=simpleContext(state),spans=[];
  const seen=new Set();
  for(const update of plan.updates) {
    if(seen.has(update.ref))throw contract('Each issue needs one distinct update');seen.add(update.ref);
    if(!message.includes(update.quote))throw contract('Fact source must be an exact current customer quote');
    if(plan.updates.length>1){
      const start=message.indexOf(update.quote),end=start+update.quote.length;
      if(spans.some(s=>start<s.end && end>s.start))throw contract('Different issues need separate non-overlapping source spans');
      spans.push({start,end});
    }
    for(const item of [...(update.unknown || []),...(update.uncertain || [])])if(!update.quote.includes(item.quote))throw contract('Unknown/uncertain fact needs its own source span');
    let issue=refs.get(update.ref);
    if(!issue){
      if(!/^new[1-4]$/.test(update.ref))throw contract('Unknown issue reference');
      if(state.issues.length>=8)throw Object.assign(new Error('Issue capacity'),{code:'ISSUE_LIMIT'});
      issue=createIssue(update.quote,emptyUnderstanding({...update,description:update.quote}));state.issues.push(issue);refs.set(update.ref,issue);
    }
    const patch=emptyUnderstanding({...update,description:issue.description,sourceQuote:update.quote,
      hazard:update.risk || 'none',unknownFields:(update.unknown || []).map(x=>x.field),uncertainAnswers:update.uncertain || []});
    if(patch.hazard!=='none' && patch.urgency==='normal')patch.urgency=patch.hazard==='water'?'high':'emergency';
    applyPatch(issue,patch,update.quote,state.pendingKey,true);
  }
  const focus=plan.ask?.ref || plan.focus || (plan.updates[0]?.ref) || (state.issue?'active':null);
  if(plan.ask && state.issues.length>1 && !plan.ask.ref && !plan.focus)throw contract('A question about several issues needs its explicit target ref');
  if(focus && !refs.has(focus))throw contract('Unknown conversation focus');
  state.issue=focus?refs.get(focus):null;
  state.safety=safetyContext(message,state);
  if(state.safety)delete state.safety.notice;
  state.pendingKey=state.issue?plan.ask?.field || null:null;
  if(state.issue){state.issue.pendingKey=state.pendingKey;state.issue.clarification=plan.ask?plan.reply:null;}
  state.conversationTopic=plan.intent;
  state.actions=[];
  for(const proposal of plan.actions){
    if(proposal.kind==='prepare_draft'){
      const policy=draftActionState(state.issue);
      if(!policy.canOffer || plan.ask || state.safety)throw contract('Preparation proposal unavailable for this state');
      state.actions.push(report(true,policy.operation==='update'));
    }else if(proposal.kind==='attachment'){
      if(!state.issue || state.safety || state.issue.attachments.length>=6)throw contract('Local photo action unavailable');
      state.actions.push(photo());
    }else {
      if(!proposal.target)throw contract('Navigation target required');
      const labels={docs:'Dokumentenansicht öffnen',service:'Lokale Entwürfe öffnen',profile:'Profilansicht öffnen',portfolio:'Immobilienübersicht öffnen'};
      state.actions.push(action(`view-${proposal.target}`,labels[proposal.target],'navigate',{target:proposal.target}));
    }
  }
  if(new Set(state.actions.map(a=>a.id)).size!==state.actions.length)throw contract('Duplicate action proposal');
  state.actions=validateActions(state.actions,state);
  return state;
}
export function verificationData(before,after,message,plan) {
  const input=simpleContext(before),output=simpleContext(after);
  return {customerMessage:message,history:input.history,priorFacts:input.context.issues,proposedUpdates:plan.updates,
    proposedReply:plan.reply,projectedFacts:output.context.issues,safety:after.safety,
    capabilities:output.context.capabilities,proposedActions:plan.actions,effectsExecutedThisTurn:[]};
}
export function commitDecision(state,message,plan) {
  if(state.issue && state.actions.some(a=>a.type==='handover'))rememberPreparationOffer(state);
  state.history.push({role:'user',content:message},{role:'assistant',content:plan.reply});state.history=state.history.slice(-24);
  return {reply:plan.reply,state,understanding:'model',responseMode:'model'};
}

/** A ticket authorizes a write attempt; it never proves that a write happened. */
export function beginPreparation(state) {
  const issue=state.issue,policy=draftActionState(issue);
  if(!issue || state.safety || (!policy.canOffer && !policy.showControl))throw invalid('Preparation not available');
  if(state.pendingPreparation?.issueId===issue.id && state.pendingPreparation.revision===issue.revision)return state.pendingPreparation;
  const hash=contentHash(issue),key=createHash('sha256').update(`${issue.id}:${issue.revision}:${hash}`).digest('hex');
  // Stable for the same signed content, even if two requests begin concurrently.
  const operationId=`${key.slice(0,8)}-${key.slice(8,12)}-5${key.slice(13,16)}-a${key.slice(17,20)}-${key.slice(20,32)}`;
  const operation={operationId,issueId:issue.id,draftId:issue.id,revision:issue.revision,contentHash:hash,scope:'this_device_test_app'};
  state.pendingPreparation=operation;
  return operation;
}
export function acceptReceipt(state,receipt) {
  const issue=state.issues.find(i=>i.id===receipt.issueId),previous=issue?.preparation?.receipt;
  if(previous?.operationId===receipt.operationId && receipt.status==='portal_received' && previous.contentHash===receipt.contentHash)return {reply:'Der lokale Entwurf ist bereits bestätigt. Er wurde nicht an MORADA gesendet.',state,understanding:'receipt',responseMode:'receipt'};
  const ticket=state.pendingPreparation;
  if(!issue || !ticket || ['operationId','issueId','draftId','revision','contentHash'].some(k=>ticket[k]!==receipt[k]) || issue.revision!==receipt.revision || contentHash(issue)!==receipt.contentHash)throw invalid('Missing or stale write ticket');
  delete state.pendingPreparation;
  if(receipt.status==='error'){
    if(!previous)issue.preparation={status:'error',revision:issue.revision};
    issue.lastPreparationError={operationId:receipt.operationId,at:new Date().toISOString()};
    return {reply:'Der lokale Entwurf konnte nicht bestätigt werden. Ihre Chatangaben bleiben erhalten.',state,understanding:'receipt',responseMode:'receipt'};
  }
  const {status,...proof}=receipt;void status;
  issue.preparation={status:'portal_received',revision:issue.revision,content:issueContent(issue),source:'client_write_readback',receipt:{...proof,at:new Date().toISOString()}};
  delete issue.lastPreparationError;state.actions=state.actions.filter(a=>a.type!=='handover');
  if(state.issue?.id===issue.id)state.issue=issue;
  const conflicts=receipt.conflictFields?.length;
  return {reply:conflicts?'Der Entwurf ist auf diesem Gerät gespeichert. Eigene Formularänderungen weichen von einzelnen Chatangaben ab. Es wurde nichts an MORADA gesendet.':previous?'Der vorhandene Entwurf wurde auf diesem Gerät aktualisiert. Er wurde nicht an MORADA gesendet.':'Der Entwurf wurde auf diesem Gerät gespeichert. Er wurde nicht an MORADA gesendet.',state,understanding:'receipt',responseMode:'receipt'};
}
export function operationalTurn(input,previous) {
  const state=hydrateSimple(previous);
  if(input.draftReceipt)return acceptReceipt(state,input.draftReceipt);
  if(input.actionId==='new-request')return {reply:'Was möchten Sie besprechen?',state:hydrateSimple(null),understanding:'control',responseMode:'control'};
  if(input.actionId==='prepare-request')return {reply:'Die lokale Speicherung wird vorbereitet.',state,operation:beginPreparation(state),understanding:'control',responseMode:'control'};
  if(input.actionId?.startsWith('switch-')){
    const issue=state.issues.find(i=>`switch-${i.id}`===input.actionId);if(!issue)throw invalid('Unknown issue');
    state.issue=issue;state.pendingKey=issue.pendingKey || null;state.actions=[];
    return {reply:`Sie besprechen jetzt ${issue.shortLabel || 'dieses Anliegen'}.`,state,understanding:'control',responseMode:'control'};
  }
  if(input.actionId)throw invalid('Unknown server action');
  if(input.attachments && state.issue){
    if(JSON.stringify(state.issue.attachments)!==JSON.stringify(input.attachments))state.issue.revision++;
    state.issue.attachments=structuredClone(input.attachments);refresh(state.issue);
    if(!input.message)return {reply:'Die Fotoangaben sind diesem Anliegen lokal zugeordnet. Eine Bildanalyse oder Übermittlung erfolgt damit nicht.',state,understanding:'control',responseMode:'control'};
  }
  return {state};
}
