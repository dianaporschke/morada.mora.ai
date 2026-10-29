// Deterministic permission/adapter tests. These are NOT live model evaluations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readPortalAccess,readAuthorizedCases,accessCapabilities,allowedPortalNavigation} from '../lib/mora/portal/access.js';
import {createPortalChatHandler} from '../api/portal-chat.js';
import {hydrateSimple} from '../lib/mora/simple/state.js';
import {readSession} from '../lib/mora/session.js';
import {createCompactPortalAgent,compactSchema,decodeCompactPlan} from '../lib/mora/portal/compact-agent.js';
import {AGENT_MODEL} from '../lib/mora/portal/budget.js';
import {portalNavigation,PORTAL_ACCESS_GUIDANCE} from '../assets/mora-portal-map.js';

const scope=(propertyId='a',extra={})=>({propertyId,propertyLabel:'Testliegenschaft '+propertyId,caseIds:null,queries:['case-status','repair-counts'],reporterNames:false,...extra});
const grant=(extra={})=>({version:1,subjectId:'owner-a',organisationId:'org-a',authorizationVersion:'v1',role:'owner',expiresAt:Date.now()+60000,navigation:['ownerHome','ownerCases','ownerFinance'],scopes:[scope()],...extra});
const row=(id='case-a',extra={})=>({id,propertyId:'a',publicStatus:true,kind:'repair',equipment:'light',status:'in_progress',updatedAt:'2026-10-28T10:00:00Z',...extra});
const result=records=>({complete:true,asOf:'2026-10-28T11:00:00Z',records});
const adapter=(g=grant(),rows=[row()])=>({loadAccess:async()=>structuredClone(g),readCases:async()=>result(rows)});
const allowed=async(g=grant(),rows=[row()])=>readPortalAccess({},adapter(g,rows));
async function call(handler,body,identity){let status=200,data;await handler({method:'POST',body,identity},{setHeader(){},status(v){status=v;return this;},json(v){data=v;}});return {status,data};}

test('without a real adapter only known UI navigation is available; forged access grants cannot read',async()=>{
 const access=await readPortalAccess({body:{role:'admin',subjectId:'owner-a'}});
 assert.deepEqual(accessCapabilities(access),{status:'unavailable',personalQueries:[]});
 assert.deepEqual(allowedPortalNavigation(['tenantPayments','unknown'],access),['tenantPayments']);
 assert.equal((await readAuthorizedCases({...access,status:'verified',read:()=>({status:'verified'})},'case-status')).status,'unavailable');
});
test('configured authentication failures and expired grants fail closed, with no preview fallback',async()=>{
 for(const a of [{loadAccess:async()=>{throw Error('offline');}},adapter(grant({expiresAt:0})),adapter({...grant(),clientRole:'admin'}),{}]){
  const access=await readPortalAccess({},a);assert.equal(access.status,'unavailable');
  assert.deepEqual(allowedPortalNavigation(['cases','ownerFinance'],access),[]);
 }
});
test('navigation is the intersection of native UI and server grants; never a data permission',async()=>{
 const access=await allowed();assert.deepEqual(allowedPortalNavigation(['cases','ownerFinance','ownerCases','ownerCases'],access),['ownerFinance','ownerCases']);
 for(const q of ['invoices','finance','getFinancialSummary','read_document','messages'])assert.equal((await readAuthorizedCases(access,q)).status,'unavailable');
 assert.equal(portalNavigation.tenantPayments.dataAccess,'financial_navigation_only');
 assert.equal(portalNavigation.tenantInvoices,undefined);assert.match(PORTAL_ACCESS_GUIDANCE,/niemals/);
});
test('owner comparison contains only explicitly granted properties, includes zeros and excludes closed/other cases',async()=>{
 const access=await allowed(grant({scopes:[scope(),scope('b'),scope('c')]}),[row(),row('b1',{propertyId:'b'}),row('b2',{propertyId:'b'}),row('b3',{propertyId:'b',status:'completed'}),row('b4',{propertyId:'b',kind:'other'})]);
 const r=await readAuthorizedCases(access,'repair-counts');assert.equal(r.status,'verified');
 assert.deepEqual(r.rows.map(r=>[r.property,r.count]),[['Testliegenschaft b',2],['Testliegenschaft a',1],['Testliegenschaft c',0]]);
});
test('one foreign or duplicate record rejects the entire query without revealing its existence',async()=>{
 for(const rows of [[row(),row('private',{propertyId:'other-owner'})],[row(),row()]]){
  const r=await readAuthorizedCases(await allowed(grant(),rows),'case-status');
  assert.equal(r.status,'unavailable');assert.doesNotMatch(JSON.stringify(r),/other-owner|private|case-a/);
 }
});
test('tenant access requires explicit case IDs; property ownership never grants every tenant case',async()=>{
 const g=grant({role:'tenant',navigation:['tenantSupport'],scopes:[scope('a',{caseIds:['case-a'],queries:['case-status']})]});
 assert.equal((await readAuthorizedCases(await allowed(g),'case-status')).status,'verified');
 assert.equal((await readAuthorizedCases(await allowed(g,[row('other-tenant')]),'case-status')).status,'unavailable');
 assert.equal((await readAuthorizedCases(await allowed(g),'repair-counts')).status,'unavailable');
 assert.equal((await allowed(grant({role:'tenant'}))).status,'unavailable');
});
test('administration and managers also have explicit scopes, not unrestricted access',async()=>{
 for(const role of ['admin','manager']){
  assert.equal((await readAuthorizedCases(await allowed(grant({role}),[row('foreign',{propertyId:'b'})]),'case-status')).status,'unavailable');
  assert.equal((await readAuthorizedCases(await allowed(grant({role,scopes:[]})),'case-status')).status,'unavailable');
 }
});
test('minimal projection removes financial data, internal notes, files, chats and default reporter names',async()=>{
 const rows=[row('a',{reporterLabel:'Testperson',rent:1800,invoice:'secret-invoice',internalNote:'secret-note',messages:['secret-chat'],attachments:['secret-photo']})];
 const r=await readAuthorizedCases(await allowed(grant(),rows),'case-status');
 assert.equal(r.status,'verified');assert.doesNotMatch(JSON.stringify(r),/secret-|1800|Testperson|case-a/);
 const named=await readAuthorizedCases(await allowed(grant({scopes:[scope('a',{reporterNames:true})]}),rows),'case-status');
 assert.equal(named.rows[0].reporter,'Testperson');assert.equal(named.rows[0].equipment,'light');
});
test('only public confirmed status enums and matching confirmed appointments are accepted',async()=>{
 for(const r of [row('x',{publicStatus:false}),row('x',{status:'step3'}),row('x',{equipment:'private invoice CHF 120'}),row('x',{appointmentAt:'2026-10-29T10:00:00Z'})])
  assert.equal((await readAuthorizedCases(await allowed(grant(),[r]),'case-status')).status,'unavailable');
 const r=await readAuthorizedCases(await allowed(grant(),[row('x',{status:'appointment_agreed',appointmentAt:'2026-10-29T10:00:00Z'})]),'case-status');assert.equal(r.rows[0].status,'appointment_agreed');
});
test('incomplete backend pages cannot produce misleading property rankings',async()=>{
 const a=adapter();a.readCases=async()=>({...result([row()]),complete:false});
 assert.equal((await readAuthorizedCases(await readPortalAccess({},a),'repair-counts')).status,'unavailable');
});
test('revocation during data lookup and adapter errors expose no partial results',async()=>{
 let loads=0;const a=adapter();a.loadAccess=async()=>grant({authorizationVersion:++loads===1?'v1':'v2'});
 assert.equal((await readAuthorizedCases(await readPortalAccess({},a),'case-status')).status,'unavailable');
 a.loadAccess=async()=>grant();a.readCases=async()=>{throw Error('PRIVATE BACKEND ERROR');};
 const r=await readAuthorizedCases(await readPortalAccess({},a),'case-status');assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);assert.equal(r.status,'unavailable');
});
test('backend adapter receives authenticated scope, never client-supplied IDs or roles',async()=>{
 let readOptions;const a=adapter();a.readCases=async(_req,options)=>{readOptions=options;return result([row()]);};
 const access=await readPortalAccess({body:{role:'admin',propertyId:'foreign'}},a);await readAuthorizedCases(access,'case-status');
 assert.equal(readOptions.subjectId,'owner-a');assert.deepEqual(readOptions.scopes.map(s=>s.propertyId),['a']);
});
test('handler binds conversations to identity, organisation, grant version and scope, even with identical role',async()=>{
 let current=grant(),calls=0;
 const h=createPortalChatHandler({portalAdapter:{loadAccess:async()=>current},converse:async(_m,state)=>{calls++;return {state,reply:'Testantwort',navigation:[],modelCalls:1};}});
 const first=await call(h,{message:'Hallo',messageId:randomUUID(),navigation:['ownerHome']});assert.equal(first.status,200);
 for(const change of [{subjectId:'owner-b'},{organisationId:'org-b'},{authorizationVersion:'v2'},{scopes:[scope('b')]},{expiresAt:0}]){
  current=grant(change);const r=await call(h,{session:first.data.session,message:'Weiter',messageId:randomUUID(),navigation:['ownerHome']});
  assert.equal(r.status,409);assert.equal(r.data.resetConversation,true);assert.equal(r.data.session,undefined);assert.equal(r.data.issue,undefined);
 }
 assert.equal(calls,1);
});
test('actual handler returns authorized data separately; no results in signed session or model context',async()=>{
 let inputContext;
 const h=createPortalChatHandler({portalAdapter:adapter(),converse:async(_m,state,nav,_timeout,context)=>{inputContext=context;return {state,reply:'Fabricated answer is discarded',navigation:nav,portalQuery:'case-status',modelCalls:1};}});
 const r=await call(h,{message:'Wie ist der Stand?',messageId:randomUUID(),navigation:['ownerCases','cases']});
 assert.equal(r.status,200);assert.equal(r.data.portalResult.rows[0].property,'Testliegenschaft a');assert.equal(r.data.reply,'');
 assert.deepEqual(r.data.controls.navigation,['ownerCases']);
 assert.doesNotMatch(JSON.stringify(readSession(r.data.session)),/Testliegenschaft|in_progress|Fabricated/);
 assert.doesNotMatch(JSON.stringify(inputContext),/owner-a|org-a|Testliegenschaft|case-a/);
});
test('API refuses identity and financial query parameters supplied directly in request bodies',async()=>{
 const h=createPortalChatHandler({converse:async()=>{throw Error('must not call');}});
 for(const extra of [{role:'admin'},{subjectId:'owner-a'},{portalQuery:'invoices'},{propertyId:'foreign'}])
  assert.equal((await call(h,{message:'Hallo',messageId:randomUUID(),...extra})).status,400);
});
test('compact agent selects a typed query with one test generation; no model-authored result is returned',async()=>{
 const message='Welche meiner Liegenschaften haben am meisten offene Reparaturen?';let calls=0,instructions;
 const wire={reply:'Invented private result',topic:'information',updates:[],focus:null,next:{type:'portal-query',query:'repair-counts',requestQuote:message}};
 const converse=createCompactPortalAgent({resolve:async()=>({ready:true,provider:'gateway',model:AGENT_MODEL,createModel:()=>({})}),guard:async()=>{},generate:async options=>{calls++;instructions=options.instructions;return {output:wire,usage:{},finalStep:{}};}});
 const r=await converse(message,hydrateSimple(null),['ownerCases','ownerFinance'],45000,{status:'verified',personalQueries:['repair-counts']});
 assert.equal(calls,1);assert.equal(r.reply,'');assert.equal(r.portalQuery,'repair-counts');assert.match(instructions,/financial_navigation_only/);assert.match(instructions,/Finanzdaten bleiben immer reine Navigation/);
 assert.equal(compactSchema().safeParse({...wire,next:{type:'portal-query',query:'invoices',requestQuote:message}}).success,false);
 assert.throws(()=>decodeCompactPlan({...wire,next:{...wire.next,requestQuote:'not said'}},message));
});
