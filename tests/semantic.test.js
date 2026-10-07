import test from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV4 } from 'ai/test';
import { generateUnderstanding } from '../lib/mora/understanding.js';
import { processTurn } from '../lib/mora/engine.js';

test('SDK structured output contract passes signed context to the model and validates the result', async () => {
  let captured;
  const expected = { intent:'issue', newIssue:false, confidence:'clear', category:'heating', subcategory:null,
    description:null, location:null, since:'seit gestern', extent:null, details:null, urgency:'normal', hazard:'none' };
  const model = new MockLanguageModelV4({ doGenerate:async options => {
    captured = options;
    return { content:[{type:'text',text:JSON.stringify(expected)}], finishReason:{unified:'stop',raw:'stop'},
      usage:{ inputTokens:{total:100,noCache:100,cacheRead:0,cacheWrite:0}, outputTokens:{total:80,text:80,reasoning:0} }, warnings:[] };
  } });
  const state = { history:[{role:'user',content:'Meine Heizung funktioniert nicht.'},{role:'assistant',content:'Seit wann?'}],
    issue:{id:'issue1',category:'heating',description:'Meine Heizung funktioniert nicht.'}, pendingKey:'since' };
  const result = await generateUnderstanding('seit gestern', state, model);
  assert.equal(result.since,'seit gestern'); assert.equal(result.category,'heating');
  assert.match(JSON.stringify(captured.prompt), /Meine Heizung funktioniert nicht/);
  assert.match(JSON.stringify(captured.prompt), /pendingQuestion/);
  assert.equal(captured.responseFormat.type,'json');
  assert.ok(captured.responseFormat.schema);
});

test('A semantic paraphrase without any original keyword gets the same qualification flow', async () => {
  const data = { intent:'issue', newIssue:false, confidence:'clear', category:'electricity', subcategory:'Beleuchtung',
    description:'Beleuchtung fällt aus', location:'Flur', since:null, extent:null, details:null, urgency:'normal', hazard:'none' };
  const result = await processTurn({message:'Wenn ich den Schalter im Flur drücke bleibt es dunkel'}, null, async () => ({data,mode:'model'}));
  assert.equal(result.state.issue.category,'electricity'); assert.equal(result.state.issue.location,'Flur');
  assert.equal(result.state.pendingKey,'since'); assert.equal(result.understanding,'model');
});
