import test from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV4 } from 'ai/test';
import { generateUnderstandingResult } from '../lib/mora/understanding.js';
import { generateNaturalReply } from '../lib/mora/reply.js';
import { emptyUnderstanding } from '../lib/mora/schema.js';
import { processTurn } from '../lib/mora/engine.js';
import { estimateTokenCost } from '../lib/mora/costs.js';
import { classifyModelError } from '../lib/mora/provider.js';

function mercury(output, inspect = () => {}) {
  const {unknownFields,topic,answer,hazard,confidence,question,clarification,...rest}=output;
  const contractOutput=unknownFields ? {...rest,dialogue:output.dialogue && {reply:output.dialogue.reply,buttons:output.dialogue.buttons,...(question && clarification ? {ask:{field:question,text:clarification}} : {})},risk:hazard==='water' ? 'flood' : hazard,sourceQuote:output.sourceQuote || null,
    additionalIssues:output.additionalIssues.map(({hazard,...issue})=>({...issue,risk:hazard==='water' ? 'flood' : hazard,sourceQuote:issue.sourceQuote || null})),
    unknownAnswers:output.unknownAnswers || []} : output;
  return new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async options => {
    inspect(options);
    return {content:[{type:'text',text:JSON.stringify(contractOutput)}],
      finishReason:{unified:'stop',raw:'stop'},
      usage:{inputTokens:{total:200,noCache:200,cacheRead:0,cacheWrite:0},outputTokens:{total:100,text:100,reasoning:0}},warnings:[]};
  }});
}

test('Mercury uses supported JSON mode with the complete schema in system instructions', async () => {
  let calls = 0;
  const expected = emptyUnderstanding({intent:'issue',category:'electricity',equipment:'socket',location:'Schlafzimmer',question:'since',clarification:'Seit wann funktioniert sie nicht?',
    dialogue:{reply:'Die Steckdose im Schlafzimmer ist aufgenommen. Seit wann funktioniert sie nicht?',stage:'clarify',buttons:[]}});
  const result = await generateUnderstandingResult('Steckdose im Schlafzimmer kaputt', null, mercury(expected, options => {
    calls++;
    assert.equal(options.responseFormat.type, 'json');
    assert.equal(options.responseFormat.schema, undefined);
    assert.equal(options.tools, undefined);
    assert.equal(options.providerOptions.inception.reasoningEffort,'medium');
    assert.match(JSON.stringify(options.prompt), /unknownAnswers/);
    assert.match(JSON.stringify(options.prompt), /additionalProperties/);
    assert.match(JSON.stringify(options.prompt), /Steckdose im Schlafzimmer kaputt/);
  }));
  assert.deepEqual(result.data, expected); assert.equal(calls, 1);
  assert.equal(result.usage.inputTokens, 200);
  assert.equal(estimateTokenCost('inception/mercury-2.5',result.usage),0.000023);
});

test('A sparse genuine greeting needs no unrelated damage facts, placeholder arrays or second model call',async()=>{
  let calls=0;
  const output={intent:'greeting',dialogue:{reply:'Grüezi! Wie kann ich Ihnen helfen?'}};
  const result=await generateUnderstandingResult('Hey',null,mercury(output,options=>{calls++;assert.equal(options.providerOptions.inception.reasoningEffort,'medium');}));
  assert.equal(calls,1);assert.equal(result.data.dialogue.reply,output.dialogue.reply);
  assert.equal(result.data.category,null);assert.equal(result.data.count,null);assert.equal(result.data.hazard,'none');
  assert.deepEqual(result.data.additionalIssues,[]);assert.deepEqual(result.data.unknownFields,[]);assert.deepEqual(result.data.dialogue.buttons,[]);
});

test('The SDK resolves additional existing-issue updates solely against signed context references',async()=>{
  const heater={id:'heater-id',category:'heating',equipment:'heater',answers:[],attempts:{},unknownFields:[]};
  const water={id:'water-id',category:'water',equipment:'leak',location:'Bad',answers:[],attempts:{},unknownFields:[]};
  const output={intent:'issue',targetIssueId:'active',category:'heating',equipment:'heater',location:'Wohnzimmer',sourceQuote:'Heizung im Wohnzimmer',
    additionalIssues:[{targetIssueId:'other1',equipment:'pipe',since:'heute',sourceQuote:'Beim Wasser das Rohr seit heute'}],
    dialogue:{reply:'Die Heizung ist im Wohnzimmer; das Rohr tropft seit heute.'}};
  const result=await generateUnderstandingResult('Heizung im Wohnzimmer. Beim Wasser das Rohr seit heute',{issue:heater,issues:[heater,water]},mercury(output));
  assert.equal(result.data.targetIssueId,heater.id);
  assert.equal(result.data.additionalIssues[0].targetIssueId,water.id);
  assert.equal(result.data.additionalIssues[0].equipment,'pipe');
});

test('An invented additional-issue reference is rejected before either existing draft changes',async()=>{
  const heater={id:'heater-id',category:'heating',equipment:'heater',answers:[],attempts:{},unknownFields:[]};
  const water={id:'water-id',category:'water',equipment:'leak',location:'Bad',answers:[],attempts:{},unknownFields:[]};
  const state={issue:heater,issues:[heater,water]}; const before=structuredClone(state);
  const output={intent:'issue',sourceQuote:'Heizung im Wohnzimmer',location:'Wohnzimmer',
    additionalIssues:[{targetIssueId:'other99',equipment:'pipe',sourceQuote:'Wasser aus dem Rohr'}],dialogue:{reply:'Die Angaben sind aufgenommen.'}};
  await assert.rejects(generateUnderstandingResult('Heizung im Wohnzimmer; Wasser aus dem Rohr',state,mercury(output)),{type:'invalid_model_output'});
  assert.deepEqual(state,before);
});

test('A simple correction is regenerated as acknowledgement rather than restarting qualification',async()=>{
  let calls=0;
  const issue={id:'socket-id',equipment:'socket',category:'electricity',location:'Wohnzimmer',unknownFields:['since'],attempts:{},answers:[]};
  const sdk=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async()=>{
    calls++;
    const output={intent:'issue',correction:true,location:'Schlafzimmer',dialogue:{reply:calls===1 ? 'Im Schlafzimmer. Sind weitere Steckdosen betroffen?' : 'Die Steckdose ist im Schlafzimmer.',
      ...(calls===1 ? {ask:{field:'extent',text:'Sind weitere Steckdosen betroffen?'}} : {})}};
    return {content:[{type:'text',text:JSON.stringify(output)}],finishReason:{unified:'stop',raw:'stop'},warnings:[],
      usage:{inputTokens:{total:100,noCache:100,cacheRead:0,cacheWrite:0},outputTokens:{total:100,text:100,reasoning:0}}};
  }});
  const result=await generateUnderstandingResult('Nein, im Schlafzimmer.',{issue,issues:[issue]},sdk);
  assert.equal(calls,2);assert.equal(result.data.location,'Schlafzimmer');assert.equal(result.data.question,null);
  assert.equal(result.data.dialogue.reply,'Die Steckdose ist im Schlafzimmer.');
});

test('Unknown cause is retained separately from physical location details and can later be supplied',async()=>{
  const result=await generateUnderstandingResult('bi mir tropfts unterm lavabo, weiss nöd warum',null,mercury({intent:'issue',category:'water',equipment:'leak',details:'unterm lavabo',
    unknownAnswers:[{field:'cause',quote:'weiss nöd warum'}],dialogue:{reply:'Seit wann tropft es unter dem Lavabo?',ask:{field:'since',text:'Seit wann tropft es?'}}}));
  let turn=await processTurn({message:'bi mir tropfts unterm lavabo, weiss nöd warum'},null,async()=>({mode:'model',data:result.data}));
  assert.equal(turn.state.issue.details,'unterm lavabo');assert.deepEqual(turn.state.issue.unknownFields,['cause']);
  turn=await processTurn({message:'Die Dichtung ist locker.'},turn.state,async()=>({mode:'model',data:emptyUnderstanding({intent:'issue',cause:'Die Dichtung ist locker.',dialogue:{reply:'Die Angabe zur Dichtung ist aufgenommen.',stage:'discuss',buttons:[]}})}));
  assert.equal(turn.state.issue.cause,'Die Dichtung ist locker.');assert.deepEqual(turn.state.issue.unknownFields,[]);
});

test('Unknown facts require direct provenance from this customer turn, not absent values or invented quotes',async()=>{
  const base=emptyUnderstanding({intent:'issue',equipment:'socket',dialogue:{reply:'Den Beginn können wir offenlassen.',stage:'discuss',buttons:[]}});
  const modelOutput={...base,unknownAnswers:[{field:'since',quote:'Keine Ahnung seit wann'}]};
  const missing=await generateUnderstandingResult('Meine Steckdose funktioniert nicht.',null,mercury(modelOutput));
  assert.deepEqual(missing.data.unknownFields,[]);
  const explicit=await generateUnderstandingResult('Keine Ahnung seit wann',null,mercury(modelOutput));
  assert.deepEqual(explicit.data.unknownFields,['since']); assert.equal(explicit.data.since,null);
  assert.equal(explicit.data.unknownAnswers,undefined);
});

test('One genuine corrective generation can repair a capability violation; tokens and failed attempt stay accounted',async()=>{
  let calls=0,invalid=0;
  const base=emptyUnderstanding({intent:'contact',dialogue:{reply:'Möchten Sie die Meldung jetzt absenden?',stage:'offer_draft',buttons:[]}});
  const {unknownFields,topic,answer,hazard,confidence,question,clarification,...rest}=base;
  const model=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async options=>{
    calls++;
    if(calls===2) assert.match(JSON.stringify(options.prompt),/previous JSON was rejected/);
    if(calls===2) assert.equal(options.prompt.filter(message=>message.role==='user').length,1,'Correction must not impersonate a customer turn');
    const output={...rest,risk:hazard,sourceQuote:null,unknownAnswers:[],dialogue:{reply:calls===1 ? rest.dialogue.reply : 'Ich kann den lokalen Entwurf öffnen. Der direkte Versand ist noch nicht angebunden.'}};
    return {content:[{type:'text',text:JSON.stringify(output)}],finishReason:{unified:'stop',raw:'stop'},warnings:[],
      usage:{inputTokens:{total:200,noCache:200,cacheRead:0,cacheWrite:0},outputTokens:{total:100,text:80,reasoning:20}}};
  }});
  const result=await generateUnderstandingResult('Direkt melden bitte',null,model,{logInvalid:error=>{
    invalid++;assert.equal(error.usage.inputTokens,200);assert.ok(error.validationFields.includes('dialogue.reply:unsupported_delivery_claim'));
  }});
  assert.equal(calls,2);assert.equal(invalid,1);assert.equal(result.generationCount,2);
  assert.equal(result.totalUsage.inputTokens,400);assert.equal(result.totalUsage.outputTokens,200);
  assert.equal(result.totalUsage.outputTokenDetails.reasoningTokens,40);assert.equal(result.usage.inputTokens,200);
  assert.ok(result.data.dialogue.reply.includes('lokalen Entwurf'));
});

test('Multi-issue rooms require disjoint customer sources and cannot leak from water into heating',async()=>{
  const message='Meine Heizung funktioniert nicht und im Badezimmer tropft Wasser.';
  const heater='Meine Heizung funktioniert nicht',water='im Badezimmer tropft Wasser';
  const base=emptyUnderstanding({intent:'issue',category:'heating',equipment:'heater',confidence:'clear',
    description:heater,sourceQuote:heater,dialogue:{reply:'Ich habe Heizung und Tropfen als getrennte Anliegen aufgenommen.',stage:'discuss',buttons:[]},
    additionalIssues:[{category:'water',equipment:'leak',description:water,sourceQuote:water,subcategory:null,defect:null,count:null,location:'Badezimmer',since:null,extent:null,details:null,urgency:'normal',hazard:'none'}]});
  let calls=0;
  const responseModel=mercury(base);
  const model=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async options=>{
    calls++;
    const result=await responseModel.doGenerate(options);
    const output=JSON.parse(result.content[0].text);
    output.location=calls===1 ? 'Badezimmer' : null;
    return {...result,content:[{type:'text',text:JSON.stringify(output)}]};
  }});
  const result=await generateUnderstandingResult(message,null,model);
  assert.equal(calls,2);assert.equal(result.data.location,null);assert.equal(result.data.hazard,'none');
  assert.equal(result.data.additionalIssues[0].location,'Badezimmer');assert.equal(result.data.additionalIssues[0].hazard,'none');
  assert.equal(result.data.sourceQuote,undefined);assert.equal(result.data.additionalIssues[0].sourceQuote,undefined);
});

test('Repeated invalid JSON data stops after two generations instead of an unbounded repair loop',async()=>{
  let calls=0;
  await assert.rejects(generateUnderstandingResult('Hey',null,mercury({...emptyUnderstanding(),intent:'invalid',dialogue:{reply:'Hallo',stage:'information',buttons:[]}},()=>{calls++;})),
    error=>error.type==='invalid_model_output');
  assert.equal(calls,2);
});

test('A Gateway-wrapped local timeout is distinguished from provider 500 errors', () => {
  const selection = {provider:'gateway',model:'inception/mercury-2.5'};
  const error = Object.assign(new Error('Wrapped transport error'),{type:'response_error',statusCode:500,cause:new DOMException('Deadline reached','TimeoutError')});
  assert.equal(classifyModelError(error,selection).reason,'model_timeout');
  delete error.cause;
  assert.equal(classifyModelError(error,selection).reason,'response_error');
});

test('Mercury JSON cannot add executable actions and invalid usage remains accounted', async () => {
  await assert.rejects(generateUnderstandingResult('Hey',null,mercury({...emptyUnderstanding(),actions:[{type:'submit'}]})),
    error => error.type === 'invalid_model_output' && error.usage.inputTokens === 200);
});

test('Mercury JSON reply retains the question contract and does not mutate portal actions', async () => {
  const turn = await processTurn({message:'Meine Steckdose funktioniert nicht.'},null,async () => ({mode:'model',data:emptyUnderstanding({intent:'issue',confidence:'clear',category:'electricity',equipment:'socket',question:'location',clarification:'In welchem Raum ist die defekte Steckdose?'})}));
  const actions = structuredClone(turn.state.actions);
  const result = await generateNaturalReply(turn,mercury({reply:'In welchem Raum ist die defekte Steckdose?',questionKey:'location'}));
  assert.equal(result.reply,'In welchem Raum ist die defekte Steckdose?');
  assert.deepEqual(turn.state.actions,actions);
  await assert.rejects(generateNaturalReply(turn,mercury({reply:'Seit wann?',questionKey:'since'})),error => error.type === 'invalid_model_output');
});


test('SDK JSON parse failure receives one genuine corrective generation, with failed usage accounted',async()=>{
  let calls=0,invalid=0;
  const sdk=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async()=>{
    calls++;
    return {content:[{type:'text',text:calls===1 ? '...' : JSON.stringify({intent:'knowledge',dialogue:{reply:'Ich kann Ihre Anliegen hier vorbereiten. Übermittelt wird dabei noch nichts.'}})}],
      finishReason:{unified:'stop',raw:'stop'},warnings:[],
      usage:{inputTokens:{total:200,noCache:200,cacheRead:0,cacheWrite:0},outputTokens:{total:100,text:80,reasoning:20}}};
  }});
  const result=await generateUnderstandingResult('Wie funktioniert das?',null,sdk,{logInvalid:error=>{invalid++;assert.deepEqual(error.validationFields,['root:unreadable_json']);}});
  assert.equal(calls,2);assert.equal(invalid,1);assert.equal(result.generationCount,2);
  assert.equal(result.totalUsage.inputTokens,400);assert.match(result.data.dialogue.reply,/Übermittelt/);
});


test('A fact question cannot simultaneously trigger a premature handover stage',async()=>{
  let calls=0;
  const sdk=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async()=>{
    calls++;
    return {content:[{type:'text',text:JSON.stringify({intent:'issue',equipment:'light',
      dialogue:{reply:'In welchem Raum ist die Lampe?',ask:{field:'location',text:'In welchem Raum?'},buttons:[{kind:'prepare_draft'}]}})}],
      finishReason:{unified:'stop',raw:'stop'},warnings:[],
      usage:{inputTokens:{total:200,noCache:200,cacheRead:0,cacheWrite:0},outputTokens:{total:100,text:80,reasoning:20}}};
  }});
  const result=await generateUnderstandingResult('Lampe kaputt',null,sdk);
  assert.equal(result.generationCount,1);assert.equal(result.data.dialogue.stage,'clarify');
  const turn=await processTurn({message:'Lampe kaputt'},null,async()=>({mode:'model',data:result.data}));
  assert.equal(turn.state.pendingKey,'location');assert.ok(!turn.state.actions.some(a=>a.type==='handover'));
});


test('The SDK accepts a repeated draft proposal without a repair call and still stores the new fact',async()=>{
  const first=await processTurn({message:'Lampe kaputt'},null,async()=>({mode:'model',data:emptyUnderstanding({intent:'issue',equipment:'light',
    dialogue:{reply:'Ich kann einen Entwurf vorbereiten.',stage:'offer_draft',buttons:[]}})}));
  let calls=0;
  const result=await generateUnderstandingResult('Seit gestern',first.state,mercury({intent:'issue',since:'gestern',
    dialogue:{reply:'Der Beginn ist notiert.',buttons:[{kind:'prepare_draft'}]}},()=>{calls++;}));
  assert.equal(calls,1);assert.equal(result.generationCount,1);
  const turn=await processTurn({message:'Seit gestern'},first.state,async()=>({mode:'model',data:result.data}));
  assert.equal(turn.state.issue.since,'gestern');assert.ok(!turn.state.actions.some(a=>a.type==='handover'));
});


test('Section navigation cannot establish where the customer contract is stored; a real correction preserves navigation',async()=>{
  let calls=0,invalid=0;
  const sdk=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async()=>{
    calls++;return {content:[{type:'text',text:JSON.stringify({intent:'documents',dialogue:{
      reply:calls===1 ? 'Im Portal finden Sie diesen im Dokumentenbereich.' : 'Ihren persönlichen Mietvertrag kann ich nicht abrufen. Ich kann den vorbereiteten Dokumentenbereich öffnen.',
      buttons:[{kind:'navigate',target:'docs'}]}})}],finishReason:{unified:'stop',raw:'stop'},warnings:[],
      usage:{inputTokens:{total:200,noCache:200,cacheRead:0,cacheWrite:0},outputTokens:{total:100,text:80,reasoning:20}}};
  }});
  const result=await generateUnderstandingResult('Wo finde ich meinen Mietvertrag?',null,sdk,{logInvalid:error=>{invalid++;assert.ok(error.validationFields.includes('dialogue.reply:unsupported_document_claim'));}});
  assert.equal(calls,2);assert.equal(invalid,1);
  const turn=await processTurn({message:'Wo finde ich meinen Mietvertrag?'},null,async()=>({mode:'model',data:result.data}));
  assert.equal(turn.state.actions[0].target,'docs');assert.equal(turn.state.issue,null);assert.match(turn.reply,/nicht abrufen/);
});


test('A portal draft is not a sending capability, including future wording rather than a claimed receipt',async()=>{
  let calls=0;
  const sdk=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async()=>{
    calls++;return {content:[{type:'text',text:JSON.stringify({intent:'contact',dialogue:{
      reply:calls===1 ? 'Dieses Gespräch wird nicht automatisch übermittelt. Sie können den Entwurf im Portal verwenden, um die Meldung zu versenden.' : 'Ich kann den Entwurf öffnen. Er wird nicht automatisch an MORADA versendet.',
      buttons:[{kind:'prepare_draft'}]}})}],finishReason:{unified:'stop',raw:'stop'},warnings:[],
      usage:{inputTokens:{total:200,noCache:200,cacheRead:0,cacheWrite:0},outputTokens:{total:100,text:80,reasoning:20}}};
  }});
  const result=await generateUnderstandingResult('Kann ich das direkt melden?',null,sdk);
  assert.equal(calls,2);assert.match(result.data.dialogue.reply,/nicht automatisch/);
});


test('A multi-issue follow-up requires an explicit valid issue index before being shown',async()=>{
  const text='Heizung kalt und Wasser im Bad';let calls=0;
  const sdk=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async()=>{
    calls++;const ask={field:'details',text:'Woher tropft das Wasser?',...(calls>1 ? {issueIndex:1} : {})};
    return {content:[{type:'text',text:JSON.stringify({intent:'issue',category:'heating',equipment:'heater',sourceQuote:'Heizung kalt',
      additionalIssues:[{category:'water',equipment:'leak',location:'Bad',sourceQuote:'Wasser im Bad'}],
      dialogue:{reply:'Woher tropft das Wasser?',ask}})}],finishReason:{unified:'stop',raw:'stop'},warnings:[],
      usage:{inputTokens:{total:200,noCache:200,cacheRead:0,cacheWrite:0},outputTokens:{total:100,text:80,reasoning:20}}};
  }});
  const result=await generateUnderstandingResult(text,null,sdk);
  assert.equal(calls,2);assert.equal(result.data.dialogue.forIssueIndex,1);
  assert.equal(result.data.description,'Heizung kalt');assert.equal(result.data.additionalIssues[0].description,'Wasser im Bad');
});


test('The next question can target a different existing issue than the updated facts',async()=>{
  const heater={id:'heater-1',category:'heating',equipment:'heater',location:null,attempts:{}};
  const water={id:'water-1',category:'water',equipment:'leak',location:'Bad',attempts:{}};let calls=0;
  const result=await generateUnderstandingResult('Rohr unterm Lavabo', {issue:heater,issues:[heater,water]},mercury({
    intent:'issue',targetIssueId:'other1',category:'water',equipment:'pipe',location:'Bad',details:'Rohr unterm Lavabo',
    dialogue:{reply:'Das Rohr ist notiert. In welchem Raum ist die Heizung?',ask:{field:'location',text:'In welchem Raum ist die Heizung?',targetIssueId:'active',issueIndex:1}}},()=>{calls++;}));
  assert.equal(calls,1);assert.equal(result.data.targetIssueId,water.id);assert.equal(result.data.dialogue.forIssueId,heater.id);assert.equal(result.data.dialogue.forIssueIndex,undefined);
});


test('Opaque issue IDs stay server-side and hallucinated references are repaired before applying updates',async()=>{
  const issue={id:'729a6810-41ef-43e9-b4e3-46c7559906fd',equipment:'socket',location:'Bad',attempts:{}};
  let calls=0;
  const sdk=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async options=>{
    calls++;
    assert.ok(!JSON.stringify(options.prompt).includes(issue.id));
    const output={intent:'issue',targetIssueId:calls===1 ? 'other99' : 'active',details:'Fest installiert',
      dialogue:{reply:'Die fest installierte Steckdose ist notiert.'}};
    return {content:[{type:'text',text:JSON.stringify(output)}],finishReason:{unified:'stop',raw:'stop'},warnings:[],
      usage:{inputTokens:{total:100,noCache:100,cacheRead:0,cacheWrite:0},outputTokens:{total:90,text:90,reasoning:0}}};
  }});
  const result=await generateUnderstandingResult('Fest installiert',{issue,issues:[issue]},sdk);
  assert.equal(calls,2);assert.equal(result.data.targetIssueId,issue.id);assert.equal(result.data.details,'Fest installiert');
});
