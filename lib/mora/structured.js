import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';
import { correctionInstructions } from './instructions.js';

/** Mercury's Gateway adapter drops responseFormat schemas. Send its schema in the
 * system instructions, request JSON, and enforce the original schema on the server.
 */
export async function generateStructured({ schema, name, model, instructions, messages, maxOutputTokens, maxRetries, abortSignal, providerOptions, validateOutput=undefined, logInvalid=undefined, reasoningEffort='low' }) {
  const settings = {model, instructions, messages, maxOutputTokens, maxRetries, abortSignal, providerOptions};
  const useJsonMode = model.modelId === 'inception/mercury-2.5';
  // Inception defaults to medium reasoning. Bounded extraction/wording should leave
  // time and output tokens for the answer within MORA's shared request deadline.
  if (useJsonMode) {
    settings.providerOptions = {...providerOptions, inception:{reasoningEffort}};
    settings.instructions = `${instructions}\nReturn one ${name} JSON object. Required properties only, plus relevant updates; omit unused optional fields. This schema is a data contract, not a questionnaire.\n${JSON.stringify(z.toJSONSchema(schema,{reused:'ref'}))}`;
  }
  const usages=[];
  // At most one genuine correction, only for a violated data/capability contract.
  // Network/auth/billing failures are not retried; the same AbortSignal bounds
  // both generations and invalid wording is never shown to the customer.
  for (let attempt=0;attempt<=(validateOutput ? 1 : 0);attempt++) {
    let result;
    try {
      result=await generateText({...settings,output:useJsonMode ? Output.json({name}) : Output.object({schema,name})});
      usages.push(result.usage);
      const data=schema.parse(result.output);
      validateOutput?.(data);
      const count=(read)=>usages.every(usage=>Number.isSafeInteger(read(usage))) ? usages.reduce((sum,usage)=>sum+read(usage),0) : undefined;
      const totalUsage={inputTokens:count(u=>u.inputTokens),outputTokens:count(u=>u.outputTokens),
        inputTokenDetails:{cacheReadTokens:count(u=>u.inputTokenDetails?.cacheReadTokens)},
        outputTokenDetails:{reasoningTokens:count(u=>u.outputTokenDetails?.reasoningTokens)}};
      return {data,usage:result.usage,totalUsage,generationCount:attempt+1,metadata:result.finalStep.providerMetadata};
    } catch (error) {
      const parseFailure=NoObjectGeneratedError.isInstance(error);
      // Output.json may throw before the application schema is reached. Only
      // generated-output failures qualify for repair, never auth/network/billing.
      if (!result && !parseFailure) throw error;
      if (parseFailure) {usages.push(error.usage); }
      const usage=result?.usage || error.usage;
      const responseId=error.response?.id;
      const metadata=result?.finalStep.providerMetadata || (/^gen_[a-zA-Z0-9_-]{1,100}$/.test(responseId || '') ? {gateway:{generationId:responseId}} : undefined);
      const validationFields=parseFailure ? ['root:unreadable_json'] : error.validation ? [`${error.validationField || 'dialogue.reply'}:${error.validation}`] : (error.issues || []).slice(0,12).map(issue=>{
        const path=issue.path.join('.'); return `${/^[a-zA-Z0-9_.]{0,120}$/.test(path) ? path || 'root' : 'unknown_field'}:${issue.code}`;
      });
      const invalid=Object.assign(new Error('Invalid structured answer'),{type:'invalid_model_output',usage,metadata,validationFields});
      if (attempt===1 || !validateOutput) throw invalid;
      logInvalid?.(invalid);
      // Repair is a system instruction, not a fabricated customer turn. Keep the
      // real customerMessage and the same bounded history as the sole input.
      settings.instructions = `${settings.instructions}\n${correctionInstructions(validationFields)}`;
    }
  }
}
