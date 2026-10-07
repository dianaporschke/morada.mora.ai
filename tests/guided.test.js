import test from 'node:test';
import assert from 'node:assert/strict';
import { guidedUnderstanding } from '../lib/mora/guided.js';

const socketState = (overrides = {}) => ({
  issue: { id:'socket-1', category:'electricity', equipment:'socket', count:1, location:null, ...overrides },
  pendingKey:'extent',
});

test('limited recovery distinguishes actual fixtures within electricity', () => {
  for (const [message, expected] of [
    ['Steckdose geht nicht','socket'], ['steckdose kaput','socket'], ['Stekcdose funtioniert nicht','socket'],
    ['Lampe geht nicht','light'], ['Der Lichtschalter ist defekt','switch'],
  ]) {
    const result = guidedUnderstanding(message, null);
    assert.equal(result.equipment, expected, message);
    assert.equal(result.category, 'electricity');
    assert.ok(result.defect);
  }
});

test('complete initial sentence extracts count, time, place and a concise symptom', () => {
  const result = guidedUnderstanding('Seit gestern funktionieren drei Steckdosen im Wohnzimmer nicht', null);
  assert.equal(result.count, 3);
  assert.equal(result.since, 'Seit gestern');
  assert.equal(result.location, 'im Wohnzimmer');
  assert.equal(result.defect, 'funktioniert nicht');
  assert.equal(result.description, 'Seit gestern funktionieren drei Steckdosen im Wohnzimmer nicht');
  const days = guidedUnderstanding('Seit drei Tagen funktionieren zwei Steckdosen im Wohnzimmer nicht', null);
  assert.equal(days.count, 2, 'duration must not be mistaken for fixture count');
  assert.equal(days.since, 'Seit drei Tagen');
});

test('short heating followups stay attached even when answers arrive out of order', () => {
  const first = guidedUnderstanding('Heizung kaputt', null);
  const state = { issue:{ id:'heat-1', category:first.category, equipment:first.equipment }, pendingKey:'since' };
  const all = guidedUnderstanding('Alle', state);
  assert.equal(all.category, 'heating');
  assert.equal(all.equipment, 'heater');
  assert.equal(all.extent, 'Alle Heizkörper');
  assert.equal(all.newIssue, false);
  state.issue.extent = all.extent;
  const yesterday = guidedUnderstanding('Seit gestern', state);
  assert.equal(yesterday.since, 'Seit gestern');
  assert.equal(yesterday.category, 'heating');
  assert.equal(yesterday.newIssue, false);
});

test('free scope answer extracts the room and does not invent a fixture count', () => {
  const result = guidedUnderstanding('Im ganzen Wohnzimmer geht keine', socketState());
  assert.equal(result.location, 'Im ganzen Wohnzimmer');
  assert.equal(result.equipment, 'socket');
  assert.match(result.extent, /ganzen Wohnzimmer/);
  assert.equal(result.count, null);
  assert.ok(result.clearFields.includes('count'));
});

test('count, place and fixture corrections replace facts rather than opening a new issue', () => {
  for (const message of ['Nein, zwei', 'Moment, die zweite daneben auch']) {
    const result = guidedUnderstanding(message, socketState());
    assert.equal(result.count, 2, message);
    assert.equal(result.correction, true);
    assert.equal(result.newIssue, false);
  }
  const place = guidedUnderstanding('Nicht im Wohnzimmer, sondern im Bad', socketState());
  assert.equal(place.location, 'im Bad');
  const equipment = guidedUnderstanding('Nein, die Steckdose ist kaputt', {
    issue:{ id:'heat-1', category:'heating', equipment:'heater' }, pendingKey:'since',
  });
  assert.equal(equipment.equipment, 'socket');
  assert.equal(equipment.newIssue, false);
  assert.equal(equipment.correction, true);
  assert.equal(equipment.confidence, 'clear');
  const negated = guidedUnderstanding('Nein, nicht die Steckdose. Die Lampe ist kaputt', socketState());
  assert.equal(negated.equipment, 'light');
  assert.equal(negated.newIssue, false);
  assert.equal(negated.confidence, 'clear');
});

test('ambiguous lavabo sounds remain unknown instead of inventing a leak or appliance', () => {
  const result = guidedUnderstanding('Unter dem Lavabo macht das Ding Geräusche', null);
  assert.equal(result.category, null);
  assert.equal(result.equipment, 'unknown');
  assert.equal(result.confidence, 'unclear');
  assert.equal(result.question, 'equipment');
  assert.equal(result.location, 'Unter dem Lavabo');
  assert.equal(result.defect, 'macht Geräusche');
  assert.equal(result.hazard, 'none');
});

test('Swiss expressions and bounded common typos are understood in recovery mode', () => {
  for (const [message, equipment, location] of [
    ['heizig spinnt','heater',null], ['tropfts unterm Lavabo','leak','unterm Lavabo'],
    ['waschmaschne im kelr kaput','washer','Keller'],
    ['Steckdoose im Wohnzimer kaput','socket','Wohnzimmer'],
  ]) {
    const result = guidedUnderstanding(message, null);
    assert.equal(result.equipment, equipment, message);
    assert.equal(result.location, location, message);
    assert.ok(result.defect);
  }
  assert.equal(guidedUnderstanding('seit gestren', { ...socketState(), pendingKey:'since' }).since, 'seit gestern');
});

test('two distinct defects are separated and each gets only its own facts', () => {
  const result = guidedUnderstanding('Heizung kaputt und im Bad tropft Wasser', null);
  assert.equal(result.equipment, 'heater');
  assert.equal(result.location, null);
  assert.equal(result.additionalIssues.length, 1);
  assert.equal(result.additionalIssues[0].equipment, 'leak');
  assert.equal(result.additionalIssues[0].location, 'im Bad');
  assert.equal(result.additionalIssues[0].defect, 'tropft');
  assert.equal(guidedUnderstanding('Heizung kaputt und alle Heizkörper seit gestern kalt', null).additionalIssues.length, 0);
});

test('unrelated text is unclear and never becomes a pending room or time', () => {
  for (const pendingKey of ['location', 'since', 'extent', 'equipment', 'details', 'unsupported-field']) {
    const result = guidedUnderstanding('Ich esse heute gern Pizza', { ...socketState(), pendingKey });
    assert.equal(result.location, null, pendingKey);
    // A coincidental temporal word is not a reliable answer in arbitrary prose.
    assert.equal(result.confidence, 'unclear', pendingKey);
  }
});

test('unavailable pending keys cannot escape the schema and unrelated initial text stays general', () => {
  const result = guidedUnderstanding('Quantencomputer sind interessant', { ...socketState(), pendingKey:'unsupported-field' });
  assert.equal(result.intent, 'general');
  assert.equal(result.question, 'details');
  assert.equal(result.confidence, 'unclear');
  assert.equal(guidedUnderstanding('Ich esse Pizza', null).intent, 'general');
});

test('knowledge and documents are recognized as separate intentions during damage intake', () => {
  assert.equal(guidedUnderstanding('Was bedeutet Mietkaution?', socketState()).intent, 'knowledge');
  assert.equal(guidedUnderstanding('Wo finde ich meinen Mietvertrag?', socketState()).intent, 'documents');
});
