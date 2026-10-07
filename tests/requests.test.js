import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestsHandler } from '../api/requests.js';
import { sealSession } from '../lib/mora/session.js';
const draft={id:'test-issue',description:'Steckdose defekt'};
const session=sealSession({version:2,issue:draft,issues:[draft],history:[],actions:[]});
const req={method:'POST',body:{session,idempotencyKey:draft.id}};
const response=()=>({code:200,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

test('Prepared request adapter refuses missing permissions before any backend side effect',async()=>{
  let called=false;const handler=createRequestsHandler({connected:true,submit:async()=>{called=true;return {accepted:true,requestId:'fake'};}});
  const res=response();await handler(req,res);assert.equal(res.code,403);assert.equal(called,false);assert.equal(res.body.accepted,false);
});
test('Prepared request contract confirms only a positive authorised backend receipt (simulated adapter)',async()=>{
  const handler=createRequestsHandler({connected:true,authorize:async()=>({customerId:'test-customer',canSubmit:true}),submit:async({customerContext,idempotencyKey})=>{
    assert.equal(customerContext.customerId,'test-customer');assert.equal(idempotencyKey,draft.id);return {accepted:true,requestId:'test-receipt'};
  }});
  const res=response();await handler(req,res);assert.equal(res.code,201);assert.deepEqual(res.body,{accepted:true,requestId:'test-receipt'});
});
test('Prepared request contract never converts errors, missing receipts or mismatched keys into success',async()=>{
  for(const submit of [async()=>({accepted:true}),async()=>({accepted:false}),async()=>{throw new Error('timeout');}]){
    const handler=createRequestsHandler({connected:true,authorize:async()=>({customerId:'test-customer',canSubmit:true}),submit});
    const res=response();await handler(req,res);assert.equal(res.body.accepted,false);assert.ok(res.code>=500);
  }
  let called=false;const handler=createRequestsHandler({connected:true,authorize:async()=>({customerId:'test-customer',canSubmit:true}),submit:async()=>{called=true;return {accepted:true,requestId:'fake'};}});
  const res=response();await handler({...req,body:{...req.body,idempotencyKey:'wrong'}},res);assert.equal(res.code,409);assert.equal(called,false);
});
