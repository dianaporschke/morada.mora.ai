import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPreviewCredits,createPreviewCreditGuard,BASELINE_USED_USD,MAX_USED_USD} from '../lib/mora/portal/budget.js';

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
