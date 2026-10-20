import { randomUUID } from 'node:crypto';
import { categoryLabels, equipmentLabels, equipmentCategories, canonicalEquipment, explicitEquipmentCount, explicitSymptomsEvidence, issueContent, draftSummary } from '../../assets/mora-data.js';
const rank={normal:0,high:1,emergency:2};
function mergeDetails(existing,incoming) {
  const key=value=>value.normalize('NFKC').toLocaleLowerCase('de-CH').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const before=key(existing),next=key(incoming);
  if(before===next || existing.includes(incoming))return existing;
  // A model may return the full old note followed by the new information.
  // Keep that complete note once instead of appending its old prefix twice.
  if(before && next.startsWith(`${before} `))return incoming;
  return `${existing}\n${incoming}`.slice(-6000);
}
export function buildSummary(issue) {
  return draftSummary(issue);
}
export function refresh(issue) {
  issue.shortLabel = equipmentLabels[issue.equipment] || issue.equipment || categoryLabels[issue.category];
  issue.summary = buildSummary(issue); issue.updatedAt = new Date().toISOString();
}
export function createIssue(message, data) {
  return { id:randomUUID(), category:data.category || 'general', equipment:data.equipment || 'unknown',
    subcategory:data.subcategory || null, description:data.description || message, defect:null,
    count:null, location:null, since:null, extent:null, details:null,cause:null, urgency:'normal', hazard:'none',
    attachments:[], answers:[], corrections:[], unknownFields:[], summary:'', pendingKey:null, clarification:null, attempts:{},
    revision:1, fieldFacts:{}, preparation:{status:'not_prepared',revision:1}, status:'draft', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
}
export function applyPatch(issue, data, message, pendingKey, accumulateDetails=false) {
  const before=issueContent(issue);
  const changed = {};
  data.equipment=canonicalEquipment(data.equipment,data.sourceQuote || data.description || message);
  if (data.equipment==='unknown') data.equipment=null;
  const observations=explicitSymptomsEvidence(message);
  if (observations && !data.details?.includes(observations)) data.details=data.details ? `${data.details}\n${observations}` : observations;
  data.count ??= explicitEquipmentCount(message,data.equipment || issue.equipment);
  if (data.equipment==='light' && /^(?:Lampe )?(?:geht(?: gar)? nicht|funktioniert nicht)[.!]?$/i.test(data.defect || '')) data.defect='Lampe lässt sich nicht einschalten.';
  issue.fieldFacts ||= {};
  const uncertain=new Set((data.uncertainAnswers || []).map(item=>item.field));
  for (const item of data.uncertainAnswers || []) issue.fieldFacts[item.field]={status:'uncertain',value:issue[item.field] ?? null,candidate:data[item.field] ?? null,source:item.quote};
  issue.unknownFields = [...new Set([...(issue.unknownFields || []), ...(data.unknownFields || [])])];
  for (const key of data.clearFields || []) { issue.fieldFacts[key]={status:'corrected',value:null,source:message}; if (issue[key] != null) changed[key] = { from:issue[key], to:null }; issue[key] = null; }
  if (data.category && (issue.category === 'general' || data.correction)) issue.category = data.category;
  for (const key of ['equipment','subcategory','defect','location','since','extent','count','details','cause']) {
    if (uncertain.has(key) || (data.unknownFields || []).includes(key) || data[key] == null || (key === 'equipment' && data[key] === 'unknown')) continue;
    const appendDetails=key==='details' && issue.details && (pendingKey==='additional' || (accumulateDetails && !data.correction));
    const value=appendDetails ? mergeDetails(issue.details,data.details) : data[key];
    if (issue[key] !== value) changed[key] = { from:issue[key], to:value };
    const corrected=data.correction || (issue[key]!=null && issue[key]!==value);
    issue[key] = value;
    if (!issue.fieldFacts[key] || changed[key]) issue.fieldFacts[key]={status:corrected ? 'corrected':'known',value,source:message};
    issue.unknownFields = issue.unknownFields.filter(field => field !== key && !(key === 'count' && field === 'extent'));
  }
  for (const key of data.unknownFields || []) {
    if (issue[key]!=null) changed[key]={from:issue[key],to:null};
    issue[key]=null; issue.fieldFacts[key]={status:'unknown',value:null,source:message};
  }
  for (const key of ['equipment','defect','count','location','since','extent','details','cause']) issue.fieldFacts[key] ||= {status:issue[key]==null || issue[key]==='unknown' ? 'not_provided':'known',value:issue[key] ?? null,source:null};
  if (issue.equipment !== 'unknown' && equipmentCategories[issue.equipment]) issue.category = equipmentCategories[issue.equipment];
  issue.fieldFacts.category={status:issue.category==='general' ? 'not_provided':'known',value:issue.category,source:null};
  issue.fieldFacts.description ||= {status:'known',value:issue.description,source:message};
  // A revised count supersedes old scope, even when a model omits a rewritten extent.
  if (data.count != null && !uncertain.has('count') && !data.extent) issue.extent = `${data.count} betroffene Einrichtung(en)`;
  if (changed.count && !data.extent && data.count==null && /^\d+ betroffene Einrichtung/.test(issue.extent || '')) issue.extent=null;
  if (issue.fieldFacts.extent?.value!==issue.extent || !issue.fieldFacts.extent || issue.extent && issue.fieldFacts.extent.status==='not_provided') issue.fieldFacts.extent={status:issue.extent ? 'known':'not_provided',value:issue.extent,source:issue.extent ? issue.fieldFacts.count?.source || message : null};
  if ((data.correction || Object.values(changed).some(change=>change.from!=null && change.from!=='unknown')) && Object.keys(changed).length) {
    issue.corrections.push({ changes:changed, source:message, at:new Date().toISOString() });
    // The service's description must not keep an obsolete room/count from the
    // first message. Original customer wording remains in the answer audit.
    issue.description=buildSummary({...issue,description:null});
  }
  issue.fieldFacts.description={...issue.fieldFacts.description,value:issue.description};
  issue.corrections = issue.corrections.slice(-12);
  if (rank[data.urgency] > rank[issue.urgency]) issue.urgency = data.urgency;
  if (data.hazard !== 'none') issue.hazard = data.hazard;
  issue.answers.push({ question:pendingKey || 'description', answer:message });
  issue.answers = issue.answers.slice(-30);
  if (before!==issueContent(issue)) issue.revision=(issue.revision || 1)+1;
  refresh(issue);
}

