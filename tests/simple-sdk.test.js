// Actual installed SDK execution with an explicitly mocked transport. Not live evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MockLanguageModelV4} from 'ai/test';
import {generateSimpleStage} from '../lib/mora/simple/model.js';
import {createSimpleService} from '../lib/mora/simple/service.js';
import {hydrateSimple} from '../lib/mora/simple/state.js';

function selection(outputs){let index=0;
 const model=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async()=>({
  content:[{type:'text',text:typeof outputs[index]==='string'?outputs[index++]:JSON.stringify(outputs[index++])}],
  finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:10,noCache:10,cacheRead:0},outputTokens:{total:10,text:10,reasoning:0}},warnings:[],
 })});
 return {provider:'gateway',model:'inception/mercury-2.5',ready:true,createModel:()=>model,sdk:model};
}
const decision=reply=>({reply,intent:'issue',updates:[{ref:'new1',quote:'Lampe kaputt',equipment:'light',defect:'kaputt'}],ask:{field:'location'},actions:[]});
test('Installed SDK accepts C context and repair through instructions, without system entries in messages',async()=>{
 const s=selection([decision('Wo befindet sich die Lampe?')]);
 const r=await generateSimpleStage('decision',{context:{scope:'test'},history:[],message:'Lampe kaputt',repair:[{kind:'contract',reason:'test'}]},s,1000);
 assert.equal(r.data.reply,'Wo befindet sich die Lampe?');assert.equal(s.sdk.doGenerateCalls.length,1);
 const prompt=s.sdk.doGenerateCalls[0].prompt;
 assert.match(prompt[0].content,/Verified application context/);assert.match(prompt[0].content,/previous candidate was rejected/);
 assert.equal(prompt.at(-1).role,'user');assert.equal(prompt.at(-1).content[0].text,'Lampe kaputt');
});
test('Complete C service crosses the real SDK for decision, read-only check and bounded repair',async()=>{
 const s=selection([decision('Der Entwurf liegt bereit.'),{violations:[{kind:'unsupported_effect',quote:'Entwurf liegt bereit',reason:'No receipt'}]},decision('Wo befindet sich die Lampe?'),{violations:[]}]);
 const service=createSimpleService({resolve:async()=>s});
 const r=await service('Lampe kaputt',hydrateSimple(null),5000);
 assert.equal(s.sdk.doGenerateCalls.length,4);assert.equal(r.modelCalls,4);assert.equal(r.reply,'Wo befindet sich die Lampe?');assert.equal(r.state.pendingKey,'location');assert.equal(r.state.issue.preparation.status,'not_prepared');
 assert.ok(!JSON.stringify(r.state.history).includes('liegt bereit'));
});
test('Unreadable native JSON is repaired once through the actual SDK path',async()=>{
 const s=selection(['not json',decision('Wo ist die Lampe?'),{violations:[]}]);
 const r=await createSimpleService({resolve:async()=>s})('Lampe kaputt',hydrateSimple(null),5000);
 assert.equal(r.modelCalls,3);assert.equal(r.repaired,true);assert.equal(r.state.issue.equipment,'light');
});
