export function normalize(text = '') {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Deliberately bounded aliases: unrestricted fuzzy matching of short words can
// turn ordinary defects into emergencies. This is a fast safety net, not NLU.
function safetyText(value) {
  return normalize(value)
    .replace(/\b(?:gasgeruh|gasgeruchh|gasgeruchhh|gazgeruch|gas geruch)\b/g, 'gasgeruch')
    .replace(/\b(?:riche|riehce|riehche|rische)\b/g, 'rieche')
    .replace(/\b(?:gaz|gaas)\b/g, 'gas')
    .replace(/\b(?:brent|brenntt)\b/g, 'brennt')
    .replace(/\b(?:richt|r iecht|rich t|riehct|riehcht)\b/g, 'riecht')
    .replace(/\b(?:rorbruch|rohrbruh|rohrbrch|rohrbrcuh|rohr bruch)\b/g, 'rohrbruch')
    .replace(/\b(?:rauchh|rauc)\b/g, 'rauch')
    .replace(/\b(?:feur|feuerh)\b/g, 'feuer')
    .replace(/\b(?:funkn|funkenn|fnuken)\b/g, 'funken')
    .replace(/\b(?:stromschalg|stromschlg)\b/g, 'stromschlag')
    .replace(/\b(?:waser|wassser)\b/g, 'wasser')
    .replace(/\b(?:deke|dekce)\b/g, 'decke')
    .replace(/\b(?:steckdsoe|stekdose|stekdsose)\b/g, 'steckdose')
    .replace(/\b(?:nich|nit|nichtt)\b/g, 'nicht')
    .replace(/\b(?:kaine|kain|keien|keinn|keinee)\b/g, 'kein')
    .replace(/\b(?:gas|brand|rauch)melder\b/g, 'melder')
    .replace(/\bnicht nur\b/g, 'sogar');
}

function hypothetical(text) {
  // Do not apply this to every "wenn": worried users often describe a real
  // hazard conditionally. Suppress only explicit thought experiments/history.
  if (/\b(nur theoretisch|rein hypothetisch|als beispiel|angenommen|ich frage vorsorglich|fur den fall dass)\b/.test(text)) return true;
  if (/\b(was ware|was wurde|was musste|wie wurde)\b.*\bwenn\b/.test(text)) return true;
  if (/\b(wenn|falls)\b.*\b(irgendwann|einmal|mal)\b/.test(text)) return true;
  if (/\b(damals|letztes jahr|vor \w+ jahren)\b/.test(text) && !/\b(jetzt|aktuell|wieder|noch immer)\b/.test(text)) return true;
  return false;
}

function negated(text, match) {
  const before = text.slice(0, match.index);
  const evidence = match[0];
  const after = text.slice(match.index + evidence.length);
  // Preserve uncertainty and double negatives ("nicht sicher, ob ...",
  // "nicht auszuschliessen"). They must never silently dismiss a hazard.
  const notUncertain = value => value.replace(/\bnicht (?:sicher|auszuschliessen|ausgeschlossen|gut|normal)\b/g, '')
    .replace(/\bnicht ausschliessen\b/g, '');
  if (/\b(kein\w*|ohne|nicht|nie)\b/.test(notUncertain(evidence))) return true;
  if (/\b(?:kein\w*|ohne|nicht|nie)\s+(?:(?:mehr|wirklich|sichtbar\w*|stark\w*|erkennbar\w*|nach|ein\w*)\s+){0,3}$/.test(before)) return true;
  if (/^\s+(?:(?:ist|sind|gibt es|sehe ich|rieche ich)\s+)?(?:hier\s+)?(?:nicht|kein\w*)(?:\s+(?:mehr|vorhanden|da|sichtbar|wahrnehmbar|zu sehen|zu riechen))*(?:$|\s+(?:und|sondern|aber)\b)/.test(after)) return true;
  return false;
}

function evidenceIn(clauses, pattern) {
  return clauses.some(text => Array.from(text.matchAll(new RegExp(pattern, 'g'))).some(match => !negated(text, match)));
}

/** @returns {{ hazard: 'none'|'water'|'fire'|'gas'|'electric'|'other', urgency: 'normal'|'high'|'emergency' }} */
export function detectHazard(message) {
  // Keep punctuation until clause boundaries are established. A negation in
  // "kein Rauch, aber die Steckdose funkt" applies only to its own evidence.
  const clauses = String(message ?? '').split(/[.!?;\n]+|\b(?:aber|jedoch|sondern|allerdings)\b/iu)
    .map(safetyText).filter(text => text && !hypothetical(text));
  const has = pattern => evidenceIn(clauses, pattern);
  if (has('\\b(?:gasgeruch|gasaustritt|gasleck)\\b|\\b(?:riech\\w*|stinkt|geruch)\\b[^,]{0,40}\\bgas\\b|\\bgas\\b[^,]{0,25}\\b(?:riech\\w*|tritt\\s+aus|stromt\\s+aus|stinkt)\\b')) {
    return { hazard:'gas', urgency:'emergency' };
  }
  if (has('\\b(?:rauch|feuer|flammen|brand)\\b|\\b(?:es|wohnung|kuche|kabel|steckdose|verteiler|sicherungskasten)\\s+brennt\\b|\\b(?:es|steckdose|kabel|verteiler|sicherungskasten|lampe)\\s+raucht\\b')) {
    return { hazard:'fire', urgency:'emergency' };
  }
  if (has('\\b(?:funken|funkenflug|stromschlag)\\b|\\b(?:funkt|spritzt funken)\\b|\\b(?:offene?|blanke?|freiliegende?)\\s+(?:elektrische?\\s+)?(?:kabel|leitung|drahte)\\b|\\bnasse?\\s+steckdose\\b|\\bsteckdose\\s+(?:ist\\s+)?nass\\b|\\bwasser\\b.{0,20}\\b(?:in|aus)\\s+(?:der\\s+)?steckdose\\b')) {
    return { hazard:'electric', urgency:'emergency' };
  }
  if (has('\\bbrandgeruch\\b|\\b(?:riech\\w*|stinkt)\\b.{0,25}\\b(?:verbrannt|verschmort)\\b')) {
    return { hazard:'fire', urgency:'emergency' };
  }
  if (has('\\brohrbruch\\b|\\bwasser\\b.{0,30}\\b(?:aus|von|durch)\\s+(?:der\\s+)?decke\\b|\\bdecke\\b.{0,15}\\b(?:tropft|fliesst|lauft)\\b|\\b(?:starker|massiver|starken|massiven)\\s+wasseraustritt\\b|\\b(?:wohnung|keller|zimmer|bad)\\b.{0,20}\\b(?:steht|stehen)\\s+unter\\s+wasser\\b')) {
    return { hazard:'water', urgency:'high' };
  }
  return { hazard:'none', urgency:'normal' };
}

/**
 * Correct a misheard/retracted hazard, never declare a physical incident safe.
 * Uncertainty, a newly reported hazard, or a report that it has now stopped
 * must retain the existing safety status until it is handled separately.
 */
export function explicitHazardDenial(message, priorHazard) {
  const text = safetyText(String(message ?? ''));
  if (detectHazard(message).hazard !== 'none' || hypothetical(text)) return false;
  if (/\b(?:mehr|vorbei|behoben|repariert|geloscht|verschwunden|aufgehort|jetzt|inzwischen|mittlerweile)\b/.test(text)) return false;
  if (/\b(?:vielleicht|eventuell|vermutlich|moglicherweise|glaube|denke)\b|\bnicht sicher\b|\bweiss? nicht\b|\bausschliessen\b/.test(text) || String(message).includes('?')) return false;
  const patterns = {
    gas:/\b(?:gasgeruch|gasaustritt|gasleck)\b|\briech\w*\b.{0,35}\bgas\b/g,
    fire:/\b(?:rauch|feuer|flammen|brand|brandgeruch|brennt|raucht)\b|\briech\w*\b.{0,25}\b(?:verbrannt|verschmort)\b/g,
    electric:/\b(?:funken|funkenflug|stromschlag|funkt)\b|\b(?:offene?|blanke?|freiliegende?)\s+(?:elektrische?\s+)?(?:kabel|leitung|drahte)\b|\bsteckdose\b.{0,15}\bnass\b/g,
    water:/\b(?:rohrbruch|wasseraustritt)\b|\bwasser\b.{0,30}\b(?:aus|von|durch)\s+(?:der\s+)?decke\b/g,
  };
  const pattern = patterns[priorHazard];
  return Boolean(pattern && Array.from(text.matchAll(pattern)).some(match => negated(text, match)));
}

// Swiss emergency numbers: BAKOM, "Weitere Nummern: kostenpflichtig oder gratis?"
// https://www.bakom.admin.ch/de/weitere-nummern-kostenpflichtig-oder-gratis
// Gas precautions: SVGW, "Massnahmen bei Gasgeruch bzw. Gasaustritt" (G1 §4.1).
// https://www.svgw.ch/media/9938/20240212_g1_vernehmlassung.pdf
export function safetyNotice(hazard) {
  if (hazard === 'gas') return 'Bei Gasgeruch bitte den Gefahrenbereich verlassen. Betätigen Sie keine Schalter oder elektrischen Geräte, auch kein Telefon im Gebäude, und vermeiden Sie Flammen. Rufen Sie von draussen 112 an. Warten Sie nicht auf eine Antwort im Portal.';
  if (hazard === 'fire') return 'Bei Rauch, Feuer oder Brandgeruch verlassen Sie den Gefahrenbereich und rufen Sie von einem sicheren Ort 112 an. Warten Sie nicht auf eine Antwort im Portal.';
  if (hazard === 'electric') return 'Bitte halten Sie Abstand zu beschädigten elektrischen Teilen und berühren Sie keine Kabel oder nassen Geräte. Bei unmittelbarer Gefahr rufen Sie von einem sicheren Ort 112 an. Warten Sie nicht auf eine Antwort im Portal.';
  if (hazard === 'water') return 'Bei starkem Wasseraustritt halten Sie Abstand zu elektrischen Geräten und nassen Leitungen. Stoppen Sie die Wasserzufuhr nur, wenn das gefahrlos möglich ist. Bei unmittelbarer Gefahr rufen Sie 112 an; warten Sie nicht auf das Portal.';
  return 'Bei unmittelbarer Gefahr verlassen Sie den Gefahrenbereich und rufen Sie von einem sicheren Ort 112 an. Warten Sie nicht auf eine Antwort im Portal.';
}
