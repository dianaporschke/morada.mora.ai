import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readSession, sealSession } from '../lib/mora/session.js';
import { chatInputSchema } from '../lib/mora/schema.js';

test('Long multi-issue conversations produce reusable bounded signed sessions',()=>{
  const issues=Array.from({length:8},(_,i)=>({id:`test-${i}`,category:'general',description:'Original '+i,
    equipment:'unknown',location:'Bad',since:'Seit gestern',details:'All important structured details',
    answers:Array.from({length:30},()=>({question:'additional',answer:randomBytes(1000).toString('hex')})),corrections:[]}));
  const state={version:2,issue:issues[3],issues,actions:[],history:Array.from({length:24},()=>({role:'user',content:randomBytes(1000).toString('hex')}))};
  const token=sealSession(state); assert.ok(token.length<180000); assert.ok(chatInputSchema.safeParse({message:'Weiter',session:token}).success);
  const restored=readSession(token); assert.equal(restored.issues.length,8); assert.equal(restored.issue.id,'test-3');
  assert.ok(restored.issues.every(issue=>issue.details==='All important structured details'));
});
test('OIDC-only production config fails explicitly unless stable session secret exists',()=>{
  const keys=['VERCEL','MORA_SESSION_SECRET','OPENAI_API_KEY','AI_GATEWAY_API_KEY'];const old=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try{for(const key of keys)delete process.env[key];process.env.VERCEL='1';
    assert.throws(()=>sealSession({version:2,issue:null,issues:[],history:[],actions:[]}),{code:'SESSION_CONFIG'});
    process.env.MORA_SESSION_SECRET='test-secret-for-contract-only';const token=sealSession({version:2,issue:null,issues:[],history:[],actions:[]});assert.equal(readSession(token).version,2);
  }finally{for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
