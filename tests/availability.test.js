import test from 'node:test';
import assert from 'node:assert/strict';
import { modelFailure } from '../lib/mora/availability.js';
import { createChatHandler } from '../api/chat.js';
import { createUnderstandingService } from '../lib/mora/understanding.js';

test('Activation, configuration, access, billing and technical failures remain distinct',()=>{
  for (const [reason,category,retryable] of [
    ['inference_disabled','activation',false],['missing_credentials','configuration',false],
    ['invalid_model_configuration','configuration',false],['authentication_failed','authentication',false],
    ['customer_verification_required','account_verification',false],['insufficient_funds','billing',false],
    ['quota_for_entity_exceeded','billing',false],['no_providers_available','model_access',false],
    ['model_not_found','model_access',false],['rate_limit_or_quota','rate_limit',true],
    ['model_timeout','technical',true],['provider_unavailable','technical',true],
  ]) {
    const failure=modelFailure({provider:'gateway',model:'openai/gpt-6-luna',status:null,reason});
    assert.equal(failure.category,category); assert.equal(failure.retryable,retryable);
  }
  const failure=modelFailure({provider:'PRIVATE',model:'SECRET key',reason:'SECRET message',status:999});
  assert.deepEqual(failure.modelAvailability,{provider:null,model:null,status:null,reason:'unavailable'});
  assert.ok(!JSON.stringify(failure).includes('SECRET'));
});

test('Actual hallo handler identifies the disabled switch, logs no customer text and never generates',async t=>{
  let generated=0, logged, status, body;
  t.mock.method(console,'warn',(message,data)=>{logged={message,data};});
  const env={MORA_AI_ENABLED:'false',MORA_AI_REQUIRED:'true',MORA_AI_PROVIDER:'gateway'};
  const handler=createChatHandler(createUnderstandingService({env,generate:async()=>{generated++;}}),{env});
  await handler({method:'POST',body:{message:'hallo'}},{setHeader(){},status(value){status=value;return this;},json(value){body=value;return this;}});
  assert.equal(status,503); assert.equal(generated,0);
  assert.equal(body.category,'activation'); assert.equal(body.retryable,false);
  assert.equal(body.modelAvailability.reason,'inference_disabled');
  assert.match(body.error,/noch nicht aktiviert/); assert.doesNotMatch(body.error,/später erneut/);
  assert.equal(logged.data.reason,'inference_disabled'); assert.ok(!JSON.stringify(logged).includes('hallo'));
});
