import test from 'node:test';
import assert from 'node:assert/strict';
import {MockLanguageModelV4} from 'ai/test';
import {createUnderstandingService} from '../lib/mora/understanding.js';
import {generateNaturalReply} from '../lib/mora/reply.js';
import {createChatHandler} from '../api/chat.js';
import {readSession} from '../lib/mora/session.js';

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
