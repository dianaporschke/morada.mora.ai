import { generateText, Output } from 'ai';
import { z } from 'zod';

/** Mercury's Gateway adapter drops responseFormat schemas. Send its schema in the
 * system instructions, request JSON, and enforce the original schema on the server.
 */
export async function generateStructured({ schema, name, model, instructions, messages, maxOutputTokens, maxRetries, abortSignal, providerOptions }) {
  const settings = {model, instructions, messages, maxOutputTokens, maxRetries, abortSignal, providerOptions};
  const useJsonMode = model.modelId === 'inception/mercury-2.5';
  // Inception defaults to medium reasoning. Bounded extraction/wording should leave
  // time and output tokens for the answer within MORA's shared request deadline.
  if (useJsonMode) {
    settings.providerOptions = {...providerOptions, inception:{reasoningEffort:'low'}};
    settings.instructions = `${instructions}\nReturn exactly one JSON object matching this ${name} JSON schema. Include every required property; do not add properties. Unknown values must be null where allowed.\n${JSON.stringify(z.toJSONSchema(schema))}`;
  }
  const result = await generateText({ ...settings,
    output:useJsonMode ? Output.json({name}) : Output.object({schema, name}) });
  try {
    return { data:schema.parse(result.output), usage:result.usage, metadata:result.finalStep.providerMetadata };
  } catch {
    // Preserve usage for cost accounting, never expose the model text or tool arguments.
    throw Object.assign(new Error('Invalid structured answer'), {type:'invalid_model_output', usage:result.usage});
  }
}
