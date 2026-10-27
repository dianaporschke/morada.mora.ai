import {createGateway} from 'ai';

// Owner-requested model replacement, verified in the live Gateway catalog.
export const MODEL='google/gemini-3.8-flash';
export const AGENT_MODEL='anthropic/claude-sonnet-5.5';
// Owner confirmed a one-time USD 20 purchase on 2026-10-26. Only USD 1 of
// additional account usage is enabled for this isolated, sequential test run.
// This is NOT an auto-reload, platform billing setting, or production budget.
// Credits are eventually consistent; this is not a distributed spend ledger.
export const APPROVED_CREDITS_USD=25, BASELINE_USED_USD=0.374154632;
export const TEST_ALLOWANCE_USD=1, MAX_USED_USD=BASELINE_USED_USD+TEST_ALLOWANCE_USD;
const boundary=reason=>Object.assign(new Error('Preview test-credit boundary'),{code:'PREVIEW_CREDIT_BOUNDARY',boundaryReason:reason});
export function checkPreviewCredits(credits,reserve=0) {
  const number=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')?Number(v):NaN;
  const balance=number(credits?.balance),used=number(credits?.totalUsed);
  if(!Number.isFinite(balance)||!Number.isFinite(used)||balance<0||used<0)throw boundary('unreadable');
  if(!Number.isFinite(reserve)||reserve<0)throw boundary('invalid_reserve');
  if(Math.abs(balance+used-APPROVED_CREDITS_USD)>0.00001)throw boundary('origin_unverified');
  if(used<BASELINE_USED_USD-0.00001)throw boundary('baseline_unverified');
  if(balance-reserve<0.25)throw boundary('reserve');
  if(used+reserve>MAX_USED_USD)throw boundary('cap');
  return {balanceUsd:balance,totalUsedUsd:used,maxUsedUsd:MAX_USED_USD,budgetMode:'bounded_paid_preview',testAllowanceUsd:TEST_ALLOWANCE_USD};
}
export function createPreviewCreditGuard(env=process.env,modelId=MODEL) {
  if(![MODEL,AGENT_MODEL].includes(modelId))throw boundary('model_unverified');
  const gateway=createGateway({apiKey:env.AI_GATEWAY_API_KEY || undefined,
    fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(5000)})});
  let model;
  return async function guard(inputBytes=0,outputTokens=0){
    if(env.VERCEL_ENV!=='preview')throw boundary('preview_only');
    if(!Number.isSafeInteger(inputBytes)||inputBytes<0||!Number.isSafeInteger(outputTokens)||outputTokens<0)throw boundary('invalid_reserve');
    let credit=await gateway.getCredits();
    try{checkPreviewCredits(credit);}catch(error){
      // Credits can settle immediately after an inference. Retry only this
      // read-only observation, never a failed inference or a spend decision.
      if(error.boundaryReason!=='origin_unverified')throw error;
      await new Promise(resolve=>setTimeout(resolve,300));credit=await gateway.getCredits();checkPreviewCredits(credit);
    }
    model ||= (await gateway.getAvailableModels()).models.find(m=>m.id===modelId);
    const input=Number(model?.pricing?.input),output=Number(model?.pricing?.output);
    if(!(Number.isFinite(input)&&Number.isFinite(output)&&input>0&&output>0))throw boundary('pricing_unverified');
    // UTF-8 bytes are a conservative token bound for this text-only request.
    return {...checkPreviewCredits(credit,(inputBytes*input+outputTokens*output)*1.2+0.0001),model:modelId,pricing:{input,output}};
  };
}
