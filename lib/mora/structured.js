import { generateText, Output } from 'ai';
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
    settings.instructions = `${instructions}\nReturn exactly one JSON object matching this ${name} JSON schema. Include every required property; do not add properties. Follow property descriptions. Unmentioned scalar facts are null; arrays are empty unless their descriptions call for entries.\n${JSON.stringify(z.toJSONSchema(schema))}`;
  }
  const usages=[];
  // At most one genuine correction, only for a violated data/capability contract.
  // Network/auth/billing failures are not retried; the same AbortSignal bounds
  // both generations and invalid wording is never shown to the customer.
  for (let attempt=0;attempt<=(validateOutput ? 1 : 0);attempt++) {
    const result=await generateText({...settings,output:useJsonMode ? Output.json({name}) : Output.object({schema,name})});
    usages.push(result.usage);
    try {
      const data=schema.parse(result.output);
      validateOutput?.(data);
      const count=(read)=>usages.every(usage=>Number.isSafeInteger(read(usage))) ? usages.reduce((sum,usage)=>sum+read(usage),0) : undefined;
      const totalUsage={inputTokens:count(u=>u.inputTokens),outputTokens:count(u=>u.outputTokens),
        inputTokenDetails:{cacheReadTokens:count(u=>u.inputTokenDetails?.cacheReadTokens)},
        outputTokenDetails:{reasoningTokens:count(u=>u.outputTokenDetails?.reasoningTokens)}};
      return {data,usage:result.usage,totalUsage,generationCount:attempt+1,metadata:result.finalStep.providerMetadata};
    } catch (error) {
      const validationFields=error.validation ? [`${error.validationField || 'dialogue.reply'}:${error.validation}`] : (error.issues || []).slice(0,12).map(issue=>{
        const path=issue.path.join('.'); return `${/^[a-zA-Z0-9_.]{0,120}$/.test(path) ? path || 'root' : 'unknown_field'}:${issue.code}`;
      });
      const invalid=Object.assign(new Error('Invalid structured answer'),{type:'invalid_model_output',usage:result.usage,metadata:result.finalStep.providerMetadata,validationFields});
      if (attempt===1 || !validateOutput) throw invalid;
      logInvalid?.(invalid);
      settings.messages=[...messages,{role:'assistant',content:JSON.stringify(result.output)},
        {role:'user',content:`The previous JSON was rejected and was NOT shown or executed. Correct these contract failures: ${validationFields.join(', ')}. Return a COMPLETE JSON matching the schema, no extra fields. All available actions are local draft preparation or allowed navigation. Sending is NOT connected: do not claim, promise or offer sending, do not ask to send. If a draft was already offered, acknowledge new facts without repeating that offer unless the customer requests it. MORA is software in this chat, not staff visiting in person. Each issue in a multi-issue message needs its own exact, non-overlapping sourceQuote. Never copy another issue's room or risk. Ordinary dripping is risk=none, not flood. Preserve known facts and explicit unknown answers.`}];
    }
  }
}
