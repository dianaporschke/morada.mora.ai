import { emptyUnderstanding, issuePatchSchema, understandingSchema } from './schema.js';
import { detectHazard, normalize } from './safety.js';
import { equipmentWords, equipmentCategories } from './equipment.js';

function distance(a, b) {
  const row = Array.from({ length:b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = temp;
    }
  }
  return row[b.length];
}
function matches(text, words) {
  return text.split(' ').some(token => words.some(word => token === word ||
    (word.length >= 5 && token.startsWith(word)) ||
    (word.length >= 6 && token.length >= 5 && distance(token, word) <= (word.length >= 8 ? 2 : 1))));
}
function equipmentFor(text) {
  const entries = Object.entries(equipmentWords);
  const vocabulary = entries.flatMap(([, words]) => words).sort((a, b) => b.length - a.length).join('|');
  const affirmative = text.replace(new RegExp(`\\b(?:nicht|statt)\\s+(?:(?:die|der|das|meine?|einer?|einen?)\\s+)?(?:${vocabulary})\\b`, 'g'), ' ');
  const tokens = affirmative.split(' ');
  // Match the most specific fixture before broader prefixes such as "Licht".
  const exact = entries.find(([, words]) => tokens.some(token => words.includes(token)));
  if (exact) return exact[0];
  const fuzzy = entries.find(([, words]) => tokens.some(token => words.some(word =>
    word.length >= 6 && token.length >= 5 && distance(token, word) <= (word.length >= 8 ? 2 : 1))));
  if (fuzzy) return fuzzy[0];
  return entries.flatMap(([equipment, words]) => words.map(word => ({equipment, word})))
    .sort((a, b) => b.word.length - a.word.length)
    .find(({word}) => word.length >= 5 && tokens.some(token => token.startsWith(word)))?.equipment || null;
}
const NUMBER_WORDS = { eine:1, ein:1, einer:1, eins:1, zwei:2, drei:3, vier:4, funf:5, sechs:6, sieben:7, acht:8, neun:9, zehn:10 };
function numberFrom(text) {
  const match = text.match(/\b(\d{1,4}|eine|ein|einer|eins|zwei|drei|vier|funf|sechs|sieben|acht|neun|zehn)\b/);
  return match ? (NUMBER_WORDS[match[1]] || Number(match[1]) || null) : null;
}
function timeFrom(message) {
  const match = message.match(/\b(?:seit\s+)?(?:gestern(?:\s+(?:Abend|Morgen|Nacht))?|heute(?:\s+(?:Morgen|Mittag))?|vorgestern|letzte[rn]?\s+(?:Nacht|Woche)|jeden?\s+(?:Abend|Nacht)|nachts|(?:\d+|ein(?:er|em)?|zwei|drei|vier)\s+(?:Stunden?|Tagen?|Wochen?|Monaten?))\b/i);
  if (!match && /\b(?:seit\s+)?(?:gestren|gester|gesterm)\b/.test(normalize(message))) return /\bseit\b/.test(normalize(message)) ? 'seit gestern' : 'gestern';
  return match?.[0] || null;
}
function placeFrom(message) {
  const match = message.match(/(?:(?:unter\s+(?:der|dem)|unterm)|im(?:\s+ganzen)?|in der|in meiner|auf dem|am)\s+(?:Wohnzimmer|Badezimmer|Bad|Küche|Kueche|Keller|Treppenhaus|Aussenbereich|Außenbereich|Wohnung|Hauseingang|Flur|Balkon|Schlafzimmer|Lavabo|Spüle|Spuele)\b|\b(?:Wohnzimmer|Badezimmer|Bad|Küche|Kueche|Keller|Treppenhaus|Aussenbereich|Außenbereich|Wohnung|Hauseingang|Flur|Balkon|Schlafzimmer|Lavabo|Spüle|Spuele)\b/i);
  if (match) return match[0];
  const canonical = { wohnzimmer:'Wohnzimmer', badezimmer:'Badezimmer', kuche:'Küche', kueche:'Küche', keller:'Keller', kelr:'Keller', treppenhaus:'Treppenhaus', schlafzimmer:'Schlafzimmer', balkon:'Balkon' };
  const normalized = normalize(message);
  const typo = Object.keys(canonical).find(word => matches(normalized, [word]));
  return typo ? canonical[typo] : null;
}

function defectFrom(text) {
  if (/\b(?:funktioniert|funktionieren|funktiniert|funtioniert|funktoniert)\b.{0,160}\bnicht\b/.test(text)) return 'funktioniert nicht';
  if (/\b(?:geht|gehen|gehn)\b.{0,20}\b(?:nicht|nimmer)\b|\b(?:geht|gehen|gehn)\s+(?:gar\s+)?(?:keine?|kei)\b/.test(text)) return 'funktioniert nicht';
  if (/\b(?:nicht|nimmer|net|nid|ned)\s+(?:warm|heiss)\b|\bkalt\b/.test(text)) return 'wird nicht warm';
  if (/\b(?:tropft\w*|tropf\w*)\b/.test(text)) return 'tropft';
  if (/\b(?:verloren|ferloren)\b/.test(text)) return 'verloren';
  if (/\b(?:kaput\w*|defekt|spinnt)\b/.test(text)) return 'defekt';
  if (/\b(?:laut|gerausche|gerausch|klappert|rattert)\b/.test(text)) return 'macht Geräusche';
  return null;
}

const PENDING_FIELDS = new Set(['equipment', 'location', 'since', 'extent', 'details', 'additional']);
function canClarify(field) {
  return PENDING_FIELDS.has(field) && field !== 'additional' ? field : 'details';
}
function patchOnly(result) {
  return issuePatchSchema.parse(Object.fromEntries(Object.keys(issuePatchSchema.shape).map(key => [key, result[key]])));
}

/** Explicitly limited recovery, never advertised as semantic AI. */
function single(message, state) {
  const text = normalize(message);
  const correctedClause = message.split(/\bsondern\b/i).at(-1).trim();
  const extractionText = normalize(correctedClause);
  const result = emptyUnderstanding({ ...detectHazard(message) });
  const active = state?.issue;
  const correction = /\b(nein|moment|doch|korrektur|statt|eigentlich|sondern)\b/.test(text) || /\bzweite\b.*\bauch\b/.test(text);
  result.correction = correction;
  if (/\b(mietkaution|kaution|mietzinsdepot)\b/.test(text) && /\b(was|bedeutet|erklar|ist|sind)\b/.test(text)) {
    return emptyUnderstanding({ intent:'knowledge', confidence:'clear', topic:'deposit' });
  }
  if (/\b(was ist|was bedeutet|erklaren sie|was sind)\b/.test(text) && !equipmentFor(text)) {
    return emptyUnderstanding({ intent:'knowledge', topic:'general' });
  }
  if (matches(text, ['dokument', 'mietvertrag', 'abrechnung', 'protokoll'])) result.intent = 'documents';
  else if (matches(text, ['termin', 'besichtigung'])) result.intent = 'appointments';
  else if (/\b(status|bearbeitungsstand|vorgang)\b/.test(text)) result.intent = 'status';
  else if (/\b(kontakt|erreichen|telefon|email)\b/.test(text)) result.intent = 'contact';
  else if (/\b(immobilienubersicht|portfolio|mieteinnahmen)\b/.test(text)) result.intent = 'property';
  else if (/\b(walkthrough|360|rundgang)\b/.test(text)) result.intent = 'walkthrough';
  else if (/^(hallo|hi|hey|guten tag|guten morgen|danke|vielen dank)$/.test(text)) result.intent = 'greeting';
  if (result.intent !== 'general') return result;

  result.equipment = equipmentFor(extractionText);
  // Lavabo names a location, not a diagnosed pipe or appliance.
  result.category = equipmentCategories[result.equipment] || null;
  result.location = placeFrom(correctedClause);
  result.since = timeFrom(correctedClause);
  const roomWide = /\b(ganz(?:e[nmrs]?|en)?|gesamten)\b/.test(text) && /wohnzimmer|wohnung|haus|gebaude/.test(text);
  const scope = /\b(alle|mehrere|einzelne|einzeln|nur (?:eine?|diese))\b/.test(text) || roomWide;
  const numericScope = extractionText.match(/\b(\d{1,4}|eine?|eins|zwei|drei|vier|funf|sechs|sieben|acht|neun|zehn)\s+(?:(?:defekte|betroffene)\s+)?(?:steckdosen?|lampen?|leuchten?|heizkorper|heizkoerper|radiatoren?|schlussel|schluessel)\b/);
  const briefNumber = /^\s*(?:(?:nein|moment|doch|eigentlich|nur)\s+)?(?:\d{1,4}|eine?|eins|zwei|drei|vier|funf|sechs|sieben|acht|neun|zehn)\s*$/.test(extractionText);
  if (numericScope) result.count = numberFrom(numericScope[1]);
  else if (active && (correction || state.pendingKey === 'extent') && briefNumber) result.count = numberFrom(extractionText);
  if (/\bzweite\b.*\bauch\b/.test(text) && active?.count === 1) result.count = 2;
  if (result.count) result.extent = `${result.count} ${result.equipment === 'socket' || active?.equipment === 'socket' ? (result.count === 1 ? 'Steckdose' : 'Steckdosen') : 'betroffene Einrichtung(en)'}`;
  if (scope) {
    const entity = result.equipment || active?.equipment;
    result.extent = /^alle(?: heizkorper| heizkoerper)?$/.test(text) && (entity === 'heater' || active?.category === 'heating') ? 'Alle Heizkörper' : message;
    if (!result.count && (/\balle\b/.test(text) || roomWide || /\bmehrere\b/.test(text))) result.clearFields.push('count');
    if (/nur (?:eine?|diese)/.test(text)) result.count = 1;
  }
  if (active?.category === 'access' && /\b(ausgesperrt|komme.*(?:hinein|rein)|noch in.*wohnung)\b/.test(text)) result.extent = message;
  if (/\b(laut|jede nacht|nachts|gerausche|gerausch)\b/.test(text)) result.details = message;
  result.defect = defectFrom(text);
  if (result.since && !result.equipment && !result.defect && !result.location && !result.extent && !result.count) {
    const remainder = normalize(correctedClause).replace(/\b(?:gestren|gester|gesterm)\b/g, 'gestern').replace(normalize(result.since), '').trim();
    if (remainder && !/^(?:(?:es|das|ist|so|erst|ungefahr|etwa|ich|glaube|schon)\s*)+$/.test(remainder)) result.since = null;
  }
  if (result.hazard === 'water') { result.category = 'water'; result.equipment ||= 'leak'; }
  if (['gas','fire','electric'].includes(result.hazard)) result.category ||= result.hazard === 'electric' ? 'electricity' : 'general';
  const explicitNew = /\b(ausserdem|zusatzlich|anderes problem|weiteres problem|neues anliegen|noch ein problem)\b/.test(text);
  // An unfinished question permits short relevant replies, not arbitrary data in
  // whatever field happens to be pending. Unknown text must remain unclassified.
  const recognizedReply = Boolean(result.location || result.since || result.extent || result.count || result.defect || result.details || result.hazard !== 'none');
  const boundedUnknown = /^(?:das )?(?:weiss|weis) (?:ich )?nicht$|^keine ahnung$/.test(text);
  if (result.category) {
    result.intent = 'issue'; result.confidence = 'clear'; result.description = message;
    const existing = state?.issues?.find(issue => issue.equipment === result.equipment && issue.equipment && (!result.location || !issue.location || normalize(issue.location) === normalize(result.location)));
    if (existing && existing.id !== active?.id && !explicitNew) result.targetIssueId = existing.id;
    result.newIssue = Boolean(active && !result.targetIssueId && !correction && (explicitNew || result.category !== active.category ||
      (active.equipment && active.equipment !== 'unknown' && result.equipment && result.equipment !== active.equipment)));
  } else if (active && (recognizedReply || boundedUnknown || state.pendingKey === 'additional')) {
    result.intent = 'issue'; result.category = active.category; result.equipment = active.equipment || null;
    result.confidence = 'clear';
  } else {
    result.intent = recognizedReply || /\b(ding|dingens|irgendwas|etwas)\b/.test(text) ? 'issue' : 'general';
    result.equipment = result.intent === 'issue' ? 'unknown' : null;
    result.question = canClarify(state?.pendingKey);
    result.clarification = 'Das habe ich noch nicht sicher verstanden. Können Sie es kurz anders beschreiben?';
  }
  if (/\b(ding|dingens|irgendwas|etwas)\b/.test(text) && !result.category && !active) {
    result.equipment = 'unknown'; result.question = 'equipment';
    result.clarification = /gerausch/.test(text) ? 'Woher kommen die Geräusche genau? Können Sie das betroffene Teil kurz beschreiben?' : 'Was genau fällt Ihnen dort auf? Eine kurze Beschreibung reicht.';
  }
  if (PENDING_FIELDS.has(state?.pendingKey) && !result.newIssue && result.intent === 'issue') {
    const field = state.pendingKey;
    const extracted = ['location','since','extent','details','count','defect'].some(key => result[key]) || Boolean(correction && equipmentFor(extractionText));
    if (field === 'additional') result.details = message;
    else if (field === 'equipment' && (!result.equipment || result.equipment === 'unknown')) result.details = message;
    else if (field === 'details' && !extracted) result.details = message;
    else if (field === 'location' && !extracted && /^(?:im|in|unter|neben|bei|auf|hinter|vor|links|rechts)\b/.test(text) && !/\b(?:geht|kaputt|defekt|funktioniert)\b/.test(text)) result.location = message;
    else if (field === 'since' && !extracted && /\b(langer|lange|kurzem|stunden|tagen|weiss ich nicht)\b/.test(text)) result.since = message;
    else if (field === 'extent' && !extracted && /\b(eine|einer|mehrere|alle|weiss ich nicht)\b/.test(text)) result.extent = message;
    else if (!extracted && field !== 'additional') {
      result.confidence = 'unclear'; result.question = canClarify(field);
      result.clarification = 'Das habe ich noch nicht sicher verstanden. Können Sie es kurz anders beschreiben?';
    }
  }
  return result;
}

export function guidedUnderstanding(message, state) {
  const pieces = message.split(/\s+(?:und|ausserdem|außerdem|zusätzlich)\s+|[;\n]+/i).filter(Boolean);
  const equipment = pieces.map(piece => equipmentFor(normalize(piece)));
  const independent = pieces.length > 1 && pieces.length <= 4 && pieces.every(piece => equipmentFor(normalize(piece)) || detectHazard(piece).hazard !== 'none') &&
    (new Set(equipment.filter(Boolean)).size > 1 || /\b(?:ausserdem|außerdem|zusätzlich)\b/i.test(message));
  if (!independent) return understandingSchema.parse(single(message, state));
  const items = pieces.map(piece => single(piece, null));
  const first = items[0];
  first.newIssue = Boolean(state?.issue && (first.category !== state.issue.category || first.equipment !== state.issue.equipment));
  first.additionalIssues = items.slice(1).map(patchOnly);
  return understandingSchema.parse(first);
}
