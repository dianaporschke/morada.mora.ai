import { categoryLabels, emptyUnderstanding, understandingSchema } from './schema.js';
import { detectHazard, safetyNotice, explicitHazardDenial } from './safety.js';
import { guidedUnderstanding } from './guided.js';
import { equipmentLabels, equipmentCategories, isSpecificEquipment } from './equipment.js';
import { action, select, report, photo, additional, continueIssue, validateActions, rememberPreparationOffer } from './actions.js';
import { knowledgeAnswers } from './knowledge.js';
import { dialogueActions, validatedDialogueReply } from './dialogue.js';

import { canonicalEquipment, preparationState, issueContent } from '../../assets/mora-data.js';

import { createIssue, applyPatch, refresh, buildSummary } from './issue-state.js';
export { buildSummary } from './issue-state.js';

const MAX_ISSUES = 8;
const rank = { normal:0, high:1, emergency:2 };
function hydrate(previous) {
  const state = previous ? structuredClone(previous) : { version:2, issue:null, history:[], actions:[], pendingKey:null };
  state.revision = 3;
  state.issues ||= state.issue ? [state.issue] : [];
  for (const issue of state.issues) {
    // Upgrade signed sessions from Phase 1 without throwing away existing customer data.
    if (!issue.equipment && !(issue.unknownFields || []).includes('equipment') && issue.fieldFacts?.equipment?.status!=='corrected') issue.equipment = guidedUnderstanding(issue.description || '', null).equipment || 'unknown';
    if (!(issue.unknownFields || []).includes('equipment') && !(issue.fieldFacts?.equipment?.status==='corrected' && issue.equipment==null)) issue.equipment=canonicalEquipment(issue.equipment,issue.description || '');
    issue.revision ||= 1; issue.fieldFacts ||= {};
    issue.attempts ||= {}; issue.corrections ||= []; issue.count ??= null; issue.defect ??= null;
    issue.unknownFields ||= [];
    issue.pendingKey ??= issue.id === state.issue?.id ? state.pendingKey : null;
    refresh(issue);
  }
  if (state.issue) state.issue = state.issues.find(issue => issue.id === state.issue.id) || null;
  return state;
}
function activate(state, issue) {
  if (state.issue) state.issue.pendingKey = state.pendingKey;
  state.issue = issue; state.pendingKey = issue.pendingKey || null;
}
function addIssue(state, message, data) {
  if (state.issues.length >= MAX_ISSUES) throw Object.assign(new Error('Issue capacity reached'), { code:'ISSUE_LIMIT' });
  const issue = createIssue(message, data); state.issues.push(issue); return issue;
}

function scopeQuestion(issue) {
  const presets = {
    socket:['Ist nur eine Steckdose betroffen oder funktionieren mehrere nicht?', [['one','Nur eine','Eine Steckdose'], ['many','Mehrere','Mehrere Steckdosen'], ['unknown','Weiss ich nicht']]],
    light:['Ist nur diese Lampe betroffen oder funktionieren mehrere Leuchten nicht?', [['one','Nur diese Lampe'], ['many','Mehrere Leuchten'], ['unknown','Weiss ich nicht']]],
    switch:['Ist nur ein Schalter betroffen oder sind es mehrere?', [['one','Nur ein Schalter'], ['many','Mehrere Schalter'], ['unknown','Weiss ich nicht']]],
    heater:['Betrifft es einen einzelnen Heizkörper oder mehrere?', [['one','Nur ein Heizkörper'], ['all','Alle Heizkörper'], ['building','Ganzes Gebäude']]],
    key:['Kommen Sie aktuell noch in Ihre Wohnung?', [['yes','Ja, ich komme hinein'], ['no','Nein, ich bin ausgesperrt'], ['unknown','Weiss ich nicht']]],
    power:['Ist nur ein Raum betroffen oder die ganze Wohnung?', [['room','Ein Raum'], ['flat','Die ganze Wohnung'], ['unknown','Weiss ich nicht']]],
  };
  const preset = presets[issue.equipment];
  if (preset) return { key:'extent', text:preset[0], choices:preset[1] };
  if (issue.category === 'water') return { key:'extent', text:'Tritt aktuell noch Wasser aus?', choices:[['yes','Ja, es tritt noch Wasser aus'], ['no','Nein, aktuell nicht'], ['unknown','Weiss ich nicht']] };
  return null;
}
function locationQuestion(issue) {
  if (issue.equipment === 'key') return { key:'location', text:'Welcher Schlüssel oder Zugang ist betroffen?', choices:[['flat','Wohnungsschlüssel'],['entrance','Hauseingang'],['other','Anderer Schlüssel']] };
  if (issue.equipment === 'light') return { key:'location', text:'Wo befindet sich die defekte Lampe?', choices:[['flat','In meiner Wohnung'],['common','Treppenhaus / Allgemeinbereich'],['outside','Aussenbereich']] };
  const questions = { socket:'In welchem Raum befinden sich die betroffenen Steckdosen?', heater:'Wo befinden sich die betroffenen Heizkörper?', washer:'Wo steht die Waschmaschine?', dryer:'Wo steht der Trockner?', dishwasher:'Wo steht der Geschirrspüler?' };
  return { key:'location', text:questions[issue.equipment] || 'Wo genau tritt das Problem auf?', choices:[] };
}
function missingQuestion(issue, suggestion = null) {
  if (issue.equipment === 'unknown' && !issue.details && !issue.unknownFields.includes('equipment') && (issue.attempts.equipment || 0) < 2) return { key:'equipment', text:'Was genau fällt Ihnen auf? Können Sie das betroffene Teil oder das Problem kurz beschreiben?', choices:[] };
  // Only collect information that helps this case. All questions can be skipped or handed over.
  const scope = !issue.extent && !issue.count ? scopeQuestion(issue) : null;
  const location = !issue.location ? locationQuestion(issue) : null;
  const since = !issue.since ? { key:'since', text:'Seit wann besteht das Problem?', choices:[] } : null;
  const candidates = issue.equipment === 'socket' || issue.equipment === 'switch' || issue.equipment === 'power'
    ? [scope, location, since]
    : issue.equipment === 'heater' ? [since, scope, location]
    : issue.equipment === 'light' ? [location, since, scope]
    : issue.category === 'water' ? [location, scope, since]
    : issue.category === 'general' ? [location]
    : [location, since];
  const available = candidates.filter(Boolean).filter(question => !issue.unknownFields.includes(question.key) && (issue.attempts[question.key] || 0) < 2);
  return available.find(question => question.key === suggestion) || available[0] || null;
}
function proposedQuestion(issue, data, freeDialogue=false) {
  const key = data?.question;
  // Real-model questions already passed the facts/provenance checks. Keep their
  // own wording and target; legacy question catalogues do not run on this path.
  if (freeDialogue) return key && data.clarification ? {key,text:data.clarification,choices:[]} : null;
  if (!key || issue.unknownFields.includes(key) || (issue.attempts[key] || 0) >= 2) return null;
  if (key === 'equipment' ? (freeDialogue ? isSpecificEquipment(issue.equipment) : issue.equipment !== 'unknown') : (key!=='details' || !freeDialogue) && issue[key] != null) return null;
  if (key === 'extent' && issue.count != null) return null;
  const preset = missingQuestion(issue, key);
  if (preset?.key === key) return {...preset, text:data.clarification || preset.text};
  return data.clarification ? {key, text:data.clarification, choices:[]} : null;
}
function nextReply(state, data = null, prefix = '', modelDriven = false) {
  const issue = state.issue;
  refresh(issue);
  if (state.pendingKey === 'additional') {
    state.actions = issue.urgency === 'emergency' ? [action('emergency-112','Notruf 112','call',{ number:'112', variant:'primary' })] : [];
    return issue.hazard !== 'none' ? 'Bitte ergänzen Sie Angaben erst von einem sicheren Ort aus. Was möchten Sie noch festhalten?' : 'Was möchten Sie noch ergänzen?';
  }
  if (issue.hazard !== 'none' || issue.urgency === 'emergency') {
    state.pendingKey = null; issue.clarification = null;
    state.actions = issue.urgency === 'emergency'
      ? [action('emergency-112','Notruf 112','call',{ number:'112', variant:'primary' }), report(false), additional()]
      : [report(), additional(), photo()];
    return `${safetyNotice(issue.hazard)}\n\n${prefix}Die Angaben sind im Chat aufgenommen. Ein Anliegenentwurf ersetzt keinen Notruf oder direkten Kontakt.`;
  }
  if (!modelDriven && data?.confidence === 'unclear' && data.clarification && issue.answers.length < 4 && !issue.unknownFields.includes(data.question || 'equipment') && (issue.attempts[data.question || 'equipment'] || 0) < 2) {
    const key = data.question || 'equipment';
    state.pendingKey = key; issue.clarification = data.clarification; issue.attempts[key] = (issue.attempts[key] || 0) + 1;
    state.actions = [];
    return `${prefix}${data.clarification}`;
  }
  // In real AI mode the model decides whether a clarification helps. Do not turn
  // question=null into a checklist or replace a rejected proposal with another question.
  const question = modelDriven ? proposedQuestion(issue, data) : missingQuestion(issue, data?.question);
  if (question) {
    state.pendingKey = question.key; issue.clarification = question.text;
    state.actions = question.choices.map(([id, label, value]) => select(`answer-${question.key}-${id}`, label, question.key, value || label));
    return `${prefix}${question.text}`;
  }
  state.pendingKey = null; issue.clarification = null;
  state.actions = [report(), additional()];
  return `${prefix}Die Angaben sind für einen Anliegenentwurf bereit. Möchten Sie sie für MORADA vorbereiten?\n\n${issue.summary}`;
}
function informationReply(data, state) {
  const back = state.issue ? [continueIssue()] : [];
  const navigate = (id,label,target) => action(id,label,'navigate',{ target, variant:'primary' });
  if (data.intent === 'knowledge') {
    state.actions = [];
    return knowledgeAnswers[data.topic] || data.answer || 'Dazu habe ich noch keine verlässliche Erklärung. Sie können mir Ihre konkrete Frage schildern, damit wir sie für MORADA aufnehmen können.';
  }
  if (data.intent === 'documents') {
    state.actions = [navigate('view-documents','Dokumentenbereich öffnen','docs'), ...back];
    return 'Der Dokumentenbereich ist bisher eine Vorschau. Ihr persönlicher Mietvertrag ist noch nicht angebunden. Ihr begonnenes Anliegen bleibt erhalten.';
  }
  if (data.intent === 'status') {
    state.actions = [navigate('view-requests','Anliegenentwürfe öffnen','service'), ...back];
    return 'Im Servicebereich finden Sie Ihre lokalen Anliegenentwürfe. Bestätigte Vorgänge und Bearbeitungsstände sind noch nicht angebunden.';
  }
  if (data.intent === 'appointments') {
    state.actions = [select('appointment-change','Änderungswunsch vorbereiten','message','Ich möchte eine Terminänderung anfragen.'), ...back];
    return 'Ihre echten Termine sind noch nicht angebunden. Ich kann Ihren Änderungswunsch als Anliegenentwurf aufnehmen.';
  }
  if (data.intent === 'contact') {
    state.actions = state.issue ? [report(), ...back] : [select('contact-request','Anfrage vorbereiten','message','Ich möchte MORADA eine Anfrage senden.')];
    return 'Ich kann Ihre Anfrage für MORADA vorbereiten. Ein direkter Versand und bestätigte Kontaktdaten sind in diesem Portal noch nicht hinterlegt.';
  }
  if (data.intent === 'property' || data.intent === 'walkthrough') {
    state.actions = [navigate('view-property','Portfoliobereich öffnen','portfolio'), ...back];
    return 'Im Portfolio sehen Sie die vorbereitete Übersicht. Echte Immobilien und Rundgänge sind noch nicht angebunden.';
  }
  state.actions = [];
  return 'Ich bin für Ihre Fragen und Anliegen rund um Ihre Immobilie da. Sie können einfach frei schreiben.';
}
function finish(state, message, reply, mode, availability = null, {recordHistory=true}={}) {
  if (state.issue) { state.issue.pendingKey = state.pendingKey; refresh(state.issue); }
  state.actions = validateActions(state.actions.filter(item=>item.type!=='handover' || preparationState(state.issue)!=='portal_received'), state);
  if (state.issue && state.actions.some(action=>action.type==='handover')) {
    rememberPreparationOffer(state);
  }
  if(recordHistory) {
    if (message) state.history.push({ role:'user', content:message });
    state.history.push({ role:'assistant', content:reply }); state.history = state.history.slice(-24);
  }
  return { reply, state, understanding:mode, availability };
}

function finishDialogue(state,message,data,interpreted) {
  const issue=state.issue;
  const clarification=data.dialogue.stage==='clarify' && data.intent==='issue' && issue ? proposedQuestion(issue,data,true) : null;
  state.pendingKey=clarification?.key || null;
  if (issue) {
    issue.clarification=clarification?.text || null;
    if (clarification) issue.attempts[clarification.key]=(issue.attempts[clarification.key] || 0)+1;
  }
  state.dialogueVersion=1;
  state.conversationTopic=data.intent==='contact' && issue ? 'issue' : data.intent;
  const reply=validatedDialogueReply(data,state,{applied:true,checkWording:!interpreted.needsWording});
  state.actions=dialogueActions(data,state);
  const result=finish(state,message,reply,interpreted.mode,interpreted.availability);
  return {...result,singleModelReply:!interpreted.recoveredFacts && !interpreted.needsWording,needsWording:Boolean(interpreted.needsWording),dialoguePlan:data,recoveredFacts:Boolean(interpreted.recoveredFacts),modelUsage:interpreted.usage};
}

export async function processTurn(input, previous, understand) {
  const state = hydrate(previous);
  let message = input.message || '';
  if (input.draftReceipt) {
    const receipt=input.draftReceipt;
    const issue=state.issues.find(item=>item.id===receipt.issueId);
    if (!issue || receipt.revision!==issue.revision) throw Object.assign(new Error('Stale draft receipt'),{code:'INVALID_ACTION'});
    issue.preparation={status:receipt.status,revision:receipt.revision,content:issueContent(issue),source:'client_local_storage',at:new Date().toISOString()};
    if(receipt.status==='portal_received') {
      issue.pendingKey=null;issue.clarification=null;
      if(state.issue?.id===issue.id)state.pendingKey=null;
    }
    state.actions=state.actions.filter(item=>item.type!=='handover');
    // Operational receipts belong to structured state, not model dialogue history.
    return finish(state,'',receipt.status==='portal_received' ? 'Der Entwurf ist im Servicebereich auf diesem Gerät verfügbar. Er wurde noch nicht an MORADA gesendet.' : 'Die Vorbereitung konnte nicht gespeichert werden. Ihre Angaben bleiben im Chat erhalten. Bitte versuchen Sie es erneut.','guided',null,{recordHistory:false});
  }
  // Photo metadata belongs to the previously active issue, before any topic change.
  if (input.attachments && state.issue) { if (JSON.stringify(state.issue.attachments)!==JSON.stringify(input.attachments)) state.issue.revision=(state.issue.revision || 1)+1; state.issue.attachments = input.attachments; refresh(state.issue); }
  // Real-model conversations continue through the model after a validated choice.
  // Old signed conversations retain their existing deterministic adapter.
  if (input.actionId && state.dialogueVersion===1) {
    const selected=state.actions.find(item=>item.id===input.actionId);
    if (selected && ['select','add_details','continue'].includes(selected.type)) {
      message=selected.type==='select' ? selected.value : selected.type==='add_details' ? 'Ich möchte noch etwas zu meinem Anliegen ergänzen.' : 'Ich möchte mit meinem aufgenommenen Anliegen fortfahren.';
      input={...input,actionId:undefined};
    } else if (input.actionId.startsWith('switch-')) {
      const issue=state.issues.find(item=>`switch-${item.id}`===input.actionId);
      if (!issue) throw Object.assign(new Error('Invalid issue target'),{code:'INVALID_ACTION'});
      activate(state,issue); message='Ich möchte dieses aufgenommene Anliegen weiter besprechen.';
      input={...input,actionId:undefined};
    }
  }
  if (input.actionId === 'new-request') {
    state.issue = null; state.pendingKey = null; state.issues = []; state.history = [];
    return finish(state, '', informationReply(emptyUnderstanding({ intent:'greeting' }), state), 'guided');
  }
  if (input.actionId?.startsWith('switch-')) {
    const issue = state.issues.find(item => `switch-${item.id}` === input.actionId);
    if (!issue) throw Object.assign(new Error('Invalid issue target'), { code:'INVALID_ACTION' });
    activate(state, issue); return finish(state, '', nextReply(state), 'guided');
  }
  if (input.actionId) {
    const selected = state.actions.find(item => item.id === input.actionId);
    if (!selected) throw Object.assign(new Error('Stale or unknown action'), { code:'INVALID_ACTION' });
    if (selected.type === 'select' && selected.field === 'message') {
      // These are explicit new requests, even if a different issue is still open.
      const data = emptyUnderstanding({ intent:'issue', category:'general', description:selected.value, equipment:'unknown', details:selected.value, confidence:'clear', newIssue:true });
      const issue = addIssue(state, selected.value, data); activate(state, issue); applyPatch(issue, data, selected.value, null);
      return finish(state, selected.value, nextReply(state), 'guided');
    }
    if (selected.type === 'select' && state.issue) {
      const data = guidedUnderstanding(selected.value, state);
      data[selected.field] = selected.value;
      applyPatch(state.issue, data, selected.value, state.pendingKey);
      state.pendingKey = null;
      return finish(state, selected.value, nextReply(state), 'guided');
    }
    if (selected.type === 'add_details' && state.issue) {
      state.pendingKey = 'additional'; return finish(state, '', nextReply(state), 'guided');
    }
    if (selected.type === 'continue' && state.issue) return finish(state, '', nextReply(state), 'guided');
    throw Object.assign(new Error('Action must be handled by portal'), { code:'INVALID_ACTION' });
  }
  if (!message && input.attachments && state.issue) {
    state.actions = [];
    return finish(state, '', input.attachments.length ? 'Die Fotos sind diesem Anliegen lokal hinzugefügt. Sie wurden noch nicht versendet.' : 'Die Fotos wurden aus diesem Anliegen entfernt.', 'guided');
  }
  const danger = detectHazard(message);
  // An unsafe follow-up to an already verified danger must not wait for the
  // provider or depend on its availability. This asks about an intervention,
  // not new damage facts; keep the signed facts and record the actual message.
  const priorDanger=state.issue && (state.issue.hazard!=='none' || state.issue.urgency==='emergency');
  if (priorDanger && danger.hazard==='none' && !explicitHazardDenial(message,state.issue.hazard) &&
      /\b(?:aufschraub\w*|auseinandernehm\w*|aufmach\w*|anfass\w*|berühr\w*|reparier\w*)\b/i.test(message)) {
    return finish(state,message,nextReply(state),'safety');
  }
  // Immediate danger uses local extraction and does not wait for a remote LLM.
  const interpreted = danger.hazard !== 'none' ? { mode:'safety', data:guidedUnderstanding(message, state) } : await understand(message, state);
  const data = understandingSchema.parse(interpreted.data);
  if (danger.hazard !== 'none' && !data.additionalIssues.some(issue => issue.hazard !== 'none')) {
    data.hazard = danger.hazard; data.urgency = danger.urgency; data.intent = 'issue';
  }
  // Model-detected danger also outranks an unrelated information intent.
  for (const patch of [data, ...data.additionalIssues]) {
    if (patch.hazard !== 'none') {
      const minimum = patch.hazard === 'water' ? 'high' : 'emergency';
      if (rank[patch.urgency] < rank[minimum]) patch.urgency = minimum;
    }
  }
  if ([data, ...data.additionalIssues].some(patch => patch.hazard !== 'none' || patch.urgency === 'emergency')) data.intent = 'issue';
  const modelDialogue=['model','recovery'].includes(interpreted.mode) && Boolean(data.dialogue);
  const targetedGeneralUpdate=modelDialogue && data.intent==='general' && data.targetIssueId &&
    ['equipment','location','since','extent','count','details','defect'].some(key=>data[key]!=null);
  if (targetedGeneralUpdate) data.intent='issue';
  const contactHasIssue=data.intent==='contact' && modelDialogue && (state.issue ||
    data.description || data.equipment || data.defect || data.category || data.additionalIssues.length);
  const isIssueTurn=data.intent==='issue' || targetedGeneralUpdate || contactHasIssue;
  if (modelDialogue && !isIssueTurn) {
    if (state.issue && (state.issue.hazard!=='none' || state.issue.urgency==='emergency')) {
      return {...finish(state,message,nextReply(state), 'safety',interpreted.availability),modelUsage:interpreted.usage};
    }
    return finishDialogue(state,message,data,interpreted);
  }
  if (data.intent !== 'issue' && data.intent !== 'general' && !isIssueTurn) {
    return finish(state, message, informationReply(data, state), interpreted.mode, interpreted.availability);
  }
  if (data.targetIssueId) {
    const target = state.issues.find(issue => issue.id === data.targetIssueId);
    if (!target) { state.actions = []; return finish(state, message, 'Welches Ihrer aufgenommenen Anliegen meinen Sie? Sie können es oben im Chat auswählen.', interpreted.mode); }
    activate(state, target);
  }
  const incompatibleEquipment = data.equipment && data.equipment !== 'unknown' && state.issue?.equipment && state.issue.equipment !== 'unknown' && state.issue.equipment !== data.equipment;
  const sameCategory=(equipmentCategories[data.equipment] || data.category)===state.issue?.category;
  const refinement=modelDialogue && sameCategory && (data.targetIssueId===state.issue?.id ||
    (['leak','power'].includes(state.issue?.equipment) && ['equipment','details'].includes(state.pendingKey)));
  if (!state.issue || (!data.correction && (data.newIssue || (!modelDialogue && incompatibleEquipment && !refinement)))) activate(state, addIssue(state, message, data));
  const wasAdditional = state.pendingKey === 'additional';
  const original = state.issue;
  if (explicitHazardDenial(message, original.hazard)) {
    original.corrections.push({ changes:{hazard:{from:original.hazard,to:'none'}}, source:message, at:new Date().toISOString() });
    original.hazard = 'none'; original.urgency = 'normal';
    data.hazard = 'none'; data.urgency = 'normal'; data.correction = true;
  }
  applyPatch(original, data, data.additionalIssues.length ? (data.description || message) : message, state.pendingKey,modelDialogue);
  if (wasAdditional) state.pendingKey = null;
  const created = [];
  for (const patch of data.additionalIssues) {
    const existing=patch.targetIssueId ? state.issues.find(issue=>issue.id===patch.targetIssueId) : null;
    if (patch.targetIssueId && !existing) throw Object.assign(new Error('Unknown issue target'),{code:'INVALID_ACTION'});
    const issue = existing || addIssue(state, patch.description || message, patch);
    applyPatch(issue, patch, patch.description || message, null,modelDialogue); created.push(issue);
  }
  const urgent = [original, ...created].sort((a,b) => rank[b.urgency] - rank[a.urgency])[0];
  if (urgent.id !== state.issue.id) activate(state, urgent);
  let prefix = data.correction ? 'Ich habe die Angaben korrigiert. ' : '';
  if (created.length) prefix = `Ich habe ${created.length + 1} getrennte Anliegen aufgenommen: ${[original,...created].map(issue => issue.shortLabel).join(' und ')}. `;
  // A genuine model response owns wording and dialogue progression. Local rules
  // intervene only for safety, data integrity and authorized portal actions.
  if (modelDialogue && !state.issues.some(issue=>issue.hazard!=='none' || issue.urgency==='emergency')) {
    const requested=data.dialogue.forIssueId ? state.issues.find(issue=>issue.id===data.dialogue.forIssueId) : [original,...created][data.dialogue.forIssueIndex || 0];
    if (requested && requested.id!==state.issue.id) activate(state,requested);
    return finishDialogue(state,message,data,interpreted);
  }
  return {...finish(state, message, nextReply(state, data, prefix, interpreted.mode === 'model'), interpreted.mode, interpreted.availability),modelUsage:interpreted.usage};
}
