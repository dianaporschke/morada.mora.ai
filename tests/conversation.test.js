import test from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV4 } from 'ai/test';
import { createUnderstandingService } from '../lib/mora/understanding.js';
import { createChatHandler } from '../api/chat.js';
import { processTurn } from '../lib/mora/engine.js';
import { emptyUnderstanding } from '../lib/mora/schema.js';
import { readSession } from '../lib/mora/session.js';

const dialogue=(reply,stage='discuss',buttons=[])=>({reply,stage,buttons});
const button=(kind,extra={})=>({kind,label:'Vorschlag',field:null,value:null,target:null,...extra});
const data=(patch={})=>emptyUnderstanding({intent:'issue',category:'electricity',equipment:'light',confidence:'clear',dialogue:dialogue('Ich nehme Ihre Angaben auf.'),...patch});
const model=patch=>async()=>({mode:'model',data:data(patch)});
async function invoke(handler,body) {
  let status,output;
  await handler({method:'POST',body},{setHeader(){},status(value){status=value;return this;},json(value){output=value;return this;}});
  return {status,output};
}

test('One SDK generation supplies facts, wording and signed history; a second composer is never invoked',async()=>{
  let calls=0;
  const output=emptyUnderstanding({intent:'greeting',dialogue:dialogue('Grüezi! Was beschäftigt Sie rund um Ihre Immobilie?','information')});
  const sdkModel=new MockLanguageModelV4({modelId:'inception/mercury-2.5',doGenerate:async()=>{
    calls++;
    const {unknownFields,topic,answer,...rest}=output;
    return {content:[{type:'text',text:JSON.stringify({...rest,unknownAnswers:[]})}],finishReason:{unified:'stop',raw:'stop'},warnings:[],
      usage:{inputTokens:{total:120,noCache:120,cacheRead:0,cacheWrite:0},outputTokens:{total:90,text:90,reasoning:0}}};
  }});
  const understand=createUnderstandingService({resolve:async()=>({ready:true,provider:'gateway',model:'inception/mercury-2.5',createModel:()=>sdkModel}),log(){}});
  const result=await invoke(createChatHandler(understand,{env:{MORA_AI_NATURAL_REPLIES:'true'},compose:async()=>{throw new Error('Redundant model call');}}),{message:'Hey'});
  assert.equal(result.status,200); assert.equal(calls,1);
  assert.equal(result.output.responseMode,'model'); assert.equal(result.output.understanding,'model');
  assert.equal(result.output.reply,output.dialogue.reply); assert.equal(readSession(result.output.session).history.at(-1).content,output.dialogue.reply);
  assert.equal(result.output.issue,null); assert.deepEqual(result.output.actions,[]); assert.equal(result.output.modelUsage.inputTokens,120);
});

test('No question does not automatically become a handover, and clarification choices come from the actual model question',async()=>{
  const first=await processTurn({message:'Lampe geht nicht'},null,model({question:'details',clarification:'Ist die Lampe fest installiert oder Ihre eigene?',
    dialogue:dialogue('Ist das eine fest installierte Lampe oder Ihre eigene?','clarify',[
      button('select',{label:'Fest installiert',field:'details',value:'Die Lampe ist fest installiert.'}),
      button('select',{label:'Eigene Lampe',field:'details',value:'Das ist meine eigene Lampe.'}),
      button('select',{label:'Seit gestern',field:'since',value:'Seit gestern'}),button('prepare_draft'),
    ])}));
  assert.equal(first.state.actions.length,2); assert.ok(first.state.actions.every(a=>a.field==='details'));
  let received;
  const second=await processTurn({actionId:first.state.actions[0].id},first.state,async(message)=>{
    received=message; return {mode:'model',data:data({details:'Fest installiert',dialogue:dialogue('Verstanden, es geht um die fest installierte Beleuchtung.')})};
  });
  assert.equal(received,'Die Lampe ist fest installiert.'); assert.equal(second.understanding,'model');
  assert.equal(second.state.issue.id,first.state.issue.id); assert.deepEqual(second.state.actions,[]);
  assert.ok(!second.reply.includes('vorbereiten')); assert.equal(second.state.pendingKey,null);
  await assert.rejects(processTurn({actionId:'invented-button'},second.state,model()),{code:'INVALID_ACTION'});
});

test('Unknown facts and room corrections survive direct handover without a mandatory checklist',async()=>{
  let turn=await processTurn({message:'Steckdose im Wohnzimmer kaputt'},null,model({equipment:'socket',location:'Wohnzimmer',question:'since',clarification:'Seit wann?',dialogue:dialogue('Seit wann funktioniert sie nicht?','clarify')}));
  const id=turn.state.issue.id;
  turn=await processTurn({message:'Keine Ahnung seit wann'},turn.state,model({equipment:'socket',unknownFields:['since'],dialogue:dialogue('Das ist in Ordnung, den Beginn lassen wir offen.')}));
  turn=await processTurn({message:'Nein, Schlafzimmer. Direkt melden bitte.'},turn.state,model({intent:'contact',equipment:'socket',location:'Schlafzimmer',correction:true,
    dialogue:dialogue('Schlafzimmer ist korrigiert. Ich kann den lokalen Entwurf öffnen; der direkte Versand ist noch nicht angebunden.','offer_draft',[button('prepare_draft',{label:'Sofort senden'})])}));
  assert.equal(turn.state.issue.id,id); assert.equal(turn.state.issue.location,'Schlafzimmer');
  assert.equal(turn.state.issue.since,null); assert.ok(turn.state.issue.unknownFields.includes('since'));
  assert.equal(turn.state.pendingKey,null); assert.equal(turn.state.actions[0].type,'handover');
  assert.equal(turn.state.actions[0].label,'Für MORADA vorbereiten'); assert.equal(turn.state.issue.status,'draft');
});

test('Additional free-text symptoms retain earlier details; explicit corrections may replace them',async()=>{
  let turn=await processTurn({message:'Lampe flackert'},null,model({details:'Flackert'}));
  const id=turn.state.issue.id;
  turn=await processTurn({message:'Nur beim Einschalten'},turn.state,model({details:'Nur beim Einschalten'}));
  assert.equal(turn.state.issue.id,id); assert.match(turn.state.issue.details,/Flackert/); assert.match(turn.state.issue.details,/Nur beim Einschalten/);
  turn=await processTurn({message:'Nein, sie bleibt vollständig dunkel.'},turn.state,model({details:'Vollständig dunkel',correction:true}));
  assert.equal(turn.state.issue.details,'Vollständig dunkel');
});

test('Topic changes retain drafts without attaching a document question to the heater or inventing customer access',async()=>{
  let turn=await processTurn({message:'Heizung kalt'},null,model({category:'heating',equipment:'heater',location:'Küche',dialogue:dialogue('Was fällt Ihnen an der Heizung auf?')}));
  const before=structuredClone(turn.state.issue);
  turn=await processTurn({message:'Eigentlich zur Nebenkostenabrechnung'},turn.state,model({intent:'knowledge',category:null,equipment:null,question:'details',clarification:'Welche Position?',
    dialogue:dialogue('Welche Position Ihrer Abrechnung möchten Sie verstehen? Einen persönlichen Beleg kann ich hier noch nicht abrufen.','information',[button('navigate',{target:'docs',label:'Mietvertrag herunterladen'}),button('prepare_draft')])}));
  assert.equal(turn.state.issue.id,before.id); assert.equal(turn.state.issue.location,'Küche'); assert.equal(turn.state.issue.answers.length,before.answers.length);
  assert.equal(turn.state.pendingKey,null); assert.equal(turn.state.conversationTopic,'knowledge');
  assert.deepEqual(turn.state.actions,[]);
  turn=await processTurn({message:'Wo finde ich den Mietvertrag?'},turn.state,model({intent:'documents',category:null,equipment:null,
    dialogue:dialogue('Ihr persönlicher Mietvertrag ist noch nicht angebunden. Den vorbereiteten Dokumentenbereich können Sie öffnen.','information',[
      button('navigate',{target:'docs',label:'Mietvertrag herunterladen'}),button('navigate',{target:'portfolio',label:'Immobilie'}),
    ])}));
  assert.deepEqual(turn.state.actions.map(a=>a.type),['navigate']); assert.equal(turn.state.actions[0].target,'docs');
  assert.equal(turn.state.actions[0].label,'Dokumentenbereich öffnen');
});

test('Model-detected danger overrides a proposed normal reply and disallows photo instructions',async()=>{
  const turn=await processTurn({message:'Ungewöhnliche Beobachtung an der Dose'},null,model({equipment:'socket',hazard:'electric',urgency:'emergency',
    dialogue:dialogue('Fassen Sie die Steckdose an und fotografieren Sie sie.','clarify',[button('attachment')])}));
  assert.equal(turn.singleModelReply,undefined); assert.match(turn.reply,/112/);
  assert.ok(!turn.state.actions.some(a=>a.type==='attachment')); assert.ok(!turn.reply.includes('fotografieren'));
});

test('A fabricated successful submission is rejected; a truthful unsent draft remains valid',async()=>{
  const handler=createChatHandler(model({dialogue:dialogue('Ich habe Ihr Anliegen an MORADA übermittelt.')}));
  const result=await invoke(handler,{message:'Bitte melden'});
  assert.equal(result.status,503); assert.equal(result.output.session,undefined);
  const valid=await processTurn({message:'Lampe defekt'},null,model({dialogue:dialogue('Ich habe die Angaben aufgenommen, aber noch nicht übermittelt.')}));
  assert.equal(valid.singleModelReply,true);
});
