import test from 'node:test';
import assert from 'node:assert/strict';
import {gatewayRefusalDiagnostic} from '../lib/mora/portal/gateway-diagnostic.js';

const refusal={status:403,reason:'no_providers_available'};
test('Gateway routing refusal is extracted from wrapped SDK errors without request data',()=>{
  const error={message:'outer exception',requestBody:'customer conversation',headers:{authorization:'secret'},cause:{responseBody:JSON.stringify({error:{type:'no_providers_available',message:'This model requires purchased credits.'},request:'customer conversation'})}};
  assert.deepEqual(gatewayRefusalDiagnostic(error,refusal),{...refusal,message:'This model requires purchased credits.'});
});
test('Gateway diagnostics omit unrelated exceptions and model output',()=>{
  assert.equal(gatewayRefusalDiagnostic({message:'private output'}, {status:500,reason:'internal_server_error'}),null);
  assert.deepEqual(gatewayRefusalDiagnostic({message:'private output',data:{error:{type:'other',message:'private output'}}},refusal),{...refusal,message:null});
});
test('Gateway diagnostic removes credentials, links, email addresses and log control characters',()=>{
  const error={data:{error:{type:'no_providers_available',message:'Contact test@example.org\nBearer short-secret https://example.org/?token=secret sk_abcdefghijklmnopqrstuvwxyz'}}};
  const result=gatewayRefusalDiagnostic(error,refusal);
  assert.equal(result.message,'Contact [email removed] [credential removed] [url removed] [identifier removed]');
});
