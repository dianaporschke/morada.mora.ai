import test from 'node:test';
import assert from 'node:assert/strict';
import {MockLanguageModelV4} from 'ai/test';
import {createUnderstandingService,generateUnderstandingResult} from '../lib/mora/understanding.js';
import {generateNaturalReply} from '../lib/mora/reply.js';
import {createChatHandler} from '../api/chat.js';
import {readSession} from '../lib/mora/session.js';
import {acceptPreparationProposal} from '../lib/mora/actions.js';
import {modelUnavailable} from '../lib/mora/provider.js';

const sdk=(generate,tokens=50)=>new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async options=>({
 content:[{type:'text',text:JSON.stringify(generate(options))}],finishReason:{unified:'stop',raw:'stop'},warnings:[],
 usage:{inputTokens:{total:tokens,noCache:tokens,cacheRead:0,cacheWrite:0},outputTokens:{total:20,text:20,reasoning:0}},
})});
const service=model=>createUnderstandingService({resolve:async()=>({ready:true,provider:'gateway',model:'inception/mercury-2.5',createModel:()=>model}),log(){}});
async function invoke(handler,body){const r={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;}};await handler({method:'POST',body},r);return r;}

test('Customer wording receives validated facts and actions, never the untrusted planner sentence',async()=>{
 const planner=sdk(()=>({reply:'Ich habe den Entwurf bereits vorbereitet.',intent:'issue',updates:[{ref:'new',equipment:'light',location:'Wohnzimmer',defect:'geht nicht'}],actions:[{kind:'prepare_draft'}]}),100);
 const finalReply='Sie können die Angaben im Servicebereich prüfen.';
 const wording=sdk(options=>{
  const systems=options.prompt.filter(message=>message.role==='system').map(message=>message.content).join('\n');
  assert.ok(systems.includes('"draftExists":false'));assert.ok(systems.includes('"location":"Wohnzimmer"'));assert.ok(systems.includes('"currentActions":[{"type":"handover"'));
  assert.ok(!systems.includes('Ich habe den Entwurf bereits vorbereitet'));assert.ok(!systems.includes('verifiedReply'));
  assert.equal(options.prompt.at(-1).content[0].text,'Lampe im Wohnzimmer geht nicht.');
  return {reply:finalReply,questionKey:null};
 });
 const result=await invoke(createChatHandler(service(planner),{env:{},compose:turn=>generateNaturalReply(turn,wording)}),{message:'Lampe im Wohnzimmer geht nicht.'});
 assert.equal(result.code,200);assert.equal(result.data.modelCalls,2);assert.equal(result.data.modelUsage.inputTokens,150);
 assert.equal(result.data.reply,finalReply);assert.equal(result.data.issue.equipment,'light');assert.equal(result.data.actions[0].type,'handover');
 assert.deepEqual(readSession(result.data.session).history.map(item=>item.content),['Lampe im Wohnzimmer geht nicht.',finalReply]);
});

test('Wording knows that a new heater issue has no existing lamp draft; a false merge claim is genuinely regenerated',async()=>{
 let round=0;
 const planner=sdk(()=>round++===0
  ? {reply:'Vorbereitet.',intent:'issue',updates:[{ref:'new',equipment:'light',location:'Wohnzimmer',defect:'geht nicht'}],actions:[{kind:'prepare_draft'}]}
  : {reply:'Fügen Sie das zum bestehenden Entwurf hinzu.',intent:'issue',updates:[{ref:'new',equipment:'heater',location:'Bad',defect:'bleibt kalt'}],actions:[{kind:'prepare_draft'}]},100);
 const handler=createChatHandler(service(planner),{env:{},compose:turn=>{
  let attempts=0;
  return generateNaturalReply(turn,sdk(options=>{
   const context=options.prompt.filter(item=>item.role==='system').map(item=>item.content).join('\n');
   assert.ok(context.includes('"draftExists":false'));
   if(turn.state.issue.equipment==='heater'){
    assert.ok(context.includes('"otherIssues":[{"equipment":"light"'));
    return {reply:++attempts===1?'Sie können dies zum bestehenden Entwurf hinzufügen.':'Der Button bereitet dafür einen eigenen Entwurf vor.',questionKey:null};
   }
   return {reply:'Sie können das Anliegen vorbereiten.',questionKey:null};
  }));
 }});
 let result=await invoke(handler,{message:'Meine Lampe im Wohnzimmer geht nicht.'});assert.equal(result.code,200);
 const lampId=result.data.issue.id;
 result=await invoke(handler,{session:result.data.session,draftReceipt:{issueId:lampId,revision:result.data.issue.revision,status:'portal_received'}});assert.equal(result.code,200);assert.equal(result.data.modelCalls,0);
 result=await invoke(handler,{session:result.data.session,message:'Ausserdem bleibt die Heizung im Bad kalt.'});
 assert.equal(result.code,200);assert.equal(result.data.modelCalls,3);assert.equal(result.data.modelUsage.inputTokens,200);
 assert.equal(result.data.reply,'Der Button bereitet dafür einen eigenen Entwurf vor.');assert.equal(result.data.issues.length,2);
 assert.equal(result.data.issues.find(issue=>issue.id===lampId).preparation.status,'portal_received');assert.equal(result.data.issue.preparation.status,'not_prepared');
 assert.equal(result.data.actions[0].label,'Für MORADA vorbereiten');
});

test('A thank-you after the confirmed handover needs only one model generation',async()=>{
 let round=0,wordings=0;
 const planner=sdk(()=>round++===0?{reply:'Planung.',intent:'issue',updates:[{ref:'new',equipment:'light',location:'Wohnzimmer',defect:'kaputt'}],actions:[{kind:'prepare_draft'}]}:{reply:'Gerne.',intent:'general'},100);
 const handler=createChatHandler(service(planner),{env:{},compose:turn=>{wordings++;return generateNaturalReply(turn,sdk(()=>({reply:'Sie können das Anliegen vorbereiten.',questionKey:null})));}});
 let result=await invoke(handler,{message:'Lampe im Wohnzimmer kaputt'});assert.equal(result.code,200);assert.equal(result.data.modelCalls,2);
 result=await invoke(handler,{session:result.data.session,draftReceipt:{issueId:result.data.issue.id,revision:result.data.issue.revision,status:'portal_received'}});
 result=await invoke(handler,{session:result.data.session,message:'danke'});
 assert.equal(result.code,200);assert.equal(result.data.modelCalls,1);assert.equal(wordings,1);assert.equal(result.data.reply,'Gerne.');assert.equal(result.data.actions.length,0);
});

test('The Sie-form cannot repeat preparation verbally after the existing offer, even without another button',async()=>{
 const handler=createChatHandler(service(sdk(()=>({reply:'Planung.',intent:'issue',updates:[{ref:'new',equipment:'light',location:'Wohnzimmer',defect:'kaputt'}],actions:[{kind:'prepare_draft'}]}))),{env:{},compose:turn=>generateNaturalReply(turn,sdk(()=>({reply:'Sie können das Anliegen vorbereiten.',questionKey:null})))});
 const first=await invoke(handler,{message:'Lampe im Wohnzimmer kaputt'});assert.equal(first.code,200);
 let calls=0;
 const result=await generateUnderstandingResult('Seit gestern.',readSession(first.data.session),sdk(()=>({reply:++calls===1?'Den Entwurf können Sie vorbereiten, falls Sie bereit sind.':'Alles klar.',intent:'issue',updates:[{ref:'active',since:'gestern'}]})),{planOnly:true});
 assert.equal(calls,2);assert.equal(result.data.since,'gestern');assert.equal(result.data.dialogue.buttons.length,0);assert.equal(result.data.dialogue.reply,'Alles klar.');
});

test('A typed preparation request from verified-state wording becomes exactly one signed button, not a created draft',async()=>{
 const planner=sdk(()=>({reply:'Aufgenommen.',intent:'issue',updates:[{ref:'new',equipment:'heater',location:'Bad',count:2,defect:'bleiben kalt'}]}));
 const handler=createChatHandler(service(planner),{env:{},compose:turn=>generateNaturalReply(turn,sdk(()=>({reply:'Den Entwurf können Sie vorbereiten.',questionKey:null,requestPreparation:true})))});
 let result=await invoke(handler,{message:'Zwei Heizkörper im Bad bleiben kalt.'});assert.equal(result.code,200);
 assert.equal(result.data.modelCalls,2);assert.equal(result.data.actions.length,1);assert.equal(result.data.actions[0].label,'Für MORADA vorbereiten');
 const state=readSession(result.data.session);assert.equal(state.issue.draftOfferShown,true);assert.equal(state.issue.preparation.status,'not_prepared');
 acceptPreparationProposal(state);assert.equal(state.actions.length,1,'same proposal is idempotent');
 result=await invoke(handler,{session:result.data.session,draftReceipt:{issueId:state.issue.id,revision:state.issue.revision,status:'portal_received'}});
 assert.equal(result.code,200);assert.equal(result.data.modelCalls,0);assert.equal(result.data.actions.length,0);
 assert.throws(()=>acceptPreparationProposal(readSession(result.data.session)),{code:'INVALID_ACTION'});
});

test('A wording request cannot add preparation to a clarification; the real repair retains only the question',async()=>{
 const planner=sdk(()=>({reply:'Wo ist die Lampe?',intent:'issue',updates:[{ref:'new',equipment:'light',defect:'kaputt'}],ask:{field:'location',text:'Wo ist die Lampe?'}}));
 let attempts=0;
 const handler=createChatHandler(service(planner),{env:{},compose:turn=>generateNaturalReply(turn,sdk(()=>({reply:'In welchem Raum ist die Lampe?',questionKey:'location',requestPreparation:++attempts===1})))});
 const result=await invoke(handler,{message:'Lampe kaputt'});
 assert.equal(result.code,200);assert.equal(result.data.modelCalls,3);assert.equal(attempts,2);assert.equal(result.data.actions.length,0);
 assert.equal(readSession(result.data.session).pendingKey,'location');assert.ok(!result.data.issue.draftOfferShown);
});

test('A failed optional wording pass retains a separately validated real planner reply and exposes degradation',async()=>{
 const reply='Sie können das Anliegen vorbereiten.';
 const planner=sdk(()=>({reply,intent:'issue',updates:[{ref:'new',equipment:'light',location:'Wohnzimmer',defect:'kaputt'}],actions:[{kind:'prepare_draft'}]}),100);
 const handler=createChatHandler(service(planner),{env:{},compose:async()=>{throw Object.assign(modelUnavailable({provider:'gateway',model:'inception/mercury-2.5',status:null,reason:'invalid_model_output'}),{modelCalls:2,modelUsage:{inputTokens:50,outputTokens:20,reasoningTokens:0,cachedInputTokens:0}});}});
 const result=await invoke(handler,{message:'Lampe im Wohnzimmer kaputt'});
 assert.equal(result.code,200);assert.equal(result.data.modelCalls,3);assert.equal(result.data.modelUsage.inputTokens,150);
 assert.equal(result.data.reply,reply);assert.equal(result.data.responseMode,'model');assert.equal(result.data.wordingFallback,'validated_model');assert.equal(result.data.degraded,true);assert.equal(result.data.recoveredFacts,false);
 assert.equal(result.data.issue.equipment,'light');assert.equal(result.data.actions.length,1);assert.equal(readSession(result.data.session).history.at(-1).content,reply);
});

test('Unsafe planner wording is never reused on wording failure; facts and local review remain explicit technical recovery',async()=>{
 const planner=sdk(()=>({reply:'Ich habe den Entwurf bereits vorbereitet.',intent:'issue',updates:[{ref:'new',equipment:'light',location:'Wohnzimmer',count:1,defect:'kaputt'}],actions:[{kind:'prepare_draft'}]}));
 const handler=createChatHandler(service(planner),{env:{},compose:async()=>{throw modelUnavailable({provider:'gateway',model:'inception/mercury-2.5',status:429,reason:'rate_limit_exceeded'});}});
 const result=await invoke(handler,{message:'Eine Lampe im Wohnzimmer ist kaputt.'});
 assert.equal(result.code,200);assert.equal(result.data.responseMode,'recovery');assert.equal(result.data.wordingFallback,'facts_recovery');assert.equal(result.data.degraded,true);assert.equal(result.data.recoveredFacts,true);
 assert.match(result.data.reply,/Technischer Hinweis/);assert.ok(!result.data.reply.includes('bereits vorbereitet'));assert.equal(result.data.issue.equipment,'light');assert.equal(result.data.issue.count,1);assert.equal(result.data.issue.location,'Wohnzimmer');
 assert.equal(result.data.issue.preparation.status,'not_prepared');assert.equal(result.data.actions.length,1);assert.equal(result.data.actions[0].type,'handover');
});
