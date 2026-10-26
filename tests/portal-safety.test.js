import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortalService} from '../lib/mora/portal/service.js';
import {MODEL} from '../lib/mora/portal/budget.js';
import {hydrateSimple,projectDecision,commitDecision} from '../lib/mora/simple/state.js';
import {controls} from '../api/portal-chat.js';
import {detectHazard} from '../lib/mora/safety.js';

test('validated model risk suppresses portal actions even when the lexical detector misses it',async()=>{
  const initial='Meine Lampe im Büro geht nicht. Es gibt keine Funken und keinen Rauch.';
  const first={intent:'issue',reply:'Sie können die Angaben ergänzen.',actions:[],updates:[{ref:'new1',quote:initial,equipment:'light',location:'Büro',defect:'kaputt'}]};
  const before=commitDecision(projectDecision(hydrateSimple(null),initial,first),initial,first).state;
  const correction='Vorhin hat es allerdings einmal kurz gefunkt. Jetzt ist die Lampe ausgeschaltet.';
  assert.equal(detectHazard(correction).hazard,'none','Fixture exercises the semantic risk path');
  assert.ok(controls(before).save);
  let plan={intent:'issue',reply:'Bitte lassen Sie die Lampe ausgeschaltet und halten Sie Abstand.',actions:[],updates:[{ref:'active',quote:correction,risk:'electric',details:'Hat kurz gefunkt; jetzt ausgeschaltet.'}]},calls=0;
  const service=createPortalService({resolve:async()=>({ready:true,provider:'gateway',model:MODEL,createModel:()=>({})}),guard:async()=>{},generate:async()=>({output:++calls%2?plan:{violations:[]},usage:{},finalStep:{providerMetadata:{}}})});
  const result=await service(correction,before,['cases']);
  assert.equal(result.state.safety.hazard,'electric');assert.equal(result.state.safety.source,correction);
  assert.equal(controls(result.state).save,null);assert.equal(controls(result.state).review,null);
  plan={intent:'issue',reply:'Bitte halten Sie weiterhin Abstand.',actions:[],updates:[{ref:'active',quote:'Ich lasse sie ausgeschaltet und fasse nichts an.',risk:'none'}]};
  const next=await service('Ich lasse sie ausgeschaltet und fasse nichts an.',result.state,['cases']);
  assert.equal(next.state.safety.hazard,'electric');assert.equal(controls(next.state).save,null);
});
