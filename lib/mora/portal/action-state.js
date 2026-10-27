import {contentHash} from '../simple/state.js';
import {portalIssueReadiness} from '../../../assets/mora-portal-map.js';

/** Native portal authority, shared by model context, validation and UI payloads.
 * A visible control, an open form and a durable receipt are distinct facts. */
export function portalActionState(state,navigation=[],caseAccess=true) {
  const i=state.issue,ready=portalIssueReadiness(i).ready;
  const receipt=i?.preparation?.receipt;
  const current=Boolean(receipt&&receipt.contentHash===contentHash(i));
  const open=Boolean(i&&state.portalDraftOpen?.issueId===i.id&&state.portalDraftOpen?.revision===i.revision&&state.portalDraftOpen?.status==='prepared');
  const error=Boolean(i&&state.portalDraftOpen?.issueId===i.id&&state.portalDraftOpen?.status==='error');
  const blocked=Boolean(!caseAccess||state.safety||state.portalPending?.length||state.conversationTopic!=='issue');
  const save=ready&&!current&&!open&&!blocked;
  const operation=receipt?'update':'create';
  const offered=Boolean(i?.draftOfferShown&&operation==='create');
  // Revision is only used for update offers. Any additional create facts leave
  // the existing create button available, without another verbal sales pitch.
  const updateOffered=Boolean(i?.draftOffer?.operation==='update'&&i.draftOffer?.revision===i.revision);
  const controls={save:save?{operation,issueId:i.id}:null,
    prepared:open?{issueId:i.id,saved:false}:null,
    review:ready&&!blocked?{issueId:i.id}:null,
    stored:current&&state.conversationTopic==='issue'?{id:i.id,scope:'this_device',transmitted:false}:null,
    navigation:state.pendingKey||save||state.safety?[]:navigation};
  const phase=state.safety?'safety':state.portalPending?.length?'unanswered':state.conversationTopic!=='issue'?'other_topic':!caseAccess?'unavailable':!ready?'needs_information':error?'preparation_failed':open?'form_open':current?'saved':receipt?'changes_pending':offered?'preparation_offered':'ready';
  return {phase,controls,offerInReply:Boolean(save&&(!offered&&!updateOffered||error)),
    externalDelivery:false,hasStoredDraft:Boolean(receipt),formSaved:current,savedFactsMatch:current&&!receipt?.conflictFields?.length};
}

export const portalControls=(state,navigation=[],caseAccess=true)=>portalActionState(state,navigation,caseAccess).controls;
