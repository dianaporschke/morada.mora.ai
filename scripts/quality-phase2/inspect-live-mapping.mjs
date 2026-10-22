// Offline read-only projection of received C facts; no browser, storage or model call.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {mapServiceDraft,draftSummary} from '../../assets/mora-data.js';
const data=JSON.parse(readFileSync('docs/evidence/quality-phase2-live.json','utf8'));
const fields=['category','equipment','description','defect','count','location','since','extent','details','cause'];
const projections=[];
for(const row of data.rows){
 if(row.applicationStatus!==200)continue;
 for(const issue of row.result.issues || []){
  const draft=mapServiceDraft(issue),matches=Object.fromEntries(fields.map(field=>[field,JSON.stringify(draft[field]??null)===JSON.stringify(issue[field]??null)]));
  for(const [field,match] of Object.entries(matches))assert.ok(match,`${row.caseId}/${row.turn}: ${field}`);
  assert.equal(draft.id,issue.id);
  projections.push({caseId:row.caseId,turn:row.turn,issueId:issue.id,sourceRevision:issue.revision,
   fields:Object.fromEntries(fields.map(field=>[field,draft[field]??null])),fieldFacts:draft.fieldFacts,matches,summary:draftSummary(draft)});
 }
}
const output={sourceCommit:data.sourceCommit,mainComplete:data.complete,modelCallsPerformed:0,storageWritesPerformed:0,portalCallsPerformed:0,
 scope:'Pure mapping of actual accepted C facts. Failed turns cannot project new customer facts; no persisted service draft is claimed.',projections};
writeFileSync('docs/evidence/quality-phase2-mapping-inspection.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({projections:projections.length,allExistingFactFieldsMatch:true,storageWritesPerformed:0}));
