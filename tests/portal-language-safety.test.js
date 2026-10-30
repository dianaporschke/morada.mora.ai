import test from 'node:test';import assert from 'node:assert/strict';
import {detectHazard,explicitHazardDenial} from '../assets/mora-safety.js';
import {canonicalEquipment} from '../assets/mora-data.js';
import {hasUnconfirmedSuccess,hasUnsupportedEmergencyRole} from '../lib/mora/portal/reply-validation.js';
import {portalLanguageInstructions} from '../lib/mora/portal/language.js';

test('DE, EN and FR hazards share immediate safety and distinguish negation, uncertainty and hypothetical questions',()=>{
 const examples={gas:['Ich rieche Gas.','I smell gas.','Je sens une odeur de gaz.'],fire:['Es gibt Rauch.','There is smoke.','Il y a de la fumée.'],electric:['Die Steckdose funkt.','Sparks are coming from the socket.','Il y a des étincelles dans la prise.'],water:['Wasser kommt aus der Decke.','Water is pouring through the ceiling.','De l’eau coule du plafond.']};
 for(const [hazard,messages] of Object.entries(examples))for(const message of messages)assert.equal(detectHazard(message).hazard,hazard,message);
 for(const text of ['Kein Rauch und keine Funken.','There is no smoke and no sparks.','Il n’y a pas de fumée ni d’étincelles.','Hypothetically, what if there is a gas leak?','Que faire si je sens une odeur de gaz ?','Last year there was smoke.','L’année dernière, il y avait de la fumée.'])assert.equal(detectHazard(text).hazard,'none',text);
 for(const text of ['I am not sure, but I may smell gas.','Je ne suis pas sûr, mais il y a une odeur de gaz.'])assert.equal(detectHazard(text).hazard,'gas',text);
 for(const text of ['Kein Rauch, aber die Steckdose funkt.','No smoke, but there are sparks.','Pas de fumée, mais des étincelles.'])assert.equal(detectHazard(text).hazard,'electric',text);
});
test('correcting a misheard hazard differs from saying it has stopped in all languages',()=>{
 for(const text of ['Es gab keinen Rauch; ich habe mich vertan.','There was no smoke; I was mistaken.','Il n’y avait pas de fumée ; je me suis trompé.'])assert.equal(explicitHazardDenial(text,'fire'),true,text);
 for(const text of ['Der Rauch ist jetzt weg.','The smoke has stopped.','La fumée a cessé.','Maybe there is no smoke.','Il n’y a peut-être pas de fumée.'])assert.equal(explicitHazardDenial(text,'fire'),false,text);
});
test('EN/FR effect and emergency claims retain the existing review barriers',()=>{
 for(const text of ['I have sent your request to MORADA.','J’ai envoyé votre demande à MORADA.','I have not only saved but also sent your request.'])assert.equal(hasUnconfirmedSuccess(text),true,text);
 for(const text of ['I have not sent your request.','Je n’ai pas envoyé votre demande.'])assert.equal(hasUnconfirmedSuccess(text),false,text);
 assert.equal(hasUnconfirmedSuccess('I have saved your request locally.',{localStorageConfirmed:true}),false);
 assert.equal(hasUnconfirmedSuccess('J’ai enregistré votre demande sur cet appareil.',{localStorageConfirmed:true}),false);
 for(const text of ['If there is a fire, contact me here first.','Je vais appeler les pompiers.','I will call the emergency services.'])assert.equal(hasUnsupportedEmergencyRole(text),true,text);
 for(const text of ['In a fire, do not wait for my reply.','En cas d’incendie, n’attendez pas ma réponse.','Once you are safe after the fire, you can contact us.'])assert.equal(hasUnsupportedEmergencyRole(text),false,text);
});
test('equipment aliases preserve original evidence and reject negated comparisons',()=>{
 for(const [value,code] of [['lamp','light'],['lampe','light'],['socket','socket'],['prise','socket'],['chauffage','heater']])assert.equal(canonicalEquipment(value),code);
 for(const text of ['Not the lamp, the socket.','Pas la lampe, la prise.'])assert.equal(canonicalEquipment('unknown',text),'unknown');
 assert.equal(canonicalEquipment('mon appareil spécial'),'mon appareil spécial');
 assert.match(portalLanguageInstructions('fr'),/French/);assert.match(portalLanguageInstructions('en'),/English/);assert.match(portalLanguageInstructions('invalid'),/German/);
});
