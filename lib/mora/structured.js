import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';

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
    settings.instructions = `${instructions}\nReturn exactly one JSON object matching this ${name} JSON schema. Include required properties; OMIT unused optional properties. Do not add properties or invent facts. Follow property descriptions. Use null only for required nullable values without a fact; do not fill an unrelated form with null placeholders.\n${JSON.stringify(z.toJSONSchema(schema))}`;
  }
  const usages=[];
  // At most one genuine correction, only for a violated data/capability contract.
  // Network/auth/billing failures are not retried; the same AbortSignal bounds
  // both generations and invalid wording is never shown to the customer.
  for (let attempt=0;attempt<=(validateOutput ? 1 : 0);attempt++) {
    let result, rawOutput;
    try {
      result=await generateText({...settings,output:useJsonMode ? Output.json({name}) : Output.object({schema,name})});
      usages.push(result.usage); rawOutput=JSON.stringify(result.output);
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
      if (parseFailure) {usages.push(error.usage); rawOutput=(error.text || '').slice(0,16000);}
      const usage=result?.usage || error.usage;
      const responseId=error.response?.id;
      const metadata=result?.finalStep.providerMetadata || (/^gen_[a-zA-Z0-9_-]{1,100}$/.test(responseId || '') ? {gateway:{generationId:responseId}} : undefined);
      const validationFields=parseFailure ? ['root:unreadable_json'] : error.validation ? [`${error.validationField || 'dialogue.reply'}:${error.validation}`] : (error.issues || []).slice(0,12).map(issue=>{
        const path=issue.path.join('.'); return `${/^[a-zA-Z0-9_.]{0,120}$/.test(path) ? path || 'root' : 'unknown_field'}:${issue.code}`;
      });
      const invalid=Object.assign(new Error('Invalid structured answer'),{type:'invalid_model_output',usage,metadata,validationFields});
      if (attempt===1 || !validateOutput) throw invalid;
      logInvalid?.(invalid);
      settings.messages=[...messages,{role:'assistant',content:rawOutput || 'No readable structured response was generated.'},
        {role:'user',content:`The previous JSON was rejected and was NOT shown or executed. Correct these contract failures: ${validationFields.join(', ')}. Return a COMPLETE JSON matching the schema, no extra fields. All available actions are local draft preparation or allowed navigation. Sending is NOT connected: do not claim, promise or offer sending, do not ask to send. If a draft was already offered, acknowledge new facts without repeating that offer unless the customer requests it. MORA is software in this chat, not staff visiting in person. Each issue in a multi-issue message needs its own exact, non-overlapping sourceQuote. Never copy another issue's room or risk. Ordinary dripping is risk=none, not flood. For repeated_question, do NOT ask that field again. Device type is different from ownership/fixed installation: that distinction uses question=details, never equipment when the device type is known. If no useful fact is missing, acknowledge the update without another question. A reply that asks for a fact uses stage=clarify, with question and clarification. Do not offer a draft in the same clarification. Preserve known facts and explicit unknown answers.`}];
    }
  }
}
