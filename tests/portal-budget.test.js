import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPreviewCredits,createPreviewCreditGuard,readGatewayPrice,priceForInput,BASELINE_USED_USD,MAX_USED_USD} from '../lib/mora/portal/budget.js';

const credits=used=>({balance:25-used,totalUsed:used});
test('paid preview honours the approved baseline and reserves the next request',()=>{
  assert.equal(checkPreviewCredits(credits(BASELINE_USED_USD)).budgetMode,'bounded_paid_preview');
  assert.equal(checkPreviewCredits(credits(MAX_USED_USD-.05),.04).maxUsedUsd,MAX_USED_USD);
  assert.throws(()=>checkPreviewCredits(credits(MAX_USED_USD-.05),.06),e=>e.code==='PREVIEW_CREDIT_BOUNDARY'&&e.boundaryReason==='cap');
  assert.throws(()=>checkPreviewCredits(credits(.1)),/boundary/);
});
test('unverified credits and malformed reservations fail closed',()=>{
  for(const value of [null,undefined,{}, {balance:null,totalUsed:25},{balance:'',totalUsed:25},{balance:Infinity,totalUsed:0},{balance:-1,totalUsed:26},{balance:25.4,totalUsed:-.4},{balance:4.6,totalUsed:.4},{balance:44.6,totalUsed:.4}])assert.throws(()=>checkPreviewCredits(value));
  for(const reserve of [-1,NaN,Infinity])assert.throws(()=>checkPreviewCredits(credits(.4),reserve));
});
test('test allowance is unavailable outside Preview before any network access',async()=>{
  for(const VERCEL_ENV of [undefined,'development','production'])await assert.rejects(createPreviewCreditGuard({VERCEL_ENV})(),e=>e.boundaryReason==='preview_only');
  for(const args of [[-1,1],[1,-1],[NaN,1],[1,Infinity],[.5,1]])await assert.rejects(createPreviewCreditGuard({VERCEL_ENV:'preview'})(...args),e=>e.boundaryReason==='invalid_reserve');
});
test('model comparison cannot use an arbitrary model or change the existing spend cap',()=>{
 assert.throws(()=>createPreviewCreditGuard({VERCEL_ENV:'preview'},'unapproved/model'),e=>e.boundaryReason==='model_unverified');
 assert.equal(MAX_USED_USD,3.338856132);
});
test('price reservations use the exact fast catalog entry and never the base price',async()=>{
 const models=[{id:'anthropic/claude-opus-5.5',pricing:{input:'0.000004',output:'0.00002'}},{id:'anthropic/claude-opus-5.5-fast',pricing:{input:'0.000008',output:'0.00004'}}];
 const fetcher=async url=>{assert.equal(url,'https://ai-gateway.vercel.sh/v1/models');return {ok:true,json:async()=>({data:models})};};
 assert.deepEqual(await readGatewayPrice('anthropic/claude-opus-5.5-fast',fetcher),{input:.000008,output:.00004});
 models.pop();await assert.rejects(readGatewayPrice('anthropic/claude-opus-5.5-fast',fetcher),e=>e.boundaryReason==='pricing_unverified');
 models[0].pricing.input='NaN';await assert.rejects(readGatewayPrice('anthropic/claude-opus-5.5',fetcher),e=>e.boundaryReason==='pricing_unverified');
});
test('long input reservations respect live Haiku tier prices',async()=>{
 const pricing={input:'0.0000001',output:'0.0000005',input_tiers:[{min:0,cost:'0.0000001'},{min:100001,cost:'0.0000005'}],output_tiers:[{min:0,cost:'0.0000005'},{min:100001,cost:'0.0000025'}]};
 const read=()=>readGatewayPrice('haiku',async()=>({ok:true,json:async()=>({data:[{id:'haiku',pricing}]})}));
 const p=await read();assert.deepEqual(priceForInput(p,100000),{input:.0000001,output:.0000005});
 assert.deepEqual(priceForInput(p,100001),{input:.0000005,output:.0000025});
 pricing.input_tiers[1].cost='invalid';await assert.rejects(read(),e=>e.boundaryReason==='pricing_unverified');
});
