import { action, select, report, photo, additional, continueIssue } from './actions.js';
import { draftActionState, issueContent } from '../../assets/mora-data.js';
import { createIssue, applyPatch } from './issue-state.js';
import { portalCapabilities } from '../portal/adapter.js';

const labels={docs:'Dokumentenbereich öffnen',service:'Anliegenentwürfe öffnen',profile:'Profil öffnen',portfolio:'Portfolio öffnen'};

/** Suggestions are data, never executable tools. The server owns targets and labels
 * for real actions; only clarification choices may use model-written labels.
 */
export function dialogueActions(data,state) {
  const actions=[];
  const issue=state.issue;
  const policy=draftActionState(issue);
  const canPrepare=policy.canOffer && data.dialogue.stage!=='clarify';
  for (const button of data.dialogue.buttons) {
    let candidate;
    if (button.kind==='select' && issue && state.pendingKey && button.field===state.pendingKey && button.value) {
      candidate=select(`answer-${button.field}-model-${actions.length}`,button.label,button.field,button.value);
    } else if (button.kind==='prepare_draft' && canPrepare) candidate=report(true,policy.operation==='update');
    else if (button.kind==='attachment' && issue && issue.hazard==='none' && issue.attachments.length<6) candidate=photo();
    else if (button.kind==='add_details' && issue) candidate=additional();
    else if (button.kind==='continue' && issue && !['issue','contact'].includes(data.intent)) candidate=continueIssue();
    else if (button.kind==='navigate' && portalCapabilities.navigation.includes(button.target)) {
      candidate=action(`view-${button.target}`,labels[button.target],'navigate',{target:button.target});
    }
    if (candidate && !actions.some(item => item.id===candidate.id || (item.type==='select' && item.value===candidate.value))) actions.push(candidate);
  }
  // The model chooses useful suggestions within the shared action policy.
  // A contact classification alone never adds an action.
  return actions.slice(0,4);
}

/** Keep machine effects separate from wording. A claimed completed transmission
 * is invalid when no real submission capability exists; never replace it with a
 * simulated success or a canned model answer.
 */
// Preview uses the same fact reducer as accepted turns, so validation sees new
// customer facts without treating a thank-you as another preparation request.
export function projectedDialogueIssue(data,state,message='') {
  const patches=[data,...(data.additionalIssues || [])];
  const index=data.dialogue.forIssueIndex || 0;
  const patch=patches[index] || data;
  const targetId=data.dialogue.forIssueId || patch.targetIssueId;
  const prior=targetId ? state?.issues?.find(issue=>issue.id===targetId) : index || data.newIssue && !data.correction ? null : state?.issue;
  const issue=Object.assign(createIssue(message,patch),structuredClone(prior || {}));
  const targetedUpdate=data.intent==='general' && data.targetIssueId && ['equipment','location','since','extent','count','details','defect'].some(key=>data[key]!=null);
  const contactHasIssue=data.intent==='contact' && (state?.issue || data.description || data.equipment || data.defect || data.category || data.additionalIssues?.length);
  if (data.intent!=='issue' && !targetedUpdate && !contactHasIssue) return prior || state?.issue || null;
  applyPatch(issue,structuredClone(patch),patch.sourceQuote || message || patch.description || '',state?.pendingKey,true);
  return issue;
}

/** Reword only when the incoming context describes a different draft situation.
 * Unchanged acknowledgements and unprepared followups need no extra inference.
 */
export function requiresVerifiedWording(data,state,message='') {
  if(!data.dialogue)return false;
  const after=projectedDialogueIssue(data,state,message);
  if(!after)return false;
  const before=state?.issues?.find(issue=>issue.id===after.id) || (state?.issue?.id===after.id?state.issue:null);
  return !before || state?.issue?.id!==after.id || before.preparation?.status==='portal_received' && issueContent(before)!==issueContent(after);
}

export function validatedDialogueReply(data, state = null, {applied=false,message='',checkActionState=true,checkWording=true}={}) {
  const reply=data.dialogue.reply.replaceAll('ß','ss');
  const issue=applied ? state?.issue : projectedDialogueIssue(data,state,message);
  if (checkActionState && data.dialogue.buttons?.some(button=>button.kind==='prepare_draft')) {
    const policy=draftActionState(issue);
    if(data.dialogue.stage==='clarify' || !policy.canOffer) throw Object.assign(new Error('Preparation proposal conflicts with action state'),{
      validation:data.dialogue.stage==='clarify'?'conflicting_next_steps':'draft_action_unavailable',validationField:'dialogue.buttons'});
  }
  if(!checkWording)return reply;
  const policy=draftActionState(issue);
  if(!policy.draftExists && /\b(?:zum|dem|im|am|in den)\s+bestehenden?\s+(?:Service)?entwurf\b/iu.test(reply))throw Object.assign(new Error('No existing draft for this issue'),{validation:'unconfirmed_draft_claim',validationField:'dialogue.reply'});
  const draftOffer=/\b(?:möchten|wollen|soll|kann)\b[^.!?\n]{0,100}\b(?:(?:Anliegen)?entwurf|Anliegen|Meldung|Wartungsantrag|Auftrag)\b[^.!?\n]{0,80}\bvorbereiten\b/i.test(reply);
  if ((data.intent==='issue' || state?.issue) && draftOffer && !data.dialogue.buttons?.some(button=>button.kind==='prepare_draft')) {
    throw Object.assign(new Error('Draft offer without an action'),{validation:'missing_draft_action',validationField:'dialogue.buttons'});
  }
  const prematureUpdate=/\b(?:ich habe|wir haben)\b[^.!?\n]{0,100}\bEntwurf\b[^.!?\n]{0,100}\b(?:aktualisiert|angepasst|korrigiert|geändert)\b|\bEntwurf\b[^.!?\n]{0,80}\b(?:wurde|ist)\b[^.!?\n]{0,40}\b(?:aktualisiert|angepasst|korrigiert|geändert)\b/i;
  const currentDraft=draftActionState(issue).chatFactsInDraft;
  if (prematureUpdate.test(reply) && !currentDraft) throw Object.assign(new Error('Draft not yet updated'),{validation:'unconfirmed_draft_update',validationField:'dialogue.reply'});
  const currentDraftClaim=/\b(?:Entwurf|Serviceformular)\b[^.!?\n]{0,80}\b(?:ist|sei|bleibt)\b[^.!?\n]{0,40}\b(?:aktuell|fertig|auf dem neuesten Stand)\b/i;
  if(currentDraftClaim.test(reply) && !currentDraft)throw Object.assign(new Error('Unconfirmed current draft'),{validation:'unconfirmed_draft_claim',validationField:'dialogue.reply'});
  const unconfirmedDraft=/\b(?:ich habe|wir haben|habe ich|haben wir)\b[^.!?\n]{0,100}\b(?:Entwurf|Anliegen|Serviceformular|Formular)\b[^.!?\n]{0,70}\b(?:vorbereitet|erstellt|gespeichert|übernommen)\b|\b(?:Entwurf|Anliegen|Serviceformular|Formular)\b[^.!?\n]{0,70}\b(?:wurde|ist)\b[^.!?\n]{0,40}\b(?:vorbereitet|erstellt|gespeichert)\b/i;
  if (unconfirmedDraft.test(reply) && !currentDraft) throw Object.assign(new Error('Unconfirmed draft claim'),{validation:'unconfirmed_draft_claim',validationField:'dialogue.reply'});
  // Navigation to a prepared section is not evidence of personal records there.
  // Reject obvious ungrounded location claims; do not manufacture a replacement.
  const personalDocumentClaim=/\b(?:Sie finden|finden Sie) (?:ihn|sie|es|diesen|diese|Ihren?|Ihre(?:n)?)\b|\b(?:Ihr(?:en|e)?|Der|Die|Den|Dieser|Diese) (?:Mietvertrag|Vertrag|Dokumente|Unterlagen|Abschriften|Abrechnung|Nebenkostenabrechnung)\b[^.!?\n]{0,100}\b(?:finden|liegt|liegen|steht|befindet|hinterlegt|verfügbar)\b/i;
  // Scope a denial to its own clause. 'I cannot ... but you can ...' must not
  // exempt the second, affirmative claim from the capability check.
  const denial=/\b(?:nicht|nichts|kein|keine|keinen)\b/i;
  const clauses=reply.split(/[.!?;\n]/).flatMap(sentence=>denial.test(sentence)
    ? sentence.split(/\b(?:aber|jedoch|trotzdem|allerdings|sondern)\b/i) : [sentence]);
  const unsupportedDocument=clauses.some(clause=>{
    if (denial.test(clause)) return false;
    const portalRead=/\b(?:Portal|Dokumente(?:nbereich)?|Docs|Service(?:bereich)?|dort)\b/i.test(clause) &&
      /\b(?:Ihre(?:n)?|Ihren?|persönliche(?:n)?|diese(?:n)?|Mietvertr(?:ag|äge|aeg?e)|Vertr(?:ag|äge)|Abrechnung(?:en)?|Nebenkostenabrechnung(?:en)?|Unterlagen)\b/i.test(clause) &&
      /\b(?:einsehen|nachsehen|nachschauen|abrufen|finden|herunterladen|zugreifen|prüfen|hinterlegt|liegt|liegen|verfügbar)\b/i.test(clause);
    const wrongSection=/\bDokumente(?:nbereich)?\s+(?:im|unter|über|in|aus)\s+(?:dem\s+)?Service(?:bereich)?\b|\bService(?:bereich)?\s+(?:unter|mit|bei|für|im|in)\s+(?:den?\s+)?Dokumente(?:nbereich)?\b/i.test(clause);
    return portalRead || wrongSection || (['documents','knowledge'].includes(data.intent) && personalDocumentClaim.test(clause));
  });
  if (!portalCapabilities.documents && unsupportedDocument) {
    throw Object.assign(new Error('Unsupported document claim'),{validation:'unsupported_document_claim',validationField:'dialogue.reply'});
  }
  // A truthful access limitation must not be followed by an invented alternative
  // inside another portal section. This is a capability check, not a dialogue rule.
  const unsupportedRecordLookup=clauses.some(clause=>!denial.test(clause) &&
    /\b(?:Portal|Profil|Portfolio|Service(?:bereich)?|Dokumente(?:nbereich)?|dort)\b/i.test(clause) &&
    /\b(?:prüfen|nachsehen|nachschauen|finden|einsehen|abrufen|herunterladen)\b/i.test(clause) &&
    (/\b(?:Termin\w*|Besichtigung\w*|Einladung\w*|Bearbeitungsstand|Handwerkerbesuch|Status)\b/i.test(clause) ||
      (['appointments','status'].includes(data.intent) && /\b(?:Details|Angaben|Informationen|Infos|dort)\b/i.test(clause))));
  if (unsupportedRecordLookup && !portalCapabilities.appointments && !portalCapabilities.requests) {
    throw Object.assign(new Error('Unsupported personal-record lookup'),{validation:'unsupported_record_claim',validationField:'dialogue.reply'});
  }
  const unsupportedOwnerLookup=clauses.some(clause=>!denial.test(clause) &&
    /\b(?:Portal|Portfolio|Profil|Service(?:bereich)?|dort)\b/i.test(clause) &&
    /\b(?:einsehen|nachsehen|abrufen|finden|nachschauen|herunterladen)\b/i.test(clause) &&
    /\b(?:Ihre(?:n|m|r)?|Ihren?|persönliche(?:n)?|aktuelle(?:n)?)\b/i.test(clause) &&
    /\b(?:Liegenschaft\w*|Mieter\w*|Mietverhältnis\w*|Unterhaltsarbeit\w*|Ertrag\w*|Erträge|Finanz\w*|Quartalsbericht\w*)\b/i.test(clause));
  if (unsupportedOwnerLookup) {
    throw Object.assign(new Error('Unsupported owner-record lookup'),{validation:'unsupported_record_claim',validationField:'dialogue.reply'});
  }
  if (clauses.some(clause=>!denial.test(clause) && /\b(?:ich|wir)\s+(?:habe|haben|werde|werden)\b[^.!?\n]{0,150}\b(?:gebucht|reserviert|bestellt|beauftragt|terminiert|buchen|reservieren|bestellen|beauftragen)\b/i.test(clause))) {
    throw Object.assign(new Error('Unsupported booking or paid order'),{validation:'unsupported_booking_claim',validationField:'dialogue.reply'});
  }
  // In a service workflow, an affirmative instruction to confirm shipment is
  // already a capability claim, even without a future/passive verb. Split comma
  // clauses so an unrelated 'keine Sorge' cannot excuse a sending instruction.
  const transactionContext=['issue','contact','status'].includes(data.intent) || /Serviceformular|Anliegenentwurf|Portal/i.test(reply);
  const affirmativeDelivery=transactionContext && clauses.flatMap(clause=>clause.split(/,\s*/)).some(clause=>!denial.test(clause) && /(?:Versand|Übermittlung|Einreichung)|\b(?:versend\w*|gesend\w*|absend\w*|abschick\w*|weiterleit\w*)/iu.test(clause));
  if (!portalCapabilities.submitRequest && affirmativeDelivery) throw Object.assign(new Error('Unsupported sending instruction'),{validation:'unsupported_delivery_claim',validationField:'dialogue.reply'});
  const futureTransmission=clauses.some(clause=>!denial.test(clause) && (/(?:Versand|Übermittlung|Einreichung)[^.!?\n]{0,100}\b(?:erfolgt|startet|beginnt|wird ausgelöst|ist möglich)\b/i.test(clause) || /\b(?:wird|werden|kann|können)\b[^.!?\n]{0,180}(?:übermittelt|versendet|gesendet|eingereicht|weitergeleitet)\b/i.test(clause)));
  if (!portalCapabilities.submitRequest && futureTransmission) throw Object.assign(new Error('Unsupported future delivery claim'),{validation:'unsupported_delivery_claim',validationField:'dialogue.reply'});
  const claims=clauses.flatMap(clause=>clause.match(/\b(?:ich habe|wir haben)\b[^.!?\n]{0,180}(?:versendet|gesendet|verschickt|weitergeleitet|übermittelt|eingereicht|an MORADA gemeldet)\b|\b(?:wurde|ist)\b[^.!?\n]{0,80}\b(?:erfolgreich übermittelt|erfolgreich versendet)\b|[^.!?\n]{0,180}\b(?:absenden|abschicken|versenden|verschicken|senden|übermitteln|weiterleiten|einreichen)\b[^.!?\n]{0,100}/gi) || []);
  if (!portalCapabilities.submitRequest && claims.some(claim=>! /\b(?:nicht|kein|keine)\b/i.test(claim))) {
    throw Object.assign(new Error('Unsupported delivery claim'),{code:'MODEL_UNAVAILABLE',validation:'unsupported_delivery_claim',availability:{provider:'gateway',model:process.env.AI_GATEWAY_MODEL || null,status:null,reason:'invalid_model_output'}});
  }
  return reply;
}
