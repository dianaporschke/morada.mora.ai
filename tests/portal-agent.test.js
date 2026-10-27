// Deterministic regression fixtures and actual installed SDK execution.
// These mocked model transports are NOT live conversation quality evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MockLanguageModelV4} from 'ai/test';
import {JSDOM} from 'jsdom';
import {createAgentTurn,createPortalAgent} from '../lib/mora/portal/agent.js';
import {attachWalkthroughSelection} from '../lib/mora/portal/walkthrough.js';
import {hydrateSimple,contentHash,beginPreparation,acceptReceipt} from '../lib/mora/simple/state.js';
import {portalCaseFields,portalCaseEvidence} from '../assets/mora-portal-map.js';
import {createPortalClient} from '../assets/mora-portal-client.js';
import {createPortalChatHandler,controls} from '../api/portal-chat.js';
import {AGENT_MODEL as MODEL} from '../lib/mora/portal/budget.js';

const empty=()=>hydrateSimple(null);
const invoke=(t,name,input)=>t.tools[name].execute(input,{});
async function patch(s,message,changes){const t=createAgentTurn(s,message,['cases']);const result=await invoke(t,'record_issues',{updates:[{ref:s.issue?'active':'new1',quote:message,...changes}]});assert.equal(result.ok,true,JSON.stringify(result));return t.getState();}
const lamp=()=>patch(empty(),'Eine Lampe im Wohnzimmer geht nicht. Sonst ist alles normal.',{equipment:'light',defect:'geht nicht',location:'Wohnzimmer',count:1,details:'Sonst ist alles normal.'});
const selection={propertyId:'property-1',unitId:'unit-1',walkthroughId:'tour-1',roomId:'room-1',objectId:'heater-1',hotspotId:'spot-1',roomLabel:'Schlafzimmer',objectLabel:'Heizkörper'};
async function call(handler,body){let status=200,data;await handler({method:'POST',body},{setHeader(){},status(n){status=n;return this;},json(v){data=v;return this;}});return {status,data};}
const toolCall=(name,input)=>({type:'tool-call',toolCallId:randomUUID(),toolName:name,input:JSON.stringify(input)});
function sdk(outputs,guard=async()=>{}){let n=0;const model=new MockLanguageModelV4({modelId:MODEL,doGenerate:async()=>{
 assert.ok(n<outputs.length,'unexpected model call');const value=outputs[n++];if(value instanceof Error)throw value;
 return {content:typeof value==='string'?[{type:'text',text:value}]:value,finishReason:{unified:typeof value==='string'?'stop':'tool-calls',raw:'stop'},usage:{inputTokens:{total:10,noCache:10,cacheRead:0},outputTokens:{total:10,text:10,reasoning:0}},warnings:[]};
 }});return {model,converse:createPortalAgent({resolve:async()=>({ready:true,provider:'gateway',model:MODEL,createModel:()=>model}),guard})};}

test('agent short answers and room correction preserve stable identity, count and observations',async()=>{
 let s=await patch(empty(),'lampe kaput',{equipment:'light',defect:'kaputt'});
 s=await patch(s,'wohnzimmer',{location:'Wohnzimmer'});s=await patch(s,'Eine, sonst ist alles normal.',{count:1,details:'Sonst ist alles normal.'});const id=s.issue.id;
 s=await patch(s,'Nein, Schlafzimmer.',{location:'Schlafzimmer',correction:true});
 assert.equal(s.issue.id,id);assert.equal(s.issues.length,1);assert.equal(s.issue.count,1);assert.equal(s.issue.fieldFacts.location.status,'corrected');
 const f=portalCaseFields(s.issue);assert.match(f.title,/Lampe \/ Leuchte/);assert.equal(f.unit,'Schlafzimmer');assert.match(f.description,/Anzahl: 1/);assert.match(f.description,/Sonst ist alles normal/);assert.doesNotMatch(f.description,/Wohnzimmer/);
});
test('unknown start, uncertain count and corrections remain distinct',async()=>{
 let s=await lamp();s=await patch(s,'Den Beginn weiss ich nicht.',{unknown:[{field:'since',quote:'weiss ich nicht'}]});
 s=await patch(s,'Vielleicht sind es zwei.',{count:2,uncertain:[{field:'count',quote:'Vielleicht sind es zwei.'}]});
 assert.equal(s.issue.fieldFacts.count.status,'uncertain');assert.equal(s.issue.count,1);assert.equal(s.issue.fieldFacts.since.status,'unknown');
 s=await patch(s,'Es ist sicher eine.',{count:1,correction:true});assert.equal(s.issue.fieldFacts.count.status,'corrected');assert.match(portalCaseFields(s.issue).description,/Beginn: unbekannt/);
});
test('separate issues, failed quoted update and retry do not contaminate facts',async()=>{
 const message='Zwei Lampen im Flur sind kaputt. Die Heizung im Bad bleibt kalt.',t=createAgentTurn(empty(),message,['cases']);
 const updates=[{ref:'new1',quote:'Zwei Lampen im Flur sind kaputt.',equipment:'light',defect:'kaputt',count:2,location:'Flur'},{ref:'new2',quote:'Die Heizung im Bad bleibt kalt.',equipment:'heater',defect:'bleibt kalt',location:'Bad'}];
 assert.equal((await invoke(t,'record_issues',{updates:[{...updates[0],quote:'unbelegt'}]})).ok,false);assert.equal(t.getState().issues.length,0);
 assert.equal((await invoke(t,'record_issues',{updates})).ok,true);assert.equal(t.getState().issues.length,2);assert.equal(t.getState().issues[1].count,null);
 assert.equal((await invoke(t,'record_issues',{updates})).ok,false);assert.equal(t.getState().issues.length,2);
});
test('new topic suppresses old actions; existing issue can be resumed explicitly',async()=>{
 const s=await lamp(),t=createAgentTurn(s,'Was ist ein Übergabeprotokoll?',['cases']);
 assert.equal(controls(t.getState()).save,null);assert.equal(t.getState().issues.length,1);
 await invoke(t,'use_issue',{ref:'active'});assert.ok(controls(t.getState()).save);assert.equal(t.getState().issue.id,s.issue.id);
});
test('form requests enforce readiness, safety and access; no tool saves anything',async()=>{
 const s=await lamp();for(const [state,available] of [[s,[]],[{...s,safety:{hazard:'electric'}},['cases']]]){
  const t=createAgentTurn(state,'Bitte vorbereiten. ',available);assert.equal((await invoke(t,'open_form',{action:'prepare',ref:'active',requestQuote:'Bitte vorbereiten.'})).ok,false);assert.equal(t.getAction(),null);
 }
 const t=createAgentTurn(s,'Bitte vorbereiten.',['cases']);const r=await invoke(t,'open_form',{action:'prepare',requestQuote:'Bitte vorbereiten.'});assert.equal(r.ok,true);assert.equal(r.saved,false);assert.equal(r.opened,false);assert.equal(t.getState().issue.preparation.status,'not_prepared');
 assert.equal((await invoke(t,'open_form',{action:'prepare',requestQuote:'Bitte vorbereiten.'})).ok,true);assert.equal(t.getState().issues.length,1);
});
test('saved issue is updated with the same ID; stale receipts and duplicate operations are controlled',async()=>{
 let s=await lamp();const op=beginPreparation(s);assert.deepEqual(beginPreparation(s),op);acceptReceipt(s,{...op,status:'portal_received'});assert.equal(controls(s).save,null);
 s=await patch(s,'Nein, Schlafzimmer.',{location:'Schlafzimmer',correction:true});assert.equal(controls(s).save.operation,'update');assert.equal(s.issue.id,op.issueId);
 assert.throws(()=>acceptReceipt(s,{...op,status:'error'}));
});
test('actual SDK: ordinary response uses one model call and no judge',async()=>{
 const a=sdk(['Ein Übergabeprotokoll hält den Zustand bei der Übergabe fest.']);const r=await a.converse('Was ist ein Übergabeprotokoll?',empty(),['cases']);
 assert.equal(r.modelCalls,1);assert.equal(a.model.doGenerateCalls.length,1);assert.equal(r.state.issues.length,0);assert.equal(r.toolEvents.length,0);
});
test('actual SDK: one tool update, then natural reply with current facts, two calls',async()=>{
 let guarded=0;const a=sdk([[toolCall('record_issues',{updates:[{ref:'new1',quote:'Lampe kaputt',equipment:'light',defect:'kaputt'}]})],'Wo befindet sich die Lampe?'],async()=>{guarded++;});
 const r=await a.converse('Lampe kaputt',empty(),['cases']);assert.equal(r.modelCalls,2);assert.equal(guarded,2);assert.equal(r.state.issue.equipment,'light');assert.equal(r.reply,'Wo befindet sich die Lampe?');assert.match(a.model.doGenerateCalls[1].prompt[0].content,/"equipment":"light"/);
});
test('actual SDK: invalid tool data is repaired only at that tool, within three calls',async()=>{
 const a=sdk([[toolCall('record_issues',{updates:[{ref:'new1',quote:'not said',location:'Bad'}]})],[toolCall('record_issues',{updates:[{ref:'new1',quote:'Lampe kaputt',equipment:'light',defect:'kaputt'}]})],'In welchem Raum ist die Lampe?']);
 const r=await a.converse('Lampe kaputt',empty(),['cases']);assert.equal(r.modelCalls,3);assert.deepEqual(r.toolEvents.map(e=>e.ok),[false,true]);assert.equal(r.state.issues.length,1);assert.equal(r.state.issue.location,null);
});
test('actual SDK: a failed later response keeps successful facts but executes no portal action',async()=>{
 const a=sdk([[toolCall('record_issues',{updates:[{ref:'new1',quote:'Lampe kaputt',equipment:'light',defect:'kaputt'}]})],Error('transport failure')]);
 const handler=createPortalChatHandler({converse:a.converse,integration:'portal_agent_v1'});
 const r=await call(handler,{message:'Lampe kaputt',messageId:randomUUID(),navigation:['cases']});assert.equal(r.status,503);assert.equal(r.data.issue.equipment,'light');assert.equal(r.data.issue.preparation.status,'not_prepared');assert.ok(r.data.session);
});
test('actual SDK: credit guard blocks the next call without swallowing the boundary',async()=>{
 let n=0;const a=sdk([[toolCall('record_issues',{updates:[{ref:'new1',quote:'Lampe kaputt',equipment:'light',defect:'kaputt'}]})]],async()=>{if(++n===2)throw Object.assign(Error('limit'),{code:'PREVIEW_CREDIT_BOUNDARY'});});
 await assert.rejects(a.converse('Lampe kaputt',empty(),['cases']),e=>e.code==='PREVIEW_CREDIT_BOUNDARY'&&e.modelCalls===1&&e.conversationState.issue.equipment==='light');assert.equal(a.model.doGenerateCalls.length,1);
});
test('agent and established signed sessions cannot cross; raw walkthrough IDs are rejected',async()=>{
 const a=createPortalChatHandler({converse:sdk(['Guten Tag!']).converse,integration:'portal_agent_v1'}),r=await call(a,{message:'Hallo',messageId:randomUUID()});assert.equal(r.status,200);
 const old=createPortalChatHandler();assert.equal((await call(old,{session:r.data.session,action:'new-conversation'})).status,409);
 assert.equal((await call(a,{message:'Heizung',messageId:randomUUID(),walkthrough:selection})).status,400);
});
test('walkthrough linkage requires an authorized resolver and preserves all identifiers',async()=>{
 let s=await patch(empty(),'Heizung bleibt kalt.',{equipment:'heater',defect:'bleibt kalt'}),id=s.issue.id;
 await assert.rejects(attachWalkthroughSelection(s,{issueId:id,selectionToken:'selection'},null,async()=>selection));
 await assert.rejects(attachWalkthroughSelection(s,{issueId:id,selectionToken:'selection'},'customer',async()=>{throw Error('forbidden');}));
 const before=contentHash(s.issue);s=await attachWalkthroughSelection(s,{issueId:id,selectionToken:'selection'},'customer',async(token,p)=>{assert.equal(token,'selection');assert.equal(p,'customer');return selection;});
 assert.equal(s.issue.id,id);assert.equal(s.issue.location,'Schlafzimmer');assert.equal(s.issue.defect,'bleibt kalt');assert.equal(s.issue.walkthrough.objectId,'heater-1');assert.notEqual(contentHash(s.issue),before);
 assert.match(portalCaseFields(s.issue).description,/Im Walkthrough ausgewählt: Heizkörper · Schlafzimmer/);assert.match(portalCaseEvidence(s.issue),/"hotspotId":"spot-1"/);
 const again=await attachWalkthroughSelection(s,{issueId:id,selectionToken:'selection'},'customer',async()=>selection);assert.equal(again.issue.revision,s.issue.revision);
});
test('room correction invalidates an old hotspot instead of silently moving it',async()=>{
 let s=await patch(empty(),'Heizung kaputt',{equipment:'heater',defect:'kaputt'});s=await attachWalkthroughSelection(s,{issueId:s.issue.id,selectionToken:'selection'},'customer',async()=>selection);
 s=await patch(s,'Nein, Wohnzimmer.',{location:'Wohnzimmer',correction:true});assert.equal(s.issue.walkthrough.status,'needs_reselection');assert.equal(s.issue.walkthrough.roomId,'room-1');assert.equal(s.issue.location,'Wohnzimmer');assert.match(portalCaseFields(s.issue).description,/erneut auswählen/);
});
test('UI variant uses a different endpoint and storage key; messages remain plain text',async()=>{
 const d=new JSDOM('<div id="portalPreview"></div>',{url:'https://example.test/portal.html?mora=agent'}),w=d.window;w.structuredClone=structuredClone;
 let requested;const c=createPortalClient(w.document,w,{role:()=> 'admin',open:()=>true,available:()=>[],currentDraft:()=>null},{fetcher:async(url)=>{requested=url;return {ok:true,json:async()=>({architecture:'portal_agent_v1',reply:'<script>bad()</script>',session:'test',controls:{}})};}});
 try{c.open();await c.send('Hallo');assert.equal(requested,'/api/portal-agent');assert.ok(w.sessionStorage.getItem('morada.portal.mora.agent.v1.admin'));assert.equal(w.sessionStorage.getItem('morada.portal.mora.v1.admin'),null);assert.equal(c.element.querySelector('script'),null);}finally{w.close();}
});
