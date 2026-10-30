import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {navigationKnowledge} from '../lib/mora/portal/view-knowledge.js';
import {createAgentTurn} from '../lib/mora/portal/agent.js';
import {hydrateSimple} from '../lib/mora/simple/state.js';

test('customer view knowledge matches the native empty-table implementation',()=>{
 const html=readFileSync('portal.html','utf8');
 assert.match(html,/tablePage\(c.title,c.desc,c.cols,\[\]/);
 for(const id of ['tenantDocuments','tenantSupport','tenantPayments','ownerCases','ownerDocuments']){
  const [view]=navigationKnowledge([id]);
  assert.equal(view.implementation,'empty_preview_table');assert.equal(view.recordConnection,false);
  assert.equal(view.recordContents,'unknown');assert.deepEqual(view.viewActions,['open']);
 }
});
test('knowledge never expands available navigation or personal permissions',()=>{
 const turn=createAgentTurn(hydrateSimple(null),'Wo ist meine Abrechnung?',['tenantPayments','invented']);
 const snapshot=turn.snapshot();
 assert.deepEqual(snapshot.capabilities.navigation.map(v=>v.id),['tenantPayments']);
 assert.equal(snapshot.capabilities.financialData,false);assert.equal(snapshot.capabilities.personalRecords,false);
 assert.equal(snapshot.capabilities.localCases,false);
 assert.match(snapshot.capabilities.navigation[0].purpose,/Keine Nebenkostenabrechnungen/);
});
test('internal case workflow is not disabled by customer preview limits',()=>{
 const snapshot=createAgentTurn(hydrateSimple(null),'Foto ergänzen',['cases']).snapshot();
 assert.equal(snapshot.capabilities.localCases,true);
 assert.equal(snapshot.capabilities.navigation[0].implementation,undefined);
 assert.deepEqual(navigationKnowledge(['ownerCases','ownerCases']).map(v=>v.id),['ownerCases']);
});

test('document directions use the native sidebar labels without implying record access',()=>{
 const html=readFileSync('portal.html','utf8');
 for(const [id,path] of [['ownerDocuments',['Verwaltung','Dokumente']],['tenantDocuments',['Service','Meine Dokumente']]]){
  const view=navigationKnowledge([id])[0];
  assert.deepEqual(view.customerPath,path);assert.equal(view.recordConnection,false);
  assert.ok(html.includes("['"+id+"','file','"+path[1]+"']"));
 }
});
