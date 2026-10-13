import { action, select, report, photo, additional, continueIssue } from './actions.js';
import { portalCapabilities } from '../portal/adapter.js';

const labels={docs:'Dokumentenbereich öffnen',service:'Anliegenentwürfe öffnen',profile:'Profil öffnen',portfolio:'Portfolio öffnen'};
const navigationIntents={documents:'docs',status:'service',property:'portfolio',walkthrough:'portfolio'};

/** Suggestions are data, never executable tools. The server owns targets and labels
 * for real actions; only clarification choices may use model-written labels.
 */
export function dialogueActions(data,state) {
  const actions=[];
  const issue=state.issue;
  const canPrepare=issue && (data.intent==='contact' || (data.dialogue.stage==='offer_draft' && !issue.draftOfferShown));
  for (const button of data.dialogue.buttons) {
    let candidate;
    if (button.kind==='select' && issue && state.pendingKey && button.field===state.pendingKey && button.value) {
      candidate=select(`answer-${button.field}-model-${actions.length}`,button.label,button.field,button.value);
    } else if (button.kind==='prepare_draft' && canPrepare) candidate=report();
    else if (button.kind==='attachment' && issue && issue.hazard==='none' && issue.attachments.length<6) candidate=photo();
    else if (button.kind==='add_details' && issue) candidate=additional();
    else if (button.kind==='continue' && issue && !['issue','contact'].includes(data.intent)) candidate=continueIssue();
    else if (button.kind==='navigate' && button.target===navigationIntents[data.intent] && portalCapabilities.navigation.includes(button.target)) {
      candidate=action(`view-${button.target}`,labels[button.target],'navigate',{target:button.target});
    }
    if (candidate && !actions.some(item => item.id===candidate.id || (item.type==='select' && item.value===candidate.value))) actions.push(candidate);
  }
  // A customer's explicit handover request must remain possible without a checklist.
  if (canPrepare && !actions.some(item=>item.type==='handover')) actions.unshift(report());
  return actions.slice(0,4);
}

/** Keep machine effects separate from wording. A claimed completed transmission
 * is invalid when no real submission capability exists; never replace it with a
 * simulated success or a canned model answer.
 */
export function validatedDialogueReply(data) {
  const reply=data.dialogue.reply.replaceAll('ß','ss');
  // Navigation to a prepared section is not evidence of personal records there.
  // Reject obvious ungrounded location claims; do not manufacture a replacement.
  const personalDocumentClaim=/\b(?:Sie finden|finden Sie) (?:ihn|sie|es|diesen|diese|Ihren?|Ihre(?:n)?)\b|\b(?:Ihr(?:en|e)?|Der|Die|Den|Dieser|Diese) (?:Mietvertrag|Vertrag|Dokumente|Unterlagen|Abschriften|Abrechnung|Nebenkostenabrechnung)\b[^.!?\n]{0,100}\b(?:finden|liegt|liegen|steht|befindet|hinterlegt|verfügbar)\b/i;
  // Scope a denial to its own clause. 'I cannot ... but you can ...' must not
  // exempt the second, affirmative claim from the capability check.
  const denial=/\b(?:nicht|kein|keine|keinen)\b/i;
  const clauses=reply.split(/[.!?;\n]/).flatMap(sentence=>denial.test(sentence)
    ? sentence.split(/\b(?:aber|jedoch|trotzdem|allerdings|sondern)\b/i) : [sentence]);
  const unsupportedDocument=clauses.some(clause=>{
    if (denial.test(clause)) return false;
    const portalRead=/\b(?:Portal|Dokumente(?:nbereich)?|Docs|Service(?:bereich)?|dort)\b/i.test(clause) &&
      /\b(?:Ihre(?:n)?|Ihren?|persönliche(?:n)?|diese(?:n)?)\b/i.test(clause) &&
      /\b(?:einsehen|nachsehen|abrufen|finden|herunterladen|zugreifen)\b/i.test(clause);
    const wrongSection=/\bDokumente(?:nbereich)?\s+(?:im|unter|über|in|aus)\s+(?:dem\s+)?Service(?:bereich)?\b|\bService(?:bereich)?\s+(?:unter|mit|bei|für|im|in)\s+(?:den?\s+)?Dokumente(?:nbereich)?\b/i.test(clause);
    return portalRead || wrongSection || (['documents','knowledge'].includes(data.intent) && personalDocumentClaim.test(clause));
  });
  if (!portalCapabilities.documents && unsupportedDocument) {
    throw Object.assign(new Error('Unsupported document claim'),{validation:'unsupported_document_claim',validationField:'dialogue.reply'});
  }
  const claims=clauses.flatMap(clause=>clause.match(/\b(?:ich habe|wir haben)\b[^.!?\n]{0,180}(?:versendet|gesendet|verschickt|weitergeleitet|übermittelt|eingereicht|an MORADA gemeldet)\b|\b(?:wurde|ist)\b[^.!?\n]{0,80}\b(?:erfolgreich übermittelt|erfolgreich versendet)\b|[^.!?\n]{0,180}\b(?:absenden|abschicken|versenden|verschicken|senden|übermitteln|weiterleiten|einreichen)\b[^.!?\n]{0,100}/gi) || []);
  if (!portalCapabilities.submitRequest && claims.some(claim=>! /\b(?:nicht|kein|keine)\b/i.test(claim))) {
    throw Object.assign(new Error('Unsupported delivery claim'),{code:'MODEL_UNAVAILABLE',validation:'unsupported_delivery_claim',availability:{provider:'gateway',model:process.env.AI_GATEWAY_MODEL || null,status:null,reason:'invalid_model_output'}});
  }
  return reply;
}
