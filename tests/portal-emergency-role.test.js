import test from 'node:test';
import assert from 'node:assert/strict';
import {hasUnsupportedEmergencyRole} from '../lib/mora/portal/reply-validation.js';
import {safetyNotice,detectHazard} from '../assets/mora-safety.js';

const screenshot='Danke, dann geht es um die eine Heizung im Wohnzimmer. Falls Wasser austritt, es nach Gas riecht oder Sie eine Gefahr bemerken, schützen Sie bitte zuerst sich und andere und melden Sie sich sofort bei mir.';

test('reported screenshot and paraphrased emergency invitations are blocked without classifying the customer as in danger',()=>{
  for(const reply of [screenshot,
    'Bei Gasgeruch kontaktieren Sie MORA sofort.',
    'Wenn Funken auftreten, wenden Sie sich an mich.',
    'Bei einem Notfall schreiben Sie bitte hier.',
    'Es riecht nach Gas? Warten Sie auf meine Antwort.',
    'Bei Gasgeruch bitte nicht zögern, informieren Sie mich sofort.',
    'Bei Gefahr keine Panik und melden Sie sich sofort bei mir.',
    'Melden Sie Gasgeruch nicht bei der Verwaltung, sondern bei mir.',
    'MORA ist Ihre Notfallstelle.',
    'Bei Gefahr werde ich die Feuerwehr alarmieren.',
    'Bei Gasgeruch schicke ich sofort Hilfe.',
  ])assert.equal(hasUnsupportedEmergencyRole(reply),true,reply);
  assert.equal(detectHazard('heizung gehen nicht').hazard,'none');
  assert.equal(detectHazard('heizung in wohnzimmer nur 1 heizung').hazard,'none');
});

test('an already reported danger also protects replies without repeating the hazard word',()=>{
  for(const reply of ['Melden Sie sich sofort bei mir.','Warten Sie bitte auf meine Antwort.','Kontaktieren Sie uns zuerst.']){
    assert.equal(hasUnsupportedEmergencyRole(reply,{hazard:'gas'}),true,reply);
  }
});

test('real emergency guidance, explicit denials and ordinary non-emergency conversation remain available',()=>{
  for(const reply of [
    ...['gas','fire','electric','water'].map(safetyNotice),
    'MORA ist keine Notfallstelle. Bei Gasgeruch verlassen Sie den Gefahrenbereich.',
    'Melden Sie einen Notfall nicht bei mir, sondern bei der Feuerwehr.',
    'Bei Gasgeruch nicht auf meine Antwort warten.',
    'Ich kann die Feuerwehr nicht für Sie alarmieren.',
    'Bei Gasgeruch verlassen Sie das Gebäude. Sobald Sie in Sicherheit sind, können Sie mir später ergänzende Angaben schreiben.',
    'Wo befindet sich der Heizkörper?',
    'Bei weiteren Fragen können Sie sich bei mir melden.',
    'Sie können das Anliegen hier vorbereiten.',
  ])assert.equal(hasUnsupportedEmergencyRole(reply),false,reply);
});
