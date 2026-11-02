// Synthetic, in-process security checks: no live inference or customer data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {guardApiRequest} from '../lib/http-security.js';
import {createChatHandler} from '../api/chat.js';
import {createSimpleChatHandler} from '../api/chat-simple.js';
import {createPortalChatHandler} from '../api/portal-chat.js';
import {createRequestsHandler} from '../api/requests.js';
import {createReadinessHandler} from '../api/ai-readiness.js';
import {createEvaluationHandler} from '../api/ai-evaluation.js';

const preview={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/mora-ai-2.0',MORA_AI_CREDIT_CHECK:'true'};
const headers={'host':'portal.example','origin':'https://portal.example','content-type':'application/json; charset=utf-8','sec-fetch-site':'same-origin'};
async function call(handler,request){const result={status:200,headers:{},data:null};const res={setHeader:(k,v)=>{result.headers[k]=v;},status:s=>{result.status=s;return res;},json:d=>{result.data=d;return res;}};await handler(request,res);return result;}
const message=()=>({message:'Synthetische Nachricht',messageId:randomUUID(),navigation:[]});

test('all existing HTTP entry points reject cross-site and form posts before inference, authorization or diagnostic work',async()=>{
 let calls=0;const forbidden=async()=>{calls++;throw Error('Must not be called');};
 const handlers=[createChatHandler(forbidden),createSimpleChatHandler({converse:forbidden}),createPortalChatHandler({converse:forbidden,preflight:forbidden}),createRequestsHandler({connected:true,authorize:forbidden,submit:forbidden}),createReadinessHandler({env:preview,readCredits:forbidden}),createEvaluationHandler({env:preview,generate:forbidden,makeUnderstanding:()=>forbidden})];
 for(const handler of handlers)for(const [requestHeaders,status] of [[{...headers,origin:'https://external.invalid'},403],[{...headers,'sec-fetch-site':'cross-site'},403],[{...headers,'content-type':'application/x-www-form-urlencoded'},415],[{host:'portal.example'},415],[{...headers,origin:'null'},403]]){
  const r=await call(handler,{method:'POST',headers:requestHeaders,body:message()});assert.equal(r.status,status);assert.equal(r.headers['Cache-Control'],'private, no-store');assert.equal(r.headers['X-Content-Type-Options'],'nosniff');
 }
 assert.equal(calls,0);
});

test('same-origin JSON and non-browser JSON clients retain the existing request behavior',async()=>{
 let calls=0;const handler=createPortalChatHandler({converse:async(_message,state)=>{calls++;return {state,reply:'Synthetische Antwort',navigation:[],modelCalls:0};}});
 for(const h of [headers,{host:'portal.example','content-type':'application/json'}]){const r=await call(handler,{method:'POST',headers:h,body:message()});assert.equal(r.status,200);assert.equal(r.data.reply,'Synthetische Antwort');}
 assert.equal(calls,2);
 const r=await call(async(req,res)=>{assert.equal(guardApiRequest(req,res),true);res.status(204).json(null);},{method:'GET',headers:{host:'portal.example'}});assert.equal(r.status,204);
});

test('preview preflight never returns credit amounts, pricing or arbitrary guard details',async()=>{
 const handler=createPortalChatHandler({preflight:async()=>({balanceUsd:123.45,totalUsedUsd:99.98,pricing:{secret:'SYNTHETIC_PRIVATE'},unexpected:'SYNTHETIC_PRIVATE'})});
 const r=await call(handler,{method:'GET',headers});assert.equal(r.status,200);assert.equal(r.data.preflightPassed,true);assert.equal(r.data.inferenceStarted,false);assert.doesNotMatch(JSON.stringify(r.data),/balanceUsd|totalUsedUsd|pricing|SYNTHETIC_PRIVATE|123\.45/);
});

test('public portal errors omit rejected replies, provider bodies and arbitrary diagnostic details',async()=>{
 const error=Object.assign(Error('SYNTHETIC_PRIVATE'),{code:'MODEL_UNAVAILABLE',availability:{provider:'gateway',model:'test-model',status:503,reason:'unavailable',responseBody:'SYNTHETIC_PRIVATE'},diagnostic:{rejectedReply:'SYNTHETIC_PRIVATE',detail:'SYNTHETIC_PRIVATE'},toolEvents:[{tool:'record_issues',ok:false,detail:'SYNTHETIC_PRIVATE'},null]});
 const handler=createPortalChatHandler({integration:'portal_agent_v1',converse:async()=>{throw error;}});
 const r=await call(handler,{method:'POST',headers,body:message()});assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(r.data),/SYNTHETIC_PRIVATE|responseBody|rejectedReply/);assert.equal(r.data.diagnostic,undefined);assert.deepEqual(r.data.toolEvents,[{tool:'record_issues',ok:false}]);assert.deepEqual(Object.keys(r.data.availability).sort(),['model','provider','reason','status']);
});

test('model failure logs never contain arbitrary validation data from an exception',async()=>{
 const previous=console.warn,logs=[];console.warn=(...args)=>logs.push(args);
 try{
  const handler=createChatHandler(async()=>{throw Object.assign(Error('synthetic failure'),{code:'MODEL_UNAVAILABLE',availability:{provider:'gateway',model:'test',reason:'unavailable',status:503},validation:{private:'SYNTHETIC_PRIVATE'}});});
  const r=await call(handler,{method:'POST',headers,body:{message:'Die Lampe im Badezimmer ist defekt.'}});assert.equal(r.status,503);assert.ok(logs.length);assert.doesNotMatch(JSON.stringify(logs),/SYNTHETIC_PRIVATE|validation/);
 }finally{console.warn=previous;}
});
