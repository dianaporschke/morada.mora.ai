import { randomUUID } from 'node:crypto';
import { categoryLabels, understandingSchema } from './schema.js';
import { detectHazard, safetyNotice } from './safety.js';

const action = (id, label, type, extra = {}) => ({ id, label, type, variant: 'secondary', ...extra });
const select = (id, label, field, value = label) => action(id, label, 'select', { field, value });
const report = (primary = true) => action('prepare-request', 'An MORADA melden', 'handover', { variant: primary ? 'primary' : 'secondary' });
const photo = () => action('attach-photo', 'Foto hinzufügen', 'attachment');
const contact = () => action('contact-morada', 'MORADA kontaktieren', 'navigate', { target: 'profile' });
const additional = () => action('add-details', 'Noch etwas ergänzen', 'add_details');
const continueIssue = () => action('continue-issue', 'Mit meinem Anliegen fortfahren', 'continue');

const QUESTIONS = {
  location: {
    text: 'Wo befindet sich das Problem?',
    choices: [['flat', 'In meiner Wohnung'], ['common', 'Treppenhaus / Allgemeinbereich'], ['outside', 'Aussenbereich']],
  },
  since: { text: 'Seit wann besteht das Problem?', choices: [['today', 'Seit heute'], ['yesterday', 'Seit gestern'], ['unknown', 'Weiss ich nicht']] },
  extent: { text: 'Wie gross ist der betroffene Bereich?', choices: [['one', 'Nur an einer Stelle'], ['many', 'An mehreren Stellen'], ['unknown', 'Weiss ich nicht']] },
  details: { text: 'Was genau fällt Ihnen auf? Eine kurze Beschreibung reicht.', choices: [] },
};
const REQUIRED = {
  electricity: ['location', 'since', 'extent'], heating: ['since', 'extent', 'location'],
  water: ['location', 'extent', 'since'], access: ['location', 'extent', 'since'],
  neighbours: ['location', 'since', 'details'], appliances: ['location', 'since'], general: ['details', 'location'],
};

export function buildSummary(issue) {
  return [categoryLabels[issue.category], issue.description,
    issue.location && `Bereich: ${issue.location}`, issue.since && `Seit wann: ${issue.since}`,
    issue.extent && `Umfang / Situation: ${issue.extent}`, issue.details && `Zusatzangaben: ${issue.details}`,
    `Dringlichkeit: ${{ normal: 'Normal', high: 'Dringend', emergency: 'Mögliche akute Gefahr' }[issue.urgency]}`,
    issue.attachments.length && `Fotos: ${issue.attachments.length} (lokal, noch nicht hochgeladen)`,
  ].filter(Boolean).join('\n');
}

function newIssue(message, understanding) {
  return { id: randomUUID(), category: understanding.category || 'general', subcategory: understanding.subcategory || null,
    description: understanding.description || message, location: null, since: null, extent: null, details: null,
    urgency: 'normal', hazard: 'none', attachments: [], answers: [], summary: '',
    status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function questionFor(issue, field) {
  const question = { ...QUESTIONS[field] };
  if (field === 'location' && issue.category === 'electricity') question.text = 'Gerne nehmen wir das auf. Wo befindet sich die defekte Lampe oder der betroffene elektrische Bereich?';
  if (field === 'location' && issue.category === 'access') {
    question.text = 'Welcher Schlüssel oder Zugang ist betroffen?';
    question.choices = [['flat', 'Wohnungsschlüssel'], ['entrance', 'Hauseingang'], ['other', 'Anderer Schlüssel']];
  }
  if (field === 'location' && issue.category === 'neighbours') question.text = 'Woher kommt die Störung? Zum Beispiel aus der Nachbarwohnung oder dem Allgemeinbereich.';
  if (field === 'extent' && issue.category === 'heating') {
    question.text = 'Betrifft es einen einzelnen Heizkörper oder mehrere?';
    question.choices = [['one', 'Nur ein Heizkörper'], ['all', 'Alle Heizkörper'], ['building', 'Ganzes Gebäude']];
  }
  if (field === 'extent' && issue.category === 'electricity') {
    question.text = 'Ist nur diese Lampe betroffen oder funktionieren mehrere Leuchten nicht?';
    question.choices = [['one', 'Nur diese Lampe'], ['many', 'Mehrere Leuchten'], ['unknown', 'Weiss ich nicht']];
  }
  if (field === 'extent' && issue.category === 'water') {
    question.text = 'Tritt aktuell noch Wasser aus?';
    question.choices = [['yes', 'Ja, es tritt noch Wasser aus'], ['no', 'Nein, aktuell nicht'], ['unknown', 'Weiss ich nicht']];
  }
  if (field === 'extent' && issue.category === 'access') {
    question.text = 'Kommen Sie aktuell noch in Ihre Wohnung?';
    question.choices = [['yes', 'Ja, ich komme hinein'], ['no', 'Nein, ich bin ausgesperrt'], ['unknown', 'Weiss ich nicht']];
  }
  return question;
}

function nextReply(state, prefix = '') {
  const issue = state.issue;
  issue.summary = buildSummary(issue);
  issue.updatedAt = new Date().toISOString();
  if (state.pendingKey === 'additional') {
    state.actions = issue.urgency === 'emergency'
      ? [action('emergency-112', 'Notruf 112', 'call', { number:'112', variant:'primary' }), report(false), contact()]
      : [report(), photo()];
    return `${prefix}${issue.urgency === 'emergency' ? 'Bitte ergänzen Sie Angaben erst von einem sicheren Ort aus. ' : ''}Was möchten Sie noch ergänzen?`.trim();
  }
  // Urgent events never wait for qualification before offering a handover.
  if (issue.hazard !== 'none' || issue.urgency === 'emergency') {
    state.pendingKey = null;
    state.actions = [
      ...(issue.urgency === 'emergency' ? [action('emergency-112', 'Notruf 112', 'call', { number: '112', variant: 'primary' })] : []),
      report(issue.urgency !== 'emergency'), additional(), contact(),
      ...(issue.urgency !== 'emergency' ? [photo()] : []),
    ];
    return `${safetyNotice(issue.hazard)}\n\nIch habe das Anliegen als ${categoryLabels[issue.category]} aufgenommen. Über „An MORADA melden“ übernehmen Sie die bisherigen Angaben in einen Entwurf für MORADA.`;
  }
  const field = REQUIRED[issue.category].find(key => !issue[key]);
  if (!field) {
    state.pendingKey = null;
    state.actions = [report(), photo(), additional(), contact()];
    return `${prefix}Danke, ich habe die wichtigsten Angaben. Möchten Sie das Anliegen jetzt für MORADA vorbereiten?\n\n${issue.summary}`;
  }
  state.pendingKey = field;
  const question = questionFor(issue, field);
  state.actions = question.choices.map(([id, label]) => select(`answer-${field}-${id}`, label, field));
  // Customers can hand over at any point, including when they cannot describe a problem.
  state.actions.push(report(false), photo());
  return `${prefix}${question.text}`.trim();
}

function informationReply(intent, state) {
  const back = state.issue ? [continueIssue()] : [];
  const navigate = (id, label, target) => action(id, label, 'navigate', { target, variant: 'primary' });
  if (intent === 'documents') {
    state.actions = [navigate('view-documents', 'Dokumente anzeigen', 'docs'), ...back];
    return 'Gerne öffne ich den Dokumentenbereich. Die angezeigten Karten sind derzeit eine Vorschau; echte Kundendokumente und Mietverträge sind noch nicht mit MORA verbunden.';
  }
  if (intent === 'status') {
    state.actions = [navigate('view-requests', 'Anliegen anzeigen', 'service'), ...back];
    return 'Im Servicebereich finden Sie Ihre vorbereiteten Anliegen. Echte Vorgänge und Bearbeitungsstände sind noch nicht angebunden; deshalb kann ich Ihnen keinen bestätigten Status nennen.';
  }
  if (intent === 'appointments') {
    state.actions = [select('appointment-change', 'Änderung anfragen', 'message', 'Ich möchte eine Terminänderung anfragen.'), contact(), ...back];
    return 'Echte Termine sind noch nicht mit MORA verbunden. Ich kann Ihre Änderungsanfrage für MORADA vorbereiten.';
  }
  if (intent === 'contact') {
    state.actions = [contact(), ...(state.issue ? [report(), ...back] : [select('contact-request', 'Anfrage vorbereiten', 'message', 'Ich möchte MORADA eine Anfrage senden.')])];
    return 'Ich kann Ihre Anfrage für MORADA aufnehmen. Über den Kontaktbereich können Sie Ihre Betreuung erreichen, sobald dort bestätigte Kontaktdaten hinterlegt sind.';
  }
  if (intent === 'property' || intent === 'walkthrough') {
    state.actions = [navigate('view-property', intent === 'walkthrough' ? 'WalkThrough-Bereich öffnen' : 'Immobilienübersicht öffnen', 'portfolio'), ...back];
    return intent === 'walkthrough' ? 'Ein 360° WalkThrough ermöglicht einen virtuellen Rundgang. Im Portfolio ist der Bereich vorbereitet; ein echter Rundgang ist hier noch nicht angeschlossen.' : 'Im Portfolio ist die Immobilienübersicht vorbereitet. Die dort gezeigten Kennzahlen sind Demo-Werte; MORA hat noch keinen Zugriff auf Ihre echten Immobilien oder Einheiten.';
  }
  state.actions = [select('start-request', 'Anliegen melden', 'message', 'Ich möchte ein Anliegen melden.'), navigate('view-documents', 'Dokumente anzeigen', 'docs'), ...back];
  return 'Guten Tag. Ich bin MORA. Ich nehme Ihr Anliegen auf und stelle gezielte Rückfragen. Was kann ich rund um Ihre Immobilie für Sie vorbereiten?';
}

export async function processTurn(input, previous, understand) {
  const state = previous ? structuredClone(previous) : { version: 2, issue: null, pendingKey: null, history: [], actions: [] };
  let message = input.message || '';
  let mode = 'guided';
  let availability = null;
  let reply;
  if (input.actionId === 'new-request') {
    state.issue = null; state.pendingKey = null; state.history = [];
    reply = informationReply('greeting', state);
  } else if (input.actionId) {
    const selected = state.actions.find(item => item.id === input.actionId);
    if (!selected) throw Object.assign(new Error('Stale or unknown action'), { code: 'INVALID_ACTION' });
    if (selected.type === 'select' && selected.field === 'message') message = selected.value;
    else if (selected.type === 'select' && state.issue) {
      state.issue[selected.field] = selected.value;
      state.issue.answers.push({ question: state.pendingKey, answer: selected.value });
      message = selected.value;
      state.pendingKey = null;
      reply = nextReply(state);
    } else if (selected.type === 'add_details' && state.issue) {
      state.pendingKey = 'additional'; reply = nextReply(state);
    } else if (selected.type === 'continue' && state.issue) reply = nextReply(state);
    else throw Object.assign(new Error('Action must be handled by portal'), { code: 'INVALID_ACTION' });
  }
  if (input.attachments && state.issue) {
    state.issue.attachments = input.attachments;
    // A normal text submission also carries photo metadata. It must still be understood.
    if (!message && !reply) reply = nextReply(state, input.attachments.length ? 'Die Fotos sind dem Anliegen lokal hinzugefügt. ' : 'Die Fotos wurden aus dem Entwurf entfernt. ');
    else state.issue.summary = buildSummary(state.issue);
  }
  if (!reply) {
    const safety = detectHazard(message);
    const safetyCategory = safety.hazard === 'water' ? 'water' : safety.hazard === 'electric' ? 'electricity' : 'general';
    // Confirmed immediate danger must not wait for a remote model or a model timeout.
    const interpreted = safety.hazard !== 'none' ? {
      mode:'safety', data:{ intent:'issue', newIssue:Boolean(state.issue && state.issue.category !== safetyCategory),
        confidence:'clear', category:safetyCategory, subcategory:null, description:message,
        location:null, since:null, extent:null, details:null, ...safety },
    } : await understand(message, state);
    const data = understandingSchema.parse(interpreted.data);
    mode = interpreted.mode;
    availability = interpreted.availability || null;
    // Immediate safety markers override model failure or inappropriate model downranking.
    if (safety.hazard !== 'none') {
      data.intent = 'issue'; data.hazard = safety.hazard; data.urgency = safety.urgency;
      data.confidence = 'clear';
      data.category = safety.hazard === 'water' ? 'water' : safety.hazard === 'electric' ? 'electricity' : 'general';
    }
    if (data.intent !== 'issue' && data.intent !== 'general') reply = informationReply(data.intent, state);
    else {
      if (!state.issue || data.newIssue) {
        state.issue = newIssue(message, data); state.pendingKey = null;
      }
      const issue = state.issue;
      if (data.category && issue.category === 'general') issue.category = data.category;
      for (const key of ['subcategory', 'location', 'since', 'extent', 'details']) {
        if (data[key]) issue[key] = state.pendingKey === 'additional' && key === 'details' && issue.details ? `${issue.details}\n${data[key]}`.slice(-6000) : data[key];
      }
      // Every answer stays available for the eventual request even if the model misses a field.
      issue.answers.push({ question: state.pendingKey || 'description', answer: message });
      issue.answers = issue.answers.slice(-30);
      if (state.pendingKey === 'additional') state.pendingKey = null;
      if (data.hazard !== 'none') { issue.hazard = data.hazard; issue.urgency = data.urgency; }
      else if (data.urgency !== 'normal') issue.urgency = data.urgency;
      // An ambiguous first description gets one short clarification; handover is available immediately.
      if (issue.hazard === 'none' && issue.urgency !== 'emergency' && issue.category === 'general' && data.confidence === 'unclear' && !issue.details) {
        state.pendingKey = 'details'; state.actions = [{ ...report(), label:'An MORADA weiterleiten' }, additional(), contact()];
        issue.summary = buildSummary(issue);
        reply = 'Dabei möchte ich Ihnen nichts Falsches sagen. Was fällt Ihnen auf? Eine kurze Beschreibung reicht. Ich kann Ihre bisherigen Angaben auch direkt für MORADA übernehmen.';
      } else reply = nextReply(state);
    }
  }
  if (message) state.history.push({ role: 'user', content: message });
  state.history.push({ role: 'assistant', content: reply });
  state.history = state.history.slice(-24);
  return { reply, state, understanding:mode, availability };
}
