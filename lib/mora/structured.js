import { generateText, Output, tool } from 'ai';

/** Mercury's Gateway adapter supports tools, but currently drops responseFormat schemas.
 * An answer tool carries the same schema without executing anything or starting a loop.
 */
export async function generateStructured({ schema, name, model, instructions, messages, maxOutputTokens, maxRetries, abortSignal, providerOptions }) {
  const settings = {model, instructions, messages, maxOutputTokens, maxRetries, abortSignal, providerOptions};
  const useAnswerTool = model.modelId === 'inception/mercury-2.5';
  // Inception defaults to medium reasoning. Bounded extraction/wording should leave
  // time and output tokens for the answer within MORA's shared request deadline.
  if (useAnswerTool) settings.providerOptions = {...providerOptions, inception:{reasoningEffort:'low'}};
  const result = await generateText({ ...settings, ...(useAnswerTool ? {
    tools:{ mora_result:tool({ description:`Return the ${name} structured result. This tool only returns data and has no executable action.`, inputSchema:schema }) },
    toolChoice:{ type:'tool', toolName:'mora_result' },
  } : { output:Output.object({schema, name}) }) });
  try {
    if (useAnswerTool) {
      const calls = result.toolCalls;
      if (calls.length !== 1 || calls[0].toolName !== 'mora_result' || calls[0].invalid) {
        throw new Error('Missing or invalid structured answer');
      }
      return { data:schema.parse(calls[0].input), usage:result.usage, metadata:result.finalStep.providerMetadata };
    }
    return { data:schema.parse(result.output), usage:result.usage, metadata:result.finalStep.providerMetadata };
  } catch {
    // Preserve usage for cost accounting, never expose the model text or tool arguments.
    throw Object.assign(new Error('Invalid structured answer'), {type:'invalid_model_output', usage:result.usage});
  }
}
