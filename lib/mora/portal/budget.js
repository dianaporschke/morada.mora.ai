import {createGateway} from 'ai';

// Owner-requested model replacement, verified in the live Gateway catalog.
export const MODEL='google/gemini-3.8-flash';
// Existing verified USD 5 free grant. This Preview cannot spend a purchased
// top-up, or continue beyond USD .30 additional account usage since Phase 2.
// No billing setting or platform budget is changed by this application guard.
export const FREE_GRANT=5, MAX_USED_USD=0.659925936;
const boundary=reason=>Object.assign(new Error('Free-credit boundary'),{code:'FREE_CREDIT_BOUNDARY',boundaryReason:reason});
export function checkFreeCredits(credits,reserve=0) {
  const balance=Number(credits.balance),used=Number(credits.totalUsed);
  if(!Number.isFinite(balance)||!Number.isFinite(used))throw boundary('unreadable');
  if(Math.abs(balance+used-FREE_GRANT)>0.00001)throw boundary('origin_unverified');
  if(balance-reserve<0.25)throw boundary('reserve');
  if(used+reserve>MAX_USED_USD)throw boundary('cap');
  return {balanceUsd:balance,totalUsedUsd:used,maxUsedUsd:MAX_USED_USD};
}
export function createFreeCreditGuard(env=process.env) {
  const gateway=createGateway({apiKey:env.AI_GATEWAY_API_KEY || undefined,
    fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(5000)})});
  let model;
  return async function guard(inputBytes=0,outputTokens=0){
    let credit=await gateway.getCredits();
    try{checkFreeCredits(credit);}catch(error){
      // Credits can settle immediately after an inference. Retry only this
      // read-only observation, never a failed inference or a spend decision.
      if(error.boundaryReason!=='origin_unverified')throw error;
      await new Promise(resolve=>setTimeout(resolve,300));credit=await gateway.getCredits();checkFreeCredits(credit);
    }
    model ||= (await gateway.getAvailableModels()).models.find(m=>m.id===MODEL);
    const input=Number(model?.pricing?.input),output=Number(model?.pricing?.output);
    if(!(input>0&&output>0))throw boundary();
    // UTF-8 bytes are a conservative token bound for this text-only request.
    return {...checkFreeCredits(credit,inputBytes*input+outputTokens*output+0.0001),model:MODEL,pricing:{input,output}};
  };
}
