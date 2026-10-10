import test from 'node:test';
import assert from 'node:assert/strict';
import { processTurn } from '../lib/mora/engine.js';
import { emptyUnderstanding } from '../lib/mora/schema.js';

const model = patch => async () => ({mode:'model',data:emptyUnderstanding({intent:'issue',confidence:'clear',...patch})});

test('A model can stop clarification without the application adding a checklist question', async () => {
  let turn = await processTurn({message:'Die Steckdose geht nicht.'},null,model({category:'electricity',equipment:'socket',question:'location',clarification:'In welchem Raum ist die Steckdose?'}));
  assert.equal(turn.state.pendingKey,'location'); assert.equal(turn.reply,'In welchem Raum ist die Steckdose?');
  turn = await processTurn({message:'Schlafzimmer. Den Beginn weiss ich nicht.'},turn.state,model({location:'Schlafzimmer',unknownFields:['since']}));
  assert.equal(turn.state.pendingKey,null); assert.equal(turn.state.issue.location,'Schlafzimmer');
  assert.equal(turn.state.issue.since,null); assert.deepEqual(turn.state.issue.unknownFields,['since']);
  assert.ok(turn.state.actions.some(action => action.type === 'handover'));
  assert.ok(!turn.state.actions.some(action => action.type === 'select'));
});

test('Rejected model questions never become another field question; valid scope proposals keep safe buttons', async () => {
  let turn = await processTurn({message:'Die Steckdose im Wohnzimmer geht nicht.'},null,model({category:'electricity',equipment:'socket',location:'Wohnzimmer',question:'location',clarification:'In welchem Raum?'}));
  assert.equal(turn.state.pendingKey,null);
  turn = await processTurn({message:'Nein, Schlafzimmer. Seit wann weiss ich nicht.'},turn.state,model({correction:true,location:'Schlafzimmer',unknownFields:['since'],question:'since'}));
  assert.equal(turn.state.pendingKey,null); assert.equal(turn.state.issue.location,'Schlafzimmer');
  turn = await processTurn({message:'Vielleicht sind mehrere betroffen.'},turn.state,model({question:'extent',clarification:'Wie viele Steckdosen sind betroffen?'}));
  assert.equal(turn.state.pendingKey,'extent'); assert.equal(turn.reply,'Wie viele Steckdosen sind betroffen?');
  assert.ok(turn.state.actions.some(action => action.id === 'answer-extent-one'));
});
