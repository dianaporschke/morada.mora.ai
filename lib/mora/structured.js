import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { correctionInstructions } from './instructions.js';

/** Native-schema controls in the current Preview returned unreadable JSON in
 * three independent scenarios. Keep the tested JSON transport with explicit
 * schema guidance and independent server validation until that path is reliable.
 */
export async function generateStructured({ schema, promptSchema=schema, contextInstructions='', name, model, instructions, messages, maxOutputTokens, maxRetries, abortSignal, providerOptions, validateOutput=undefined, logInvalid=undefined, reasoningEffort='low' }) {
  const settings = {model, instructions, messages, maxOutputTokens, maxRetries, abortSignal, providerOptions};
  const useJsonMode = model.modelId === 'inception/mercury-2.5';
  // Inception defaults to medium reasoning. Bounded extraction/wording should leave
  // time and output tokens for the answer within MORA's shared request deadline.
  if (useJsonMode) {
    // SDK 7's documented cross-provider control maps to Mercury's native effort.
    // Avoid relying on an untyped provider-specific option namespace.
    settings.reasoning = reasoningEffort;
    const compact = value => Array.isArray(value) ? value.map(compact) : value && typeof value==='object'
      ? Object.fromEntries(Object.entries(value).filter(([key])=>!['description','$schema','title'].includes(key)).map(([key,item])=>[key,compact(item)])) : value;
    settings.instructions = `${instructions}\nReturn one ${name} JSON object. Omit unused optional fields.\n${JSON.stringify(compact(z.toJSONSchema(promptSchema,{reused:'ref'})))}`;
  }
  // Keep the complete static personality/schema prefix before changing context,
  // so implicit provider prompt caching can reuse it across turns.
  if (contextInstructions) settings.instructions=`${settings.instructions}\n${contextInstructions}`;
  const usages=[];
  const totalUsage=()=>{
    const count=read=>usages.length && usages.every(usage=>Number.isSafeInteger(read(usage))) ? usages.reduce((sum,usage)=>sum+read(usage),0) : undefined;
    return {inputTokens:count(u=>u?.inputTokens),outputTokens:count(u=>u?.outputTokens),
      inputTokenDetails:{cacheReadTokens:count(u=>u?.inputTokenDetails?.cacheReadTokens)},
      outputTokenDetails:{reasoningTokens:count(u=>u?.outputTokenDetails?.reasoningTokens)}};
  };
  // At most one genuine correction, only for a violated data/capability contract.
  // Network/auth/billing failures are not retried; the same AbortSignal bounds
  // both generations and invalid wording is never shown to the customer.
  for (let attempt=0;attempt<=(validateOutput ? 1 : 0);attempt++) {
    let result;
    try {
      result=await generateText({...settings,output:useJsonMode ? Output.json({name}) : Output.object({schema:promptSchema,name})});
      usages.push(result.usage);
      const data=schema.parse(result.output);
      validateOutput?.(data);
      return {data,usage:result.usage,totalUsage:totalUsage(),generationCount:attempt+1,metadata:result.finalStep.providerMetadata};
    } catch (error) {
      const parseFailure=NoObjectGeneratedError.isInstance(error);
      // Output.json may throw before the application schema is reached. Only
      // generated-output failures qualify for repair, never auth/network/billing.
      if (!result && !parseFailure) throw Object.assign(error,{totalUsage:totalUsage(),generationCount:attempt+1});
      if (parseFailure) {usages.push(error.usage); }
      const usage=result?.usage || error.usage;
      const responseId=error.response?.id;
      const metadata=result?.finalStep.providerMetadata || (/^gen_[a-zA-Z0-9_-]{1,100}$/.test(responseId || '') ? {gateway:{generationId:responseId}} : undefined);
      const issues=(error.issues || []).flatMap(issue=>issue.code==='invalid_union' && Array.isArray(issue.errors)
        ? issue.errors[result?.output?.reply ? 0 : 1] || [issue] : [issue]);
      const validationFields=parseFailure ? ['root:unreadable_json'] : error.validation ? [`${error.validationField || 'dialogue.reply'}:${error.validation}`] : issues.slice(0,12).map(issue=>{
        const path=issue.path.join('.'); return `${/^[a-zA-Z0-9_.]{0,120}$/.test(path) ? path || 'root' : 'unknown_field'}:${issue.code}`;
      });
      const invalid=Object.assign(new Error('Invalid structured answer'),{type:'invalid_model_output',usage,totalUsage:totalUsage(),generationCount:attempt+1,metadata,validationFields});
      if (attempt===1 || !validateOutput) throw invalid;
      logInvalid?.(invalid);
      // Repair is a system instruction, not a fabricated customer turn. Keep the
      // real customerMessage and the same bounded history as the sole input.
      settings.instructions = `${settings.instructions}\n${correctionInstructions(validationFields)}`;
    }
  }
}
