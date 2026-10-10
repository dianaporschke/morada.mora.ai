import { conversationProfiles, estimateTokenCost } from '../lib/mora/costs.js';

const models = ['openai/gpt-6-luna','openai/gpt-6.1-sol'];
console.log('Planning estimates, USD, standard uncached tokens; not measured conversations or invoice.');
for (const [profile, usage] of Object.entries(conversationProfiles)) {
  for (const model of models) {
    const perConversation = estimateTokenCost(model,usage);
    console.log(JSON.stringify({profile,model,...usage,perConversation,
      monthly:Object.fromEntries([100,500,1000,5000,10000].map(count => [count,Number((count*perConversation).toFixed(4))]))}));
  }
}
