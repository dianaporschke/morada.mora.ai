import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPortalChatHandler} from '../api/portal-chat.js';
import {hydrateSimple,projectDecision,commitDecision,simpleContext} from '../lib/mora/simple/state.js';
import {readSession} from '../lib/mora/session.js';

async function call(handler,body){let status=200,data;await handler({method:'POST',body},{setHeader(){},status(n){status=n;return this;},json(v){data=v;}});return {status,data};}
function service(observe){return async(message,previous)=>{
  observe?.(simpleContext(previous).context);
  const plan={intent:'issue',reply:'Sie können die Angaben ergänzen.',actions:[],updates:previous.issue?[]:[{ref:'new1',quote:message,equipment:'light',defect:'kaputt',location:'Wohnzimmer'}]};
  return {...commitDecision(projectDecision(previous,message,plan),message,plan),navigation:[],modelCalls:1};
};}
test('native portal offer survives into the next signed model context without claiming a saved draft',async()=>{
  let context;const handler=createPortalChatHandler({converse:service(c=>context=c)});
  const first=await call(handler,{message:'Lampe im Wohnzimmer kaputt',messageId:randomUUID(),navigation:['cases']});
  assert.equal(first.status,200);assert.equal(first.data.controls.save.operation,'create');
  assert.equal(readSession(first.data.session).issue.draftOfferShown,true);
  await call(handler,{session:first.data.session,message:'Es betrifft nur eine Lampe.',messageId:randomUUID(),navigation:['cases']});
  assert.equal(context.issues[0].draftAction.status,'offered');assert.equal(context.issues[0].draftAction.canOffer,false);
  assert.equal(context.issues[0].draft.exists,false);assert.equal(context.issues[0].draft.transmitted,false);
  const ticket=await call(handler,{session:first.data.session,action:'save-issue',navigation:['cases']});
  assert.equal(ticket.status,200);assert.equal(ticket.data.mode,'write_ticket');
});
test('no offer is recorded when the native case function is unavailable',async()=>{
  const handler=createPortalChatHandler({converse:service()});
  const result=await call(handler,{message:'Lampe im Wohnzimmer kaputt',messageId:randomUUID(),navigation:[]});
  assert.equal(result.status,200);assert.equal(Boolean(readSession(result.data.session).issue.draftOfferShown),false);
});
