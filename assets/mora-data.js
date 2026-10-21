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
  // Provenance/audit wording is not a change to the customer's service data.
  return JSON.stringify(draftFields.map(key=>key==='fieldFacts'
    ? Object.entries(issue.fieldFacts || {}).sort(([a],[b])=>a.localeCompare(b)).map(([field,fact])=>[field,fact.status,fact.value ?? null,fact.candidate ?? null])
    : issue[key] ?? null));
}
export function matchesIssueContent(content,issue) {
  if(content===issueContent(issue))return true;
  // Existing local drafts used an audit-inclusive snapshot. Upgrade on read.
  try {
    const values=JSON.parse(content);
    if(!Array.isArray(values) || values.length!==draftFields.length)return false;
    const facts=values[draftFields.indexOf('fieldFacts')];
    if(!facts || Array.isArray(facts) || typeof facts!=='object')return false;
    return issueContent(Object.fromEntries(draftFields.map((key,index)=>[key,values[index]])))===issueContent(issue);
  }catch{return false;}
}
export function draftLabel(draft) {
  return draft.equipment && draft.equipment!=='unknown' ? equipmentLabels[draft.equipment] || draft.equipment : categoryLabels[draft.category] || 'Anliegen';
}
export function draftSummary(draft) {
  const uncertain=field=>!draft.localEdits?.[field] && draft.fieldFacts?.[field]?.status==='uncertain';
  const fact=(field,label)=>uncertain(field)?`${label}: unsicher${draft[field]!=null?` (bisherige Angabe: ${draft[field]})`:''}`:draft[field]!=null?`${label}: ${draft[field]}`:null;
  const countScope=uncertain('count') && !draft.localEdits?.extent && /^\d+ betroffene Einrichtung/.test(draft.extent || '');
  return [draftLabel(draft)+(uncertain('equipment')?' (Zuordnung unsicher)':''), draft.localEdits?.description ? draft.description : uncertain('defect')?fact('defect','Defekt'):draft.defect || draft.description,
    fact('count','Anzahl'),fact('location','Bereich'),
    draft.since || uncertain('since') ? fact('since','Seit wann') : draft.unknownFields?.includes('since') ? 'Beginn: unbekannt' : null,
    countScope?'Umfang / Situation: Anzahl noch unsicher':fact('extent','Umfang / Situation'),fact('details','Zusatzangaben'),
    fact('cause','Genannte Ursache'),
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
    ...(existing?.requestId ? {requestId:existing.requestId,unsentChanges:existing.unsentChanges || !matchesIssueContent(existing.sourceContent,issue)} : {}),
    sourceContent:issueContent(issue),localEdits:existing?.localEdits || (existing?.locallyEdited ? Object.fromEntries(editableFields.map(field=>[field,true])) : {}),
    chatSnapshot:Object.fromEntries(editableFields.map(field=>[field,source[field] ?? null])),conflictFields:[]};
  for (const field of Object.keys(draft.localEdits)) {
    if (!editableFields.includes(field) || !existing) continue;
    if ((existing[field] ?? null)!==(draft[field] ?? null)) draft.conflictFields.push(field);
    draft[field]=existing[field];
  }
  draft.category=equipmentCategories[draft.equipment] || draft.category;
  draft.locallyEdited=Object.keys(draft.localEdits).length>0;
  draft.summary=draftSummary(draft);
  return draft;
}
export function preparationState(issue, draft) {
  if (!issue) return 'not_prepared';
  if (draft?.delivery==='sent' && draft.requestId && !draft.unsentChanges) return 'sent';
  if (draft && matchesIssueContent(draft.sourceContent,issue)) return 'portal_received';
  if (issue.preparation?.status==='portal_received' && (issue.preparation.content ? issue.preparation.content===issueContent(issue) : issue.preparation.revision===issue.revision)) return 'portal_received';
  return issue.preparation?.status==='error' ? 'error' : 'ready';
}

/** One action policy for model context, validation and browser controls.
 * An offered create action remains accessible without being offered in every reply.
 * Updates refer to the same draft and require a meaningful content change.
 */
export function draftActionState(issue, draft) {
  const status=preparationState(issue,draft);
  const confirmed=['portal_received','sent'].includes(status);
  const evidence={draftExists:Boolean(draft || issue?.preparation?.status==='portal_received'),chatFactsInDraft:confirmed};
  if(!issue)return {status,...evidence,operation:null,canOffer:false,showControl:false};
  if(confirmed)return {status,...evidence,operation:'open',canOffer:false,showControl:false};
  const operation=draft || issue.preparation?.status==='portal_received' ? 'update':'create';
  const offered=issue.draftOffer?.operation===operation && (operation==='create' || issue.draftOffer.content===issueContent(issue)) || operation==='create' && issue.draftOfferShown && !issue.draftOffer;
  const canOffer=Boolean(issue.description || issue.defect) && (!offered || status==='error');
  return {status:status==='error'?'error':operation==='update'?'changes_pending':offered?'offered':'not_prepared',...evidence,operation,canOffer,
    showControl:Boolean(offered || operation==='update' || status==='error')};
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

/** Preserve explicit negative observations. An isolated “nein” has no guessed meaning. */
export function explicitSymptomsEvidence(evidence) {
  const match=evidence.match(/(?:^|[.!?;\n])\s*(keine(?:n)?\s+(?:(?:weiteren?|zusätzlichen?|besonderen?|ungewöhnlichen?)\s+)*(?:Symptome|Auffälligkeiten|Gerüche|Geräusche)(?:\s+(?:oder|und)\s+(?:Gerüche|Geräusche))?)(?=[.!?,;\n]|$)/iu);
  return match?.[1] || null;
}

/** Preserve an explicit first-person availability assertion as a verbatim note.
 * This neither interprets times nor books contact. Questions/third parties are
 * not assertions; ambiguous issue targets are handled by the semantic layer.
 */
export function explicitAvailabilityEvidence(evidence) {
  for(const sentence of evidence.split(/(?<=[.!?;])\s+|\n/gu)) {
    if(sentence.length>700 || sentence.includes('?'))continue;
    if(/^\s*ich bin\b.+\berreichbar\b/iu.test(sentence) || /^\s*sie (?:können|koennen) mich\b.+\berreichen\b/iu.test(sentence))return sentence.trim();
  }
  return null;
}
