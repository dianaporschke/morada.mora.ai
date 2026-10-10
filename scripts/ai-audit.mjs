import { createGateway } from 'ai';
import { classifyModelError } from '../lib/mora/provider.js';

const args = process.argv.slice(2);
const generationId = args[0] === '--generation' && args.length === 2 ? args[1] : null;
if (args.length && (!generationId || !/^gen_[a-zA-Z0-9_-]{1,100}$/.test(generationId))) {
  console.error('Usage: npm run ai:audit -- [--generation gen_ID]'); process.exit(2);
}
const gateway = createGateway({fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(8000)})});
try {
  if (generationId) {
    const info = await gateway.getGenerationInfo({id:generationId});
    console.log(JSON.stringify({check:'generation_cost',id:info.id,model:info.model,provider:info.providerName,
      actualGatewayCostUsd:info.totalCost,upstreamInferenceCostUsd:info.upstreamInferenceCost,isByok:info.isByok,
      inputTokens:info.promptTokens,outputTokens:info.completionTokens,reasoningTokens:info.reasoningTokens,
      inferenceStarted:false}));
  } else {
    const info = await gateway.getCredits();
    console.log(JSON.stringify({check:'read_only_credits',balanceUsd:info.balance,totalUsedUsd:info.totalUsed,
      creditOrigin:'unknown',autoTopUp:'unknown',freeUseVerified:false,inferenceStarted:false}));
  }
} catch (error) {
  console.error(JSON.stringify({check:'read_only_audit',diagnostic:classifyModelError(error,{provider:'gateway',model:null}),inferenceStarted:false}));
  process.exitCode=1;
}
