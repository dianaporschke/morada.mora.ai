import { randomUUID } from 'node:crypto';
import { categoryLabels, emptyUnderstanding, understandingSchema } from './schema.js';
import { detectHazard, safetyNotice, explicitHazardDenial } from './safety.js';
import { guidedUnderstanding } from './guided.js';
import { equipmentLabels, equipmentCategories } from './equipment.js';
import { action, select, report, photo, additional, continueIssue, validateActions } from './actions.js';
import { knowledgeAnswers } from './knowledge.js';

const MAX_ISSUES = 8;
const rank = { normal:0, high:1, emergency:2 };
export function buildSummary(issue) {
  const title = equipmentLabels[issue.equipment] || categoryLabels[issue.category];
  return [title, issue.defect || (!issue.count ? issue.description : null),
    issue.location && `Bereich: ${issue.location}`, issue.count && `Anzahl: ${issue.count}`,
    issue.extent && `Umfang / Situation: ${issue.extent}`, issue.since && `Seit wann: ${issue.since}`,
    issue.details && `Zusatzangaben: ${issue.details}`,
    `Dringlichkeit: ${{ normal:'Normal', high:'Dringend', emergency:'Mögliche akute Gefahr' }[issue.urgency]}`,
    issue.attachments.length && `Fotos: ${issue.attachments.length} (lokal, noch nicht hochgeladen)`,
  ].filter(Boolean).join('\n');
}
function refresh(issue) {
  issue.shortLabel = equipmentLabels[issue.equipment] || categoryLabels[issue.category];
  issue.summary = buildSummary(issue); issue.updatedAt = new Date().toISOString();
}
function createIssue(message, data) {
  return { id:randomUUID(), category:data.category || 'general', equipment:data.equipment || 'unknown',
    subcategory:data.subcategory || null, description:data.description || message, defect:data.defect || null,
    count:null, location:null, since:null, extent:null, details:null, urgency:'normal', hazard:'none',
    attachments:[], answers:[], corrections:[], unknownFields:[], summary:'', pendingKey:null, clarification:null, attempts:{},
    status:'draft', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
}
function hydrate(previous) {
  const state = previous ? structuredClone(previous) : { version:2, issue:null, history:[], actions:[], pendingKey:null };
  state.revision = 3;
  state.issues ||= state.issue ? [state.issue] : [];
  for (const issue of state.issues) {
    // Upgrade signed sessions from Phase 1 without throwing away existing customer data.
    if (!issue.equipment) issue.equipment = guidedUnderstanding(issue.description || '', null).equipment || 'unknown';
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
function applyPatch(issue, data, message, pendingKey) {
  const changed = {};
  issue.unknownFields = [...new Set([...(issue.unknownFields || []), ...(data.unknownFields || [])])];
  for (const key of data.clearFields || []) { if (issue[key] != null) changed[key] = { from:issue[key], to:null }; issue[key] = null; }
  if (data.category && (issue.category === 'general' || data.correction)) issue.category = data.category;
  for (const key of ['equipment','subcategory','defect','location','since','extent','count','details']) {
    if (data[key] == null || (key === 'equipment' && data[key] === 'unknown')) continue;
    const value = key === 'details' && pendingKey === 'additional' && issue.details ? `${issue.details}\n${data.details}`.slice(-6000) : data[key];
    if (issue[key] !== value) changed[key] = { from:issue[key], to:value };
    issue[key] = value;
    issue.unknownFields = issue.unknownFields.filter(field => field !== key && !(key === 'count' && field === 'extent'));
  }
  if (issue.equipment !== 'unknown' && equipmentCategories[issue.equipment]) issue.category = equipmentCategories[issue.equipment];
  // A revised count supersedes old scope, even when a model omits a rewritten extent.
  if (data.count != null && !data.extent) issue.extent = `${data.count} betroffene Einrichtung(en)`;
  if (data.correction && Object.keys(changed).length) issue.corrections.push({ changes:changed, source:message, at:new Date().toISOString() });
  issue.corrections = issue.corrections.slice(-12);
  if (rank[data.urgency] > rank[issue.urgency]) issue.urgency = data.urgency;
  if (data.hazard !== 'none') issue.hazard = data.hazard;
  issue.answers.push({ question:pendingKey || 'description', answer:message });
  issue.answers = issue.answers.slice(-30);
  refresh(issue);
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
function nextReply(state, data = null, prefix = '') {
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
  if (data?.confidence === 'unclear' && data.clarification && issue.answers.length < 4 && !issue.unknownFields.includes(data.question || 'equipment') && (issue.attempts[data.question || 'equipment'] || 0) < 2) {
    const key = data.question || 'equipment';
    state.pendingKey = key; issue.clarification = data.clarification; issue.attempts[key] = (issue.attempts[key] || 0) + 1;
    state.actions = [];
    return `${prefix}${data.clarification}`;
  }
  const question = missingQuestion(issue, data?.question);
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
function finish(state, message, reply, mode, availability = null) {
  if (state.issue) { state.issue.pendingKey = state.pendingKey; refresh(state.issue); }
  state.actions = validateActions(state.actions, state);
  if (message) state.history.push({ role:'user', content:message });
  state.history.push({ role:'assistant', content:reply }); state.history = state.history.slice(-24);
  return { reply, state, understanding:mode, availability };
}

export async function processTurn(input, previous, understand) {
  const state = hydrate(previous);
  let message = input.message || '';
  // Photo metadata belongs to the previously active issue, before any topic change.
  if (input.attachments && state.issue) { state.issue.attachments = input.attachments; refresh(state.issue); }
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
  if (data.intent !== 'issue' && data.intent !== 'general') {
    return finish(state, message, informationReply(data, state), interpreted.mode, interpreted.availability);
  }
  if (data.targetIssueId) {
    const target = state.issues.find(issue => issue.id === data.targetIssueId);
    if (!target) { state.actions = []; return finish(state, message, 'Welches Ihrer aufgenommenen Anliegen meinen Sie? Sie können es oben im Chat auswählen.', interpreted.mode); }
    activate(state, target);
  }
  const incompatibleEquipment = data.equipment && data.equipment !== 'unknown' && state.issue?.equipment && state.issue.equipment !== 'unknown' && state.issue.equipment !== data.equipment;
  if (!state.issue || (!data.correction && (data.newIssue || incompatibleEquipment))) activate(state, addIssue(state, message, data));
  const wasAdditional = state.pendingKey === 'additional';
  const original = state.issue;
  if (explicitHazardDenial(message, original.hazard)) {
    original.corrections.push({ changes:{hazard:{from:original.hazard,to:'none'}}, source:message, at:new Date().toISOString() });
    original.hazard = 'none'; original.urgency = 'normal';
    data.hazard = 'none'; data.urgency = 'normal'; data.correction = true;
  }
  applyPatch(original, data, data.additionalIssues.length ? (data.description || message) : message, state.pendingKey);
  if (wasAdditional) state.pendingKey = null;
  const created = [];
  for (const patch of data.additionalIssues) {
    const issue = addIssue(state, patch.description || message, patch);
    applyPatch(issue, patch, patch.description || message, null); created.push(issue);
  }
  const urgent = [original, ...created].sort((a,b) => rank[b.urgency] - rank[a.urgency])[0];
  if (urgent.id !== state.issue.id) activate(state, urgent);
  let prefix = data.correction ? 'Ich habe die Angaben korrigiert. ' : '';
  if (created.length) prefix = `Ich habe ${created.length + 1} getrennte Anliegen aufgenommen: ${[original,...created].map(issue => issue.shortLabel).join(' und ')}. `;
  return finish(state, message, nextReply(state, data, prefix), interpreted.mode, interpreted.availability);
}
