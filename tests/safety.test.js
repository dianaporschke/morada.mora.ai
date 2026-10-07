import test from 'node:test';
import assert from 'node:assert/strict';
import { detectHazard, explicitHazardDenial, safetyNotice } from '../lib/mora/safety.js';
import { processTurn } from '../lib/mora/engine.js';

const urgent = [
  ['ich rieche gas', 'gas'], ['es riecht nach Gas', 'gas'], ['gasgeruh in der küche', 'gas'],
  ['ich riehce gas', 'gas'], ['ich riche gaas', 'gas'], ['Hier riecht es nicht gut nach Gas', 'gas'], ['hier richt es nach gas', 'gas'], ['Gas tritt aus', 'gas'],
  ['Ich weiss nicht, ob es nach Gas riecht', 'gas'], ['Gasgeruch kann ich nicht ausschliessen', 'gas'],
  ['ich sehe rauch im treppenhaus', 'fire'], ['die küche brennt', 'fire'], ['die küche brent', 'fire'], ['Die Steckdose raucht', 'fire'], ['feur im bad', 'fire'],
  ['Es riecht verschmort', 'fire'], ['Die Steckdose wirft Funken und riecht verbrannt', 'electric'],
  ['funkenn aus der stekdose', 'electric'], ['Die Steckdose ist nass', 'electric'],
  ['wasser kommt aus der steckdose', 'electric'], ['ich habe einen stromschalg bekommen', 'electric'],
  ['habe einen rohrbruch', 'water'], ['rorbruch im bad', 'water'], ['rohrbrcuh in der küche', 'water'],
  ['waser kommt aus der deke', 'water'], ['Wasser tropft von der Decke', 'water'],
  ['die Decke tropft', 'water'], ['Der Keller steht unter Wasser', 'water'],
  ['Kein Rauch, aber die Steckdose wirft Funken', 'electric'],
  ['Ich rieche kein Gas, aber hier ist Rauch', 'fire'],
  ['Es gibt nicht nur Rauch, sondern auch Flammen', 'fire'],
  ['Theoretisch könnte es ein Defekt sein, aber jetzt rieche ich Gas', 'gas'],
];
for (const [message, hazard] of urgent) test(`Immediate hazard: ${message}`, () => {
  assert.deepEqual(detectHazard(message), { hazard, urgency:hazard === 'water' ? 'high' : 'emergency' });
});

const normal = [
  'lampe geht nicht', 'steckdose funktioniert nicht', 'heizung funktioniert nicht',
  'bei mir tropfts unter der spüle', 'ein Wasserfleck an der Decke', 'waschmaschine im keller kaputt',
  'Mein Rauchmelder piept, aber kein Rauch', 'Gasheizung wird nicht warm, kein Gasgeruch',
  'Ich rieche kein Gas', 'Hier riecht es nicht nach Gas', 'Rauch ist nicht vorhanden',
  'Die Steckdose wirft keine Funken', 'Wasser kommt nicht aus der Decke', 'Es brennt nicht',
  'Es gibt kaine funkenn', 'Ich sehe keien Rauch', 'Mein Nachbar raucht', 'Die Lampe brennt nicht', 'ein Termin fuer morgen', 'Die Wand ist rauh',
  'Was wäre, wenn ich Gas rieche?', 'Was würde passieren wenn ein Rohrbruch auftritt?',
  'Nur theoretisch: Was tun, wenn Gas austritt?', 'Was tun falls irgendwann die Küche brennt?',
  'Letztes Jahr gab es hier einen Rohrbruch',
];
for (const message of normal) test(`No immediate hazard: ${message}`, () => {
  assert.deepEqual(detectHazard(message), { hazard:'none', urgency:'normal' });
});

test('Gas and electrical danger bypass even an unavailable language model', async () => {
  for (const message of ['ich rieche gas', 'die stekdose wirft funkenn und riecht verbrannt']) {
    let calls = 0;
    const result = await processTurn({ message }, null, async () => { calls++; throw new Error('Provider offline'); });
    assert.equal(calls, 0);
    assert.equal(result.state.issue.urgency, 'emergency');
    assert.match(result.reply, /112/);
    assert.match(result.reply, /Warten Sie nicht/);
    assert.equal(result.state.actions[0].type, 'call');
    assert.equal(result.state.actions[0].number, '112');
    assert.ok(!result.state.actions.some(action => action.type === 'attachment'));
  }
});

test('Gas advice keeps phone use outside and never asks for repair or a photo', () => {
  assert.match(safetyNotice('gas'), /kein Telefon im Gebäude/);
  assert.match(safetyNotice('gas'), /von draussen 112/);
  for (const hazard of ['gas', 'fire', 'electric', 'water']) {
    assert.doesNotMatch(safetyNotice(hazard), /abschrauben|aufmachen|Foto|reparieren/);
  }
});

test('Explicit corrections can retract only the same prior hazard', () => {
  for (const [hazard, message] of [
    ['electric', 'Nein, sie wirft keine Funken. Sie geht nur nicht.'],
    ['electric', 'Ich meinte keine funkenn, nur eine defekte Steckdose'],
    ['electric', 'Die Steckdose ist nicht nass'],
    ['gas', 'Nein, ich rieche kein Gas. Das war ein Tippfehler.'],
    ['fire', 'Es gibt keinen Rauch, ich meinte eine defekte Lampe'],
    ['water', 'Es ist kein Rohrbruch, nur ein tropfender Hahn'],
  ]) assert.equal(explicitHazardDenial(message, hazard), true, message);
  assert.equal(explicitHazardDenial('Nein, keine Funken', 'gas'), false);
  assert.equal(explicitHazardDenial('Nein, kein Gasgeruch', 'electric'), false);
  assert.equal(explicitHazardDenial('Nein, keine Funken', 'none'), false);
  assert.equal(explicitHazardDenial('Nein, keine Funken', 'other'), false);
});

test('Hazard denial never clears uncertainty, a new danger, unrelated details or physical resolution', () => {
  for (const [hazard, message] of [
    ['gas', 'Ich bin nicht sicher ob es nach Gas riecht'],
    ['gas', 'Vielleicht kein Gasgeruch'],
    ['gas', 'Gasgeruch kann ich nicht ausschliessen'],
    ['gas', 'Ich weiss nicht, ob es kein Gas ist'],
    ['electric', 'Keine Funken, aber die Steckdose raucht'],
    ['electric', 'Ich sehe keine Funken mehr'],
    ['gas', 'Jetzt kein Gasgeruch'],
    ['fire', 'Kein Rauch mehr, wir haben den Brand gelöscht'],
    ['water', 'Der Rohrbruch wurde repariert'],
    ['electric', 'Im Schlafzimmer'],
    ['electric', 'Nein, das Licht geht nicht'],
    ['gas', 'Was wäre wenn ich keinen Gasgeruch bemerke?'],
  ]) assert.equal(explicitHazardDenial(message, hazard), false, message);
});
