export function normalize(text = '') {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** @returns {{ hazard: 'none'|'water'|'fire'|'gas'|'electric'|'other', urgency: 'normal'|'high'|'emergency' }} */
export function detectHazard(message) {
  const text = normalize(message)
    .replace(/\b(?:kein\w*|nicht|ohne)\s+(?:mehr\s+)?(?:\w+\s+){0,2}(gasgeruch|brandgeruch|rauch|feuer|brand|flammen|funken|stromschlag)\b/g, '')
    .replace(/\b(?:gas|brand|rauch)melder\b/g, 'melder');
  if (/\b(gasgeruch|gasgeruchh)\b|riecht.{0,15}\bgas\b|\bgas\b.{0,15}riecht/.test(text)) return { hazard: 'gas', urgency: 'emergency' };
  if (/\b(rauch|feuer|brandgeruch|flammen)\b|\b(es|wohnung|kuche|kabel) brennt\b/.test(text)) return { hazard: 'fire', urgency: 'emergency' };
  if (/\b(funken|stromschlag)\b|offene.{0,12}(kabel|leitung)|nasse? steckdose/.test(text)) return { hazard: 'electric', urgency: 'emergency' };
  if (/\b(rohrbruch|rorbruch|rohrbruh)\b|wasser.{0,35}\bdecke\b|\b(starker|massiver) wasseraustritt\b/.test(text)) return { hazard: 'water', urgency: 'high' };
  return { hazard: 'none', urgency: 'normal' };
}

export function safetyNotice(hazard) {
  if (hazard === 'gas') return 'Bei Gasgeruch bitte den Gefahrenbereich verlassen. Betätigen Sie keine Schalter oder elektrischen Geräte und vermeiden Sie Flammen. Rufen Sie von draussen 112 an. Warten Sie nicht auf eine Antwort im Portal.';
  if (hazard === 'fire') return 'Bei Rauch, Feuer oder Brandgeruch verlassen Sie den Gefahrenbereich und rufen Sie von einem sicheren Ort 112 an. Warten Sie nicht auf eine Antwort im Portal.';
  if (hazard === 'electric') return 'Bitte halten Sie Abstand zu beschädigten elektrischen Teilen und berühren Sie keine Kabel oder nassen Geräte. Bei unmittelbarer Gefahr rufen Sie von einem sicheren Ort 112 an. Warten Sie nicht auf eine Antwort im Portal.';
  if (hazard === 'water') return 'Bei starkem Wasseraustritt halten Sie Abstand zu elektrischen Geräten und nassen Leitungen. Stoppen Sie die Wasserzufuhr nur, wenn das gefahrlos möglich ist. Bei unmittelbarer Gefahr rufen Sie 112 an; warten Sie nicht auf das Portal.';
  return 'Bei unmittelbarer Gefahr verlassen Sie den Gefahrenbereich und rufen Sie von einem sicheren Ort 112 an. Warten Sie nicht auf eine Antwort im Portal.';
}
