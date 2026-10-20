/** Read-only mapping inspection of actual saved live issues. No model or portal calls. */
import fs from 'node:fs';
import {mapServiceDraft} from '../../assets/mora-data.js';

const data=JSON.parse(fs.readFileSync(new URL('../../docs/evidence/quality-phase1-live.json',import.meta.url),'utf8'));
const inspections=[['01',3],['19',2],['19',3]].map(([caseId,turn])=>{
  const row=data.rows.find(r=>r.caseId===caseId && r.variant==='B' && r.turn===turn);
  if(!row?.result.issue)throw Error('Missing actual live issue');
  const issue=row.result.issue;
  const draft=mapServiceDraft(issue,undefined,{now:issue.updatedAt});
  return {caseId,variant:'B',turn,source:'actual saved live response; unchanged pure mapServiceDraft only',
    sourceFields:{equipment:issue.equipment,location:issue.location,count:issue.count,countFact:issue.fieldFacts?.count,extent:issue.extent},
    mappedFields:{equipment:draft.equipment,location:draft.location,count:draft.count,countFact:draft.fieldFacts?.count,extent:draft.extent,summary:draft.summary}};
});
const evidence={sourceCommit:data.sourceCommit,inferenceStarted:false,portalWritePerformed:false,browserPerformed:false,
  method:'Offline invocation of unchanged mapping function with actual live issues, no mocked model response',inspections};
fs.writeFileSync(new URL('../../docs/evidence/quality-phase1-mapping-inspection.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({inspections:inspections.length,inferenceStarted:false,portalWritePerformed:false}));
