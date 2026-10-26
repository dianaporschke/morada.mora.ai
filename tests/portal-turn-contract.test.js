import test from 'node:test';
import assert from 'node:assert/strict';
import {hydrateSimple,projectDecision,commitDecision,contentHash} from '../lib/mora/simple/state.js';
import {rememberPreparationOffer} from '../lib/mora/actions.js';
import {portalActionState} from '../lib/mora/portal/action-state.js';
import {createPortalService,validatePortalPlan} from '../lib/mora/portal/service.js';
import {hasUnconfirmedSuccess} from '../lib/mora/portal/reply-validation.js';
import {MODEL} from '../lib/mora/portal/budget.js';
import {controls} from '../api/portal-chat.js';

function state(){const message='Eine Lampe im Wohnzimmer geht nicht. Sonst ist alles normal.';
 const p={intent:'issue',reply:'Sie können die Angaben prüfen.',actions:[],updates:[{ref:'new1',quote:message,equipment:'light',defect:'geht nicht',location:'Wohnzimmer',count:1,details:'Sonst ist alles normal.'}]};
 return commitDecision(projectDecision(hydrateSimple(null),message,p),message,p).state;
}
function fixture(outputs,requests=[]){return createPortalService({resolve:async()=>({ready:true,provider:'gateway',model:MODEL,createModel:()=>({})}),guard:async()=>{},generate:async o=>{requests.push(o);assert.ok(outputs.length);return {output:structuredClone(outputs.shift()),usage:{},finalStep:{providerMetadata:{}}};}});}

test('UI and model use one action decision through offered, open, failed and stored phases',()=>{
 const s=state(),id=s.issue.id;assert.equal(portalActionState(s).phase,'ready');assert.equal(portalActionState(s).offerInReply,true);
 rememberPreparationOffer(s);assert.equal(portalActionState(s).phase,'preparation_offered');assert.equal(portalActionState(s).offerInReply,false);assert.ok(controls(s).save);
 s.portalDraftOpen={issueId:id,revision:s.issue.revision,status:'prepared'};assert.equal(portalActionState(s).phase,'form_open');assert.equal(controls(s).save,null);
 s.portalDraftOpen.status='error';assert.equal(portalActionState(s).phase,'preparation_failed');assert.ok(controls(s).save,'failed preparation must be retryable');assert.equal(controls(s).prepared,null);
 s.portalDraftOpen=null;s.issue.preparation={status:'portal_received',receipt:{contentHash:contentHash(s.issue)}};assert.equal(portalActionState(s).phase,'saved');assert.equal(controls(s).save,null);assert.equal(controls(s).stored.transmitted,false);
 assert.deepEqual(portalActionState(s).controls,controls(s));
});
test('a correction updates one stored issue and preserves negative observations',()=>{
 const s=state(),id=s.issue.id;s.issue.preparation={status:'portal_received',receipt:{contentHash:contentHash(s.issue)}};
 const p={intent:'issue',reply:'Sie können die Änderung prüfen.',actions:[],updates:[{ref:'active',quote:'Nein, Schlafzimmer.',location:'Schlafzimmer',correction:true}]};
 const after=projectDecision(s,'Nein, Schlafzimmer.',p);
 assert.equal(after.issues.length,1);assert.equal(after.issue.id,id);assert.equal(after.issue.details,'Sonst ist alles normal.');assert.equal(after.issue.count,1);
 assert.equal(portalActionState(after).phase,'changes_pending');assert.equal(controls(after).save.operation,'update');rememberPreparationOffer(after);assert.equal(portalActionState(after).offerInReply,false);
});
test('safety, other topics and missing native access all suppress form offers',()=>{
 const s=state();s.safety={hazard:'electric'};assert.equal(portalActionState(s).phase,'safety');assert.equal(controls(s).review,null);
 s.safety=null;s.conversationTopic='information';assert.equal(portalActionState(s).offerInReply,false);assert.equal(controls(s).save,null);
 s.conversationTopic='issue';assert.equal(portalActionState(s,[],false).phase,'unavailable');assert.equal(controls(s,[],false).save,null);
});
test('reply repair cannot replace extracted facts or produce a second issue',async()=>{
 const s=state();rememberPreparationOffer(s);const requests=[];
 const p={intent:'issue',reply:'Soll ich das Anliegen nochmals vorbereiten?',actions:[],updates:[{ref:'active',quote:'Nein, Schlafzimmer.',location:'Schlafzimmer',correction:true}]};
 const r=await fixture([p,{violations:[{kind:'repeated_offer',quote:p.reply,reason:'Das bestehende Angebot genügt.'}]},{reply:'Die Lampe befindet sich also im Schlafzimmer.'},{violations:[]}],requests)('Nein, Schlafzimmer.',s,['cases']);
 assert.equal(r.repairScope,'reply');assert.equal(r.modelCalls,4);assert.equal(r.state.issues.length,1);assert.equal(r.state.issue.id,s.issue.id);
 assert.equal(r.state.issue.location,'Schlafzimmer');assert.equal(r.state.issue.details,'Sonst ist alles normal.');assert.equal(r.state.issue.count,1);
 assert.match(requests[2].instructions,/REPLY-ONLY REPAIR/);const a=JSON.parse(requests[1].messages[0].content);assert.equal(a.actionState.offerInReply,false);assert.equal(a.actionState.controls.save.operation,'create');
});
test('injected data in a reply-only repair is rejected without committing it',async()=>{
 const s=state(),before=structuredClone(s),p={intent:'issue',reply:'Nochmals vorbereiten?',actions:[],updates:[]};
 await assert.rejects(fixture([p,{violations:[{kind:'repeated_offer',quote:p.reply,reason:'Schon angeboten.'}]},{reply:'Erfasst.',updates:[{ref:'new1',quote:'Ja',equipment:'socket'}]}])('Ja',s,['cases']));assert.deepEqual(s,before);
});
test('missing facts still require a data repair, including the whole customer observation',async()=>{
 const s=state(),message='Seit gestern. Die andere Lampe funktioniert.',p={intent:'issue',reply:'Sie können die Angaben prüfen.',actions:[],updates:[{ref:'active',quote:'Seit gestern.',since:'gestern'}]};
 const fixed={...p,updates:[{ref:'active',quote:message,since:'gestern',details:'Die andere Lampe funktioniert.'}]};
 const requests=[];
 const r=await fixture([p,{violations:[{kind:'missing_fact',quote:'Die andere Lampe funktioniert.',reason:'Die ergänzende Beobachtung fehlt.'}]},fixed,{violations:[]}],requests)(message,s,['cases']);
 assert.equal(requests[0].reasoning,'low');assert.equal(requests[2].reasoning,'high');
 assert.equal(r.repairScope,'decision');assert.match(r.state.issue.details,/Sonst ist alles normal/);assert.match(r.state.issue.details,/andere Lampe funktioniert/);assert.equal(r.state.issue.since,'gestern');
});

test('truthful negative delivery statements are not mistaken for a success',()=>{
 for(const reply of ['Es wurde noch nichts gesendet.','Nein, ich habe nichts an MORADA gesendet.','Die Meldung wurde nicht an MORADA gesendet.','Wir haben keinen Auftrag beauftragt.'])assert.equal(hasUnconfirmedSuccess(reply),false,reply);
 for(const reply of ['Ich habe das Anliegen gesendet.','Es wurde bereits gespeichert.','Ich habe nicht nur gespeichert, sondern auch versendet.','Es wurde noch nichts gesendet; ich habe aber einen Auftrag beauftragt.'])assert.equal(hasUnconfirmedSuccess(reply),true,reply);
});
test('an independent detail question is not blocked by an existing unrelated detail',()=>{
 const s=state(),p={intent:'issue',reply:'Kommen Sie noch in die Wohnung?',ask:{field:'details',ref:'active'},updates:[],actions:[]};
 assert.doesNotThrow(()=>validatePortalPlan(p,s,s,['cases']));
 assert.throws(()=>validatePortalPlan({...p,ask:{field:'location',ref:'active'}},s,s,['cases']),/repeats answered field/);
});
test('outstanding messages are sent once as current evidence, not duplicated in history',async()=>{
 const s=hydrateSimple(null);s.portalJournal=[{role:'user',content:'Die Lampe geht nicht.',id:'pending-1'}];s.portalPending=[{content:'Die Lampe geht nicht.',id:'pending-1'}];
 const requests=[],message='Die Lampe geht nicht.\nIm Wohnzimmer.',p={intent:'issue',reply:'Sie können die Angaben prüfen.',updates:[{ref:'new1',quote:message,equipment:'light',defect:'geht nicht',location:'Wohnzimmer'}],actions:[]};
 const r=await fixture([p,{violations:[]}],requests)(message,s,['cases']);
 assert.equal(requests[0].messages.length,1);assert.equal(requests[0].messages[0].content,message);assert.equal(r.state.issues.length,1);assert.equal(r.state.issue.location,'Wohnzimmer');
});
