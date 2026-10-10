// Verified public Gateway catalog, 2026-10-10. Standard short-context USD rates.
// Planning only: no regional, service-tier, cache-write, search or hosting surcharges.
export const tokenPrices = Object.freeze({
  'openai/gpt-6-luna':Object.freeze({input:0.10,output:0.50}),
  'openai/gpt-6.1-sol':Object.freeze({input:2,output:10}),
  'openai/gpt-5.4-mini':Object.freeze({input:0.75,output:4.50}),
  'anthropic/claude-sonnet-5.5':Object.freeze({input:2,output:10}),
});

export function estimateTokenCost(model, usage) {
  const id = model.includes('/') ? model : `openai/${model}`;
  const price = tokenPrices[id];
  if (!price || ![usage?.inputTokens,usage?.outputTokens].every(value => Number.isSafeInteger(value) && value >= 0)) return null;
  // Reasoning tokens are part of outputTokens; do not bill them a second time.
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}

export const conversationProfiles = Object.freeze({
  simple:Object.freeze({customerTurns:3,inputTokens:12000,outputTokens:1500}),
  average:Object.freeze({customerTurns:8,inputTokens:64000,outputTokens:8000}),
  complex:Object.freeze({customerTurns:15,inputTokens:150000,outputTokens:18000}),
});
