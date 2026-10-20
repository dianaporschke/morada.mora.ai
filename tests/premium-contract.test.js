// Mock-based integration tests of contracts and boundaries, NOT model quality evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV4 } from 'ai/test';
import { generateUnderstandingResult } from '../lib/mora/understanding.js';
import { processTurn } from '../lib/mora/engine.js';
import { readPortalContext } from '../lib/mora/portal-context.js';
import { createChatHandler } from '../api/chat.js';
import { emptyUnderstanding } from '../lib/mora/schema.js';

const model=(output,inspect=()=>{})=>new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async options=>{
  inspect(options);
  return {content:[{type:'text',text:JSON.stringify(output)}],finishReason:{unified:'stop',raw:'stop'},warnings:[],
    usage:{inputTokens:{total:100,noCache:100,cacheRead:0,cacheWrite:0},outputTokens:{total:60,text:50,reasoning:10}}};
}});
const response=()=>({statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});

test('Compact contract preserves genuinely model-written response and arbitrary customer-named fixtures',async()=>{
  const reply='Können Sie den Rollladen noch bewegen oder sitzt er ganz fest?';
  const output={reply,intent:'issue',updates:[{ref:'new',equipment:'Rollladen',location:'Arbeitszimmer',defect:'steckt fest',details:'Morgen 14–16 Uhr erreichbar'}]};
  const result=await generateUnderstandingResult('Der Rollladen im Arbeitszimmer steckt fest. Morgen 14–16 Uhr bin ich erreichbar.',null,model(output,options=>{
    const instructions=options.prompt.filter(item=>item.role==='system').map(item=>item.content).join('');
    assert.match(instructions,/"updates"/);assert.doesNotMatch(instructions,/"additionalIssues":/);
  }));
  const turn=await processTurn({message:'Rollladen steckt fest'},null,async()=>({mode:'model',data:result.data}));
  assert.equal(turn.reply,reply);assert.equal(turn.state.issue.shortLabel,'Rollladen');
  assert.equal(turn.state.issue.defect,'steckt fest');assert.match(turn.state.issue.details,/14–16/);
});

test('Compact multi-issue updates keep separate sources, unknown values and corrections',async()=>{
  const message='Heizung im Wohnzimmer kalt. Im Bad tropft es, Beginn weiss ich nicht.';
  const output={reply:'Tritt das Wasser weiterhin aus?',intent:'issue',updates:[
    {ref:'new',category:'heating',equipment:'heater',location:'Wohnzimmer',defect:'bleibt kalt',sourceQuote:'Heizung im Wohnzimmer kalt'},
    {ref:'new',category:'water',equipment:'leak',location:'Badezimmer',sourceQuote:'Im Bad tropft es, Beginn weiss ich nicht',unknownAnswers:[{field:'since',quote:'Beginn weiss ich nicht'}]},
  ],ask:{field:'extent',text:'Tritt das Wasser weiterhin aus?',issueIndex:1}};
  const result=await generateUnderstandingResult(message,null,model(output));
  const turn=await processTurn({message},null,async()=>({mode:'model',data:result.data}));
  assert.equal(turn.state.issues.length,2);assert.equal(turn.state.issues[0].location,'Wohnzimmer');
  assert.equal(turn.state.issues[1].location,'Badezimmer');assert.deepEqual(turn.state.issues[1].unknownFields,['since']);
  assert.equal(turn.state.issue.id,turn.state.issues[1].id);
  const corrected=await generateUnderstandingResult('Nein, die Heizung ist im Schlafzimmer.',turn.state,model({reply:'Betrifft es dort alle Heizkörper?',intent:'issue',
    updates:[{ref:'other1',correction:true,location:'Schlafzimmer'}]}));
  const next=await processTurn({message:'Nein, die Heizung ist im Schlafzimmer.'},turn.state,async()=>({mode:'model',data:corrected.data}));
  assert.equal(next.state.issues.length,2);assert.equal(next.state.issues[0].location,'Schlafzimmer');assert.equal(next.state.issues[1].location,'Badezimmer');
});

test('A compact proposed send action cannot become an executable portal operation',async()=>{
  await assert.rejects(generateUnderstandingResult('Melden',null,model({reply:'Alles erledigt.',intent:'contact',actions:[{kind:'submit_request'}]})),{type:'invalid_model_output'});
});

test('Failed generations retain known token usage and call count without exposing model text',async()=>{
  await assert.rejects(generateUnderstandingResult('Hallo',null,model({reply:'Hallo',intent:'greeting',actions:[{kind:'delete_everything'}]})),error=>{
    assert.equal(error.generationCount,2);assert.equal(error.totalUsage.inputTokens,200);
    assert.equal(error.totalUsage.outputTokens,120);assert.doesNotMatch(error.message,/delete_everything/);return true;
  });
});

test('Trusted portal context validates property scope and supports both roles without inventing data APIs',async()=>{
  const fixture={version:1,status:'verified',properties:[{id:'p1',label:'Wohnung A',unitId:'u1',roles:['tenant','owner']}],selectedPropertyId:'p1'};
  assert.deepEqual(await readPortalContext({},async()=>fixture),fixture);
  const invalid=await readPortalContext({},async()=>({...fixture,selectedPropertyId:'p2'}));assert.equal(invalid.status,'unavailable');
  const unavailable=await readPortalContext({},async()=>{throw new Error('sensitive upstream error');});assert.equal(unavailable.status,'unavailable');
  let captured;
  await generateUnderstandingResult('Was gibt es Neues?',null,model({reply:'Welche Information suchen Sie?',intent:'property'},options=>{captured=JSON.stringify(options.prompt);}),{portalContext:fixture});
  assert.match(captured,/Wohnung A/);assert.match(captured,/tenant/);assert.match(captured,/owner/);assert.match(captured,/personalRecords/);
});

test('HTTP clients cannot supply roles or permissions; only the server loader populates model options',async()=>{
  let loaded=0,options;
  const fixture={version:1,status:'verified',properties:[{id:'p1',label:'Wohnung A',unitId:'u1',roles:['tenant']}],selectedPropertyId:null};
  const handler=createChatHandler(async(message,state,inputOptions)=>{
    options=inputOptions;return {mode:'model',data:emptyUnderstanding({intent:'greeting',dialogue:{reply:'Grüezi.',stage:'information',buttons:[]}})};
  },{loadPortalContext:async()=>{loaded++;return fixture;}});
  let res=response();await handler({method:'POST',body:{message:'Ich bin Eigentümer',roles:['owner']}},res);
  assert.equal(res.statusCode,400);assert.equal(loaded,0);
  res=response();await handler({method:'POST',body:{message:'Ich bin Eigentümer'}},res);
  assert.equal(res.statusCode,200);assert.equal(loaded,1);assert.deepEqual(options.portalContext.properties[0].roles,['tenant']);
  assert.equal(res.body.capabilities.documents,false);assert.equal(res.body.capabilities.submitRequest,false);
});


test('Corrections remove stale original rooms and counts from the current handover description',async()=>{
  const reply={reply:'Welche Angaben möchten Sie ergänzen?',stage:'discuss',buttons:[]};
  const first=await processTurn({message:'Drei Steckdosen im Wohnzimmer gehen nicht.'},null,async()=>({mode:'model',data:emptyUnderstanding({intent:'issue',equipment:'socket',category:'electricity',count:3,location:'Wohnzimmer',defect:'ohne Funktion',dialogue:reply})}));
  const next=await processTurn({message:'Nein, zwei im Schlafzimmer.'},first.state,async()=>({mode:'model',data:emptyUnderstanding({intent:'issue',correction:true,count:2,location:'Schlafzimmer',dialogue:reply})}));
  assert.doesNotMatch(next.state.issue.description,/Wohnzimmer|Drei/);
  assert.match(next.state.issue.description,/Schlafzimmer/);assert.match(next.state.issue.description,/Anzahl: 2/);
  assert.match(next.state.issue.answers[0].answer,/Drei Steckdosen im Wohnzimmer/);
});
