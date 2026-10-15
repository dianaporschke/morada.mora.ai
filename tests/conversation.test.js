import test from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV4 } from 'ai/test';
import { createUnderstandingService } from '../lib/mora/understanding.js';
import { createChatHandler } from '../api/chat.js';
import { modelContext } from '../lib/mora/context.js';
import { validatedDialogueReply } from '../lib/mora/dialogue.js';
import { processTurn } from '../lib/mora/engine.js';
import { emptyUnderstanding, issuePatchSchema } from '../lib/mora/schema.js';
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
    const {unknownFields,topic,answer,hazard,confidence,question,clarification,...rest}=output;
    return {content:[{type:'text',text:JSON.stringify({...rest,dialogue:{reply:output.dialogue.reply,buttons:output.dialogue.buttons},risk:hazard,sourceQuote:null,unknownAnswers:[]})}],finishReason:{unified:'stop',raw:'stop'},warnings:[],
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
  assert.equal(first.state.actions.length,3);
  assert.ok(first.state.actions.filter(a=>a.type==='select').every(a=>a.field==='details'));
  assert.equal(first.state.actions.filter(a=>a.type==='handover').length,1);
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

test('Device classification changes follow the model issue decision instead of silently creating duplicate drafts',async()=>{
  let turn=await processTurn({message:'Es tropft im Bad.'},null,model({category:'water',equipment:'leak',location:'Bad'}));
  const id=turn.state.issue.id;
  turn=await processTurn({message:'Es ist das Rohr unterm Lavabo.'},turn.state,model({category:'water',equipment:'pipe',details:'unterm Lavabo'}));
  assert.equal(turn.state.issues.length,1);assert.equal(turn.state.issue.id,id);assert.equal(turn.state.issue.equipment,'pipe');
  turn=await processTurn({message:'Und meine Heizung bleibt kalt.'},turn.state,model({newIssue:true,category:'heating',equipment:'heater'}));
  assert.equal(turn.state.issues.length,2);assert.notEqual(turn.state.issue.id,id);
});

test('Topic changes retain drafts without attaching a document question to the heater or inventing customer access',async()=>{
  let turn=await processTurn({message:'Heizung kalt'},null,model({category:'heating',equipment:'heater',location:'Küche',dialogue:dialogue('Was fällt Ihnen an der Heizung auf?')}));
  const before=structuredClone(turn.state.issue);
  turn=await processTurn({message:'Eigentlich zur Nebenkostenabrechnung'},turn.state,model({intent:'knowledge',category:null,equipment:null,question:'details',clarification:'Welche Position?',
    dialogue:dialogue('Welche Position Ihrer Abrechnung möchten Sie verstehen?','information')}));
  assert.equal(turn.state.issue.id,before.id); assert.equal(turn.state.issue.location,'Küche'); assert.equal(turn.state.issue.answers.length,before.answers.length);
  assert.equal(turn.state.pendingKey,null); assert.equal(turn.state.conversationTopic,'knowledge');
  assert.deepEqual(turn.state.actions,[]);
  turn=await processTurn({message:'Wo finde ich den Mietvertrag?'},turn.state,model({intent:'documents',category:null,equipment:null,
    dialogue:dialogue('Ihr persönlicher Mietvertrag ist noch nicht angebunden. Den vorbereiteten Dokumentenbereich können Sie öffnen.','information',[
      button('navigate',{target:'docs',label:'Mietvertrag herunterladen'}),button('navigate',{target:'portfolio',label:'Immobilie'}),
    ])}));
  assert.deepEqual(turn.state.actions.map(a=>a.type),['navigate','navigate']); assert.equal(turn.state.actions[0].target,'docs');
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


test('Resume buttons appear after a topic change, not while already discussing the active issue',async()=>{
  let turn=await processTurn({message:'Lampe kaputt'},null,model({question:'location',clarification:'In welchem Raum?',
    dialogue:dialogue('In welchem Raum ist die Lampe?','clarify',[button('continue')])}));
  assert.deepEqual(turn.state.actions,[]); assert.equal(turn.state.pendingKey,'location');
  turn=await processTurn({message:'Jetzt eine allgemeine Frage'},turn.state,model({intent:'knowledge',
    dialogue:dialogue('Gerne, was möchten Sie wissen?','information',[button('continue')])}));
  assert.equal(turn.state.actions[0].type,'continue');
});


test('The model owns offer timing; the server never adds a handover merely because an intent or stage says contact',async()=>{
  let turn=await processTurn({message:'Lampe kaputt'},null,model({dialogue:dialogue('Ich kann Ihre Angaben für MORADA vorbereiten.','offer_draft',[button('prepare_draft')])}));
  assert.equal(turn.state.actions[0].type,'handover');
  const id=turn.state.issue.id;
  turn=await processTurn({message:'Seit gestern'},turn.state,model({since:'gestern',dialogue:dialogue('Der Beginn ist notiert.','offer_draft')}));
  assert.equal(turn.reply,'Der Beginn ist notiert.');assert.equal(turn.state.issue.id,id);assert.equal(turn.state.issue.since,'gestern');
  assert.ok(!turn.state.actions.some(a=>a.type==='handover'));
  turn=await processTurn({message:'Wurde etwas verschickt?'},turn.state,model({intent:'contact',dialogue:dialogue('Es wurde noch nichts übermittelt.','information')}));
  assert.deepEqual(turn.state.actions,[]);
  turn=await processTurn({message:'Kann ich das direkt melden?'},turn.state,model({intent:'contact',dialogue:dialogue('Ich kann den Entwurf öffnen. Er wird nicht automatisch versendet.','offer_draft',[button('prepare_draft')])}));
  assert.equal(turn.state.actions[0].type,'handover');
});


test('A multi-issue model question activates its own issue; device refinement stays with the leak',async()=>{
  let turn=await processTurn({message:'Heizung kalt und Wasser im Bad'},null,model({category:'heating',equipment:'heater',
    question:'details',clarification:'Wo genau tropft das Wasser?',
    additionalIssues:[Object.fromEntries(Object.keys(issuePatchSchema.shape).map(key=>[key,emptyUnderstanding({category:'water',equipment:'leak',location:'Bad'})[key]]))],
    dialogue:{...dialogue('Wo genau tropft das Wasser?','clarify'),forIssueIndex:1}}));
  const heater=turn.state.issues.find(i=>i.equipment==='heater');
  const water=turn.state.issues.find(i=>i.equipment==='leak');
  assert.equal(turn.state.issue.id,water.id);assert.equal(turn.state.pendingKey,'details');
  turn=await processTurn({message:'Aus dem Rohr unterm Lavabo'},turn.state,model({category:'water',equipment:'pipe',
    details:'Aus dem Rohr unterm Lavabo',dialogue:dialogue('Die Angabe zum Rohr ist notiert.')}));
  assert.equal(turn.state.issues.length,2);assert.equal(turn.state.issue.id,water.id);assert.equal(turn.state.issue.equipment,'pipe');
  assert.equal(turn.state.issue.location,'Bad');assert.equal(turn.state.issues.find(i=>i.id===heater.id).location,null);
});


test('Existing symptom details do not suppress a different model clarification about installation',async()=>{
  const turn=await processTurn({message:'Lampe flackert'},null,model({details:'Flackert',question:'details',clarification:'Ist die Leuchte fest installiert?',
    dialogue:dialogue('Ist die Leuchte fest installiert oder Ihre eigene?','clarify',[button('select',{label:'Fest installiert',field:'details',value:'Fest installiert'})])}));
  assert.equal(turn.state.pendingKey,'details');assert.equal(turn.state.issue.details,'Flackert');
  assert.equal(turn.state.actions[0].type,'select');
});


test('Updating water while asking about the heater preserves both facts and the independent question target',async()=>{
  let turn=await processTurn({message:'Heizung und Wasser'},null,model({category:'heating',equipment:'heater',
    additionalIssues:[Object.fromEntries(Object.keys(issuePatchSchema.shape).map(key=>[key,emptyUnderstanding({category:'water',equipment:'leak',location:'Bad'})[key]]))]}));
  const heater=turn.state.issues.find(i=>i.equipment==='heater'),water=turn.state.issues.find(i=>i.equipment==='leak');
  turn=await processTurn({message:'Aus dem Rohr unterm Lavabo'},turn.state,model({targetIssueId:water.id,category:'water',equipment:'pipe',details:'Rohr unterm Lavabo',
    question:'location',clarification:'In welchem Raum ist die Heizung?',dialogue:{...dialogue('Das Rohr ist notiert. In welchem Raum ist die Heizung?','clarify'),forIssueId:heater.id}}));
  assert.equal(turn.state.issues.length,2);assert.equal(turn.state.issue.id,heater.id);assert.equal(turn.state.pendingKey,'location');
  assert.equal(turn.state.issues.find(i=>i.id===water.id).equipment,'pipe');assert.equal(turn.state.issues.find(i=>i.id===water.id).details,'Rohr unterm Lavabo');
  assert.equal(turn.state.issues.find(i=>i.id===water.id).location,'Bad');assert.equal(turn.state.issue.location,null);
});


test('Other-issue context preserves device details without replaying archived customer statements',()=>{
  const active={id:'heat',category:'heating',equipment:'heater',answers:[]};
  const other={id:'water',category:'water',equipment:'leak',location:'Bad',defect:'Tropft',details:'unterm Lavabo',
    answers:[{answer:'Es tropft aus dem Rohr unterm Lavabo.'}]};
  const context=modelContext({issue:active,issues:[active,other],history:[]});
  assert.equal(context.knownIssues[0].details,'unterm Lavabo');assert.equal(context.knownIssues[0].defect,'Tropft');
  assert.equal(context.knownIssues[0].recentCustomerStatements,undefined);
});


test('Personal-record capability claims cannot bypass validation through knowledge intent or a pronoun',()=>{
  const reply='Ich kann keine persönlichen Abrechnungen abrufen. Im Dokumentenbereich können Sie diese jedoch nachsehen.';
  assert.throws(()=>validatedDialogueReply({intent:'knowledge',dialogue:{reply}}),{validation:'unsupported_document_claim'});
  assert.throws(()=>validatedDialogueReply({intent:'documents',dialogue:{reply:'Sie können den Dokumentenbereich im Servicebereich anzeigen.'}}),{validation:'unsupported_document_claim'});
});

test('Navigation and a truthful access limitation remain allowed without any personal-record promise',()=>{
  const reply='Ihren persönlichen Mietvertrag kann ich hier nicht abrufen. Ich kann den vorbereiteten Dokumentenbereich öffnen.';
  assert.equal(validatedDialogueReply({intent:'documents',dialogue:{reply}}),reply);
});


test('Negated personal-record locations are not mistaken for an affirmative access promise',()=>{
  const reply='Ihren persönlichen Mietvertrag finden Sie hier im Portal noch nicht. Ich kann den vorbereiteten Dokumentenbereich öffnen.';
  assert.equal(validatedDialogueReply({intent:'documents',dialogue:{reply}}),reply);
});

test('The final live wrong-section failure and denial-then-promise variants are rejected',()=>{
  for (const reply of [
    'Im Servicebereich unter Dokumente können Sie gerne nachschauen.',
    'Ich kann Ihre Abrechnung nicht abrufen, aber im Portal können Sie diese einsehen.',
    'Den Vertrag kann ich nicht öffnen; dort können Sie Ihren Mietvertrag herunterladen.',
    'Ihre Dokumente finden Sie im Servicebereich.',
    "Mietverträge finden Sie im Bereich 'Dokumente'. Möchten Sie dorthin navigieren?",
    'Prüfen Sie im Bereich Dokumente, ob die Abrechnung dort hinterlegt ist.',
  ]) assert.throws(()=>validatedDialogueReply({intent:'knowledge',dialogue:{reply}}),{validation:'unsupported_document_claim'});
  assert.throws(()=>validatedDialogueReply({intent:'contact',dialogue:{reply:'Ich kann nicht selbst senden, aber Sie können das Anliegen hier absenden.'}}),{validation:'unsupported_delivery_claim'});
});

test('The model receives the exact pending clarification, attempt fields and distinct portal sections',()=>{
  const issue={id:'light',equipment:'light',clarification:'Ist die Leuchte fest installiert?',attempts:{details:1,since:0}};
  const context=modelContext({issue,issues:[issue],pendingKey:'details'});
  assert.equal(context.pendingQuestionText,issue.clarification);
  assert.deepEqual(context.activeIssue.askedFields,['details']);
});

test('Observed corrupt German is rejected without rewriting a genuine model response',()=>{
  for (const reply of ['Ich habe not vermerkt, dass die Lampe defekt ist.','Ich habe den Stand not.','Das ist bedauert.']) {
    assert.throws(()=>validatedDialogueReply({intent:'issue',dialogue:{reply}}),{validation:'invalid_response_language'});
  }
  const reply='Die Lampe im Badezimmer ist seit gestern defekt.';
  assert.equal(validatedDialogueReply({intent:'issue',dialogue:{reply}}),reply);
  assert.equal(validatedDialogueReply({intent:'knowledge',dialogue:{reply:'Bei akuter Not wählen Sie 112.'}}),'Bei akuter Not wählen Sie 112.');
});

test('A concrete draft offer requires its validated action, while plain acknowledgements stay button-free',()=>{
  const reply='Möchten Sie einen Anliegenentwurf vorbereiten?';
  assert.throws(()=>validatedDialogueReply({intent:'issue',dialogue:{reply,buttons:[]}}),{validation:'missing_draft_action'});
  assert.equal(validatedDialogueReply({intent:'issue',dialogue:{reply,buttons:[{kind:'prepare_draft'}]}}),reply);
  assert.equal(validatedDialogueReply({intent:'issue',dialogue:{reply:'Schlafzimmer ist korrigiert.',buttons:[]}}),'Schlafzimmer ist korrigiert.');
});

test('One customer turn updates two existing issues without duplicating them or mixing rooms',async()=>{
  let turn=await processTurn({message:'Heizung kalt; Wasser tropft im Bad'},null,model({category:'heating',equipment:'heater',
    additionalIssues:[Object.fromEntries(Object.keys(issuePatchSchema.shape).map(key=>[key,emptyUnderstanding({category:'water',equipment:'leak',location:'Bad'})[key]]))]}));
  const heater=turn.state.issues.find(issue=>issue.equipment==='heater'),water=turn.state.issues.find(issue=>issue.equipment==='leak');
  turn=await processTurn({message:'Heizung im Wohnzimmer. Beim Wasser das Rohr seit heute.'},turn.state,model({targetIssueId:heater.id,category:'heating',equipment:'heater',location:'Wohnzimmer',
    additionalIssues:[{...Object.fromEntries(Object.keys(issuePatchSchema.shape).map(key=>[key,emptyUnderstanding({category:'water',equipment:'pipe',since:'heute'})[key]])),targetIssueId:water.id}],
    dialogue:dialogue('Die Heizung ist im Wohnzimmer; das Rohr tropft seit heute.')}));
  assert.equal(turn.state.issues.length,2);
  assert.equal(turn.state.issues.find(issue=>issue.id===heater.id).location,'Wohnzimmer');
  assert.equal(turn.state.issues.find(issue=>issue.id===water.id).location,'Bad');
  assert.equal(turn.state.issues.find(issue=>issue.id===water.id).equipment,'pipe');
  assert.equal(turn.state.issues.find(issue=>issue.id===water.id).since,'heute');
});
