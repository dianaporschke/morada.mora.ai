/** Shared MORA vocabulary. Imported by server validation and browser draft mapping. */
export const equipmentLabels = {
  socket:'Steckdose', light:'Lampe / Leuchte', switch:'Lichtschalter', power:'Stromversorgung', heater:'Heizkörper',
  key:'Schlüssel / Zugang', washer:'Waschmaschine', dryer:'Trockner', dishwasher:'Geschirrspüler',
  tap:'Wasserhahn', drain:'Abfluss', pipe:'Rohr / Leitung', leak:'Wasseraustritt', noise:'Lärmstörung', unknown:'Noch unklar',
};
export const equipmentCategories = {
  socket:'electricity', light:'electricity', switch:'electricity', power:'electricity', heater:'heating', key:'access',
  washer:'appliances', dryer:'appliances', dishwasher:'appliances', tap:'water', drain:'water', pipe:'water', leak:'water', noise:'neighbours',
};
export const categoryLabels = { water:'Wasser / Feuchtigkeit', electricity:'Elektrik / Beleuchtung', heating:'Heizung', access:'Schlüssel / Zugang', neighbours:'Nachbarschaft / Lärm', appliances:'Geräte / Waschküche', general:'Allgemeines Anliegen' };
const aliases = {
  socket:['steckdose','steckdosen'], light:['lampe','lampen','leuchte','leuchten','beleuchtung','deckenlampe','stehlampe','tischlampe','deckenleuchte'],
  switch:['lichtschalter','schalter'], power:['stromversorgung','sicherung'], heater:['heizung','heizkörper','heizkoerper','radiator'],
  key:['schlüssel','schluessel','wohnungsschlüssel'], washer:['waschmaschine'], dryer:['trockner','tumbler'], dishwasher:['geschirrspüler','geschirrspueler'],
  tap:['wasserhahn'], drain:['abfluss','siphon'], pipe:['rohr','leitung','rohrbruch'], noise:['lärmstörung','lärm'],
};
const normal = value => value.toLocaleLowerCase('de-CH').normalize('NFKC').trim();
/** Exact aliases only. No fuzzy diagnosis, first-match category or guessed count. */
export function canonicalEquipment(value, evidence = '') {
  const text=typeof value==='string' ? normal(value) : '';
  if (Object.hasOwn(equipmentLabels,text) && text!=='unknown') return text;
  for (const [code,label] of Object.entries(equipmentLabels)) {
    if (code!=='unknown' && (normal(label)===text || aliases[code]?.includes(text))) return code;
  }
  if (text && text!=='unknown' && text!=='noch unklar') return value.trim();
  const words=normal(evidence).match(/[\p{L}]+/gu) || [];
  // A negated/retracted object or comparison needs semantic resolution by the LLM.
  if (/\b(?:nicht die|nicht der|nicht das|keine lampe|statt|sondern|oder)\b/i.test(evidence)) return 'unknown';
  const candidates=Object.entries(aliases).filter(([,names])=>names.some(name=>words.includes(name))).map(([code])=>code);
  return candidates.length===1 ? candidates[0] : 'unknown';
}
export const draftFields = ['category','equipment','description','defect','count','location','since','extent','details','cause','urgency','hazard','attachments','unknownFields','fieldFacts'];
export const editableFields = ['description','equipment','defect','count','extent','location','since','details'];
export function issueContent(issue) {
  return JSON.stringify(draftFields.map(key=>issue[key] ?? null));
}
export function draftLabel(draft) {
  return draft.equipment && draft.equipment!=='unknown' ? equipmentLabels[draft.equipment] || draft.equipment : categoryLabels[draft.category] || 'Anliegen';
}
export function draftSummary(draft) {
  return [draftLabel(draft), draft.localEdits?.description ? draft.description : draft.defect || draft.description,
    draft.count && `Anzahl: ${draft.count}`, draft.location && `Bereich: ${draft.location}`,
    draft.since ? `Seit wann: ${draft.since}` : draft.unknownFields?.includes('since') ? 'Beginn: unbekannt' : null,
    draft.extent && `Umfang / Situation: ${draft.extent}`,draft.details && `Zusatzangaben: ${draft.details}`,
    draft.cause && `Genannte Ursache: ${draft.cause}`,
    `Dringlichkeit: ${{normal:'Normal',high:'Dringend',emergency:'Mögliche akute Gefahr'}[draft.urgency] || 'Normal'}`,
    draft.attachments?.length && `Fotos: ${draft.attachments.length} (lokal, noch nicht hochgeladen)`,
  ].filter(Boolean).join('\n');
}
/** One mapping boundary; portal fields and local customer edits retain their meaning. */
export function mapServiceDraft(issue, existing, {session=null, now=new Date().toISOString()}={}) {
  const source=structuredClone(issue);
  source.equipment=(source.unknownFields || []).includes('equipment') || source.fieldFacts?.equipment?.status==='corrected' && source.equipment==null ? 'unknown' : canonicalEquipment(source.equipment,source.description || '');
  source.category=equipmentCategories[source.equipment] || source.category || 'general';
  const draft={...source,attachments:source.attachments || [],status:'draft',session,updatedAt:now,
    sourceRevision:issue.revision || 1,delivery:existing?.delivery || 'not_sent',
    ...(existing?.requestId ? {requestId:existing.requestId,unsentChanges:existing.unsentChanges || issueContent(issue)!==existing.sourceContent} : {}),
    sourceContent:issueContent(issue),localEdits:existing?.localEdits || (existing?.locallyEdited ? Object.fromEntries(editableFields.map(field=>[field,true])) : {}),
    chatSnapshot:Object.fromEntries(editableFields.map(field=>[field,source[field] ?? null])),conflictFields:[]};
  for (const field of Object.keys(draft.localEdits)) {
    if (!editableFields.includes(field) || !existing) continue;
    if ((existing[field] ?? null)!==(draft[field] ?? null)) draft.conflictFields.push(field);
    draft[field]=existing[field];
  }
  draft.locallyEdited=Object.keys(draft.localEdits).length>0;
  draft.summary=draftSummary(draft);
  return draft;
}
export function preparationState(issue, draft) {
  if (!issue) return 'not_prepared';
  if (draft?.delivery==='sent' && draft.requestId && !draft.unsentChanges) return 'sent';
  if (draft && draft.sourceContent===issueContent(issue)) return 'portal_received';
  if (issue.preparation?.revision===issue.revision && issue.preparation?.status==='portal_received') return 'portal_received';
  return issue.preparation?.status==='error' ? 'error' : 'ready';
}

/** Loss prevention for explicit counts beside a known facility, never singular grammar alone. */
export function explicitEquipmentCount(evidence, equipment) {
  const names=aliases[equipment];if(!names)return null;
  const words={ein:1,eine:1,einer:1,eins:1,zwei:2,drei:3,vier:4,fünf:5,fuenf:5,sechs:6,sieben:7,acht:8,neun:9,zehn:10};
  const text=normal(evidence);
  if (/\b(?:vielleicht|unsicher|eventuell|oder|nicht eine|nicht zwei)\b/.test(text)) return null;
  const re=new RegExp(`\\b(\\d{1,4}|${Object.keys(words).join('|')})\\s+(?:(?:betroffene|defekte|kaputte)\\s+)?(?:${names.join('|')})\\b`,'gu');
  const values=[...text.matchAll(re)].map(match=>words[match[1]] || Number(match[1]));
  return new Set(values).size===1 && values[0]>=1 ? values[0] : null;
}
