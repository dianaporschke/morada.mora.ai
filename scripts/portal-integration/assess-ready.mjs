/** Data acceptance for recorded real HTTP runs. No generated/mock replies. */
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {portalCaseFields} from '../../assets/mora-portal-map.js';
const path=process.argv[2] || 'docs/evidence/portal-ready-quality-2026-10-27.json';
const run=JSON.parse(readFileSync(path,'utf8'));
const results=[];
function check(name,fn){try{fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
const conversation=id=>{const c=run.conversations.find(c=>c.id===id);assert.ok(c,`Missing conversation ${id}`);return c;};
const last=id=>conversation(id).turns.at(-1).response;
const issue=id=>{const i=last(id).issue;assert.ok(i,`Missing issue ${id}`);return i;};
const field=(id,key,value)=>assert.equal(issue(id)[key],value);
check('20 complete conversations and 52 successful customer turns',()=>{
 assert.equal(run.conversations.length,20);const source=JSON.parse(readFileSync('scripts/quality-phase1/cases.json','utf8'));
 for(const c of source){const actual=conversation(c.id);assert.equal(actual.turns.length,c.messages.length);assert.deepEqual(actual.turns.map(t=>t.customer),c.messages);for(const t of actual.turns)assert.equal(t.status,200,`${c.id}: ${t.customer}`);}
});
check('Lamp, room, count and negative observation reach native mapping',()=>{field('01','equipment','light');field('01','location','Wohnzimmer');field('01','count',1);assert.ok(issue('01').details);const f=portalCaseFields(issue('01'));assert.match(f.title,/Lampe \/ Leuchte/);assert.equal(f.unit,'Wohnzimmer');assert.ok(f.description.includes(issue('01').details));});
check('Socket negations do not become an acute danger',()=>{field('02','equipment','socket');field('02','location','Küche');assert.equal(last('02').safety,null);assert.ok(issue('02').details);});
check('Explicitly unknown start stays unknown',()=>{field('03','equipment','heater');field('03','since',null);assert.equal(issue('03').fieldFacts.since.status,'unknown');});
check('Room correction retains identity, fixture and count',()=>{const c=conversation('04');field('04','location','Schlafzimmer');field('04','equipment','light');field('04','count',1);assert.equal(c.turns[0].response.issue.id,issue('04').id);assert.equal(issue('04').fieldFacts.location.status,'corrected');assert.doesNotMatch(portalCaseFields(issue('04')).description,/Wohnzimmer/);});
check('Topic change preserves the original tap and suppresses irrelevant controls',()=>{const c=conversation('05');field('05','equipment','tap');field('05','location','Bad');assert.equal(c.turns[0].response.issue.id,issue('05').id);assert.equal(c.turns[1].response.controls.save,null);});
check('Two issues retain their own rooms, counts and starts',()=>{const items=last('06').issues;assert.equal(items.length,2);const lamp=items.find(i=>i.equipment==='light'),heater=items.find(i=>i.equipment==='heater');assert.equal(lamp.location,'Flur');assert.equal(heater.location,'Bad');assert.equal(heater.count,2);assert.match(lamp.since,/heute/);assert.match(heater.since,/gestern/);});
check('Information and owner questions do not create service cases',()=>{for(const id of ['07','08','18'])assert.equal(last(id).issues.length,0);});
check('Unclear object is resolved to a roller shutter without guessing another fixture',()=>{field('09','location','Kinderzimmer');assert.match(issue('09').equipment,/roll|storen/i);assert.match(issue('09').defect,/halb/i);});
check('Electrical danger and later correction block form actions',()=>{for(const id of ['10','11']){assert.ok(last(id).safety);assert.equal(last(id).controls.save,null);assert.equal(last(id).controls.review,null);}});
check('Unknown water cause does not become a diagnosed pipe or flood',()=>{assert.notEqual(issue('12').equipment,'pipe');assert.equal(issue('12').cause,null);assert.equal(last('12').safety,null);});
check('Colloquial words and later availability survive',()=>{field('16','equipment','light');field('16','count',1);field('16','location','Wohnzimmer');assert.match(issue('16').details,/16/);assert.match(issue('16').since,/gestern/);});
check('Requested external sending never obtains a receipt',()=>{assert.equal(issue('17').preparation.receipt,undefined);assert.equal(last('17').controls.stored,null);});
check('Uncertain count remains explicitly uncertain until confirmed',()=>{const c=conversation('19');assert.equal(c.turns[1].response.issue.fieldFacts.count.status,'uncertain');field('19','count',1);assert.notEqual(issue('19').fieldFacts.count.status,'uncertain');field('19','location','Wohnzimmer');assert.match(issue('19').since,/Montag/);});
const turns=run.conversations.flatMap(c=>c.turns),ok=turns.filter(t=>t.status===200),median=a=>{a=a.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?a[Math.floor(a.length/2)]:null;};
const report={model:run.model,url:run.url,scope:'Recorded real outputs; deterministic data acceptance. Language and safety advice also require transcript review.',checks:results,passed:results.every(r=>r.passed),metrics:{turns:turns.length,successful:ok.length,modelCalls:turns.reduce((s,t)=>s+(t.response.modelCalls||0),0),accountDeltaUsd:run.actualAccountDeltaUsd,costPerCustomerTurnUsd:run.actualAccountDeltaUsd/turns.length,medianBackendMs:median(ok.map(t=>t.response.timingMs?.total)),medianModelAndGatewayMs:median(ok.map(t=>t.response.timingMs?.model)),medianCreditGuardMs:median(ok.map(t=>t.response.timingMs?.creditGuard)),medianHttpMs:median(ok.map(t=>t.httpMs))}};
const out=path.replace(/\.json$/,'-assessment.json');writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
