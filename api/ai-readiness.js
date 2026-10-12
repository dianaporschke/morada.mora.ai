import { createGateway } from 'ai';
import { classifyModelError, resolveProvider } from '../lib/mora/provider.js';

/** Preview diagnostic only. Credit amounts stay in private runtime logs, never HTTP. */
export function createReadinessHandler({env=process.env, readCredits=async () => createGateway({
  apiKey:env.AI_GATEWAY_API_KEY || undefined,
  fetch:(url, options) => fetch(url, {...options,signal:AbortSignal.timeout(8000)}),
}).getCredits(), readModels=async () => createGateway({
  apiKey:env.AI_GATEWAY_API_KEY || undefined,
  fetch:(url, options) => fetch(url, {...options,signal:AbortSignal.timeout(8000)}),
}).getAvailableModels(), readGeneration=async id=>createGateway({
  apiKey:env.AI_GATEWAY_API_KEY || undefined,
  fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(8000)}),
}).getGenerationInfo({id}), log=console.info, now=Date.now} = {}) {
  let last = null;
  let pending = null;
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== 'codex/mora-ai-2.0' || env.MORA_AI_CREDIT_CHECK !== 'true') {
      return res.status(404).json({code:'NOT_FOUND'});
    }
    if (req.method !== 'GET') {res.setHeader('Allow','GET'); return res.status(405).json({code:'METHOD_NOT_ALLOWED'});}
    const selection = await resolveProvider(env);
    const generationId=req.query?.generation;
    if (generationId!==undefined) {
      if (typeof generationId!=='string' || !/^gen_[a-zA-Z0-9_-]{1,100}$/.test(generationId)) return res.status(400).json({code:'INVALID_GENERATION_ID'});
      try {
        const generation=await readGeneration(generationId);
        if (generation.id!==generationId || !Number.isFinite(generation.totalCost) || generation.totalCost<0) throw {type:'invalid_generation_response'};
        // Actual billing/timing only, never prompt content, credentials or raw provider bodies.
        log('MORA Gateway generation audit',{generationId,totalCostUsd:generation.totalCost,
          latencyMs:generation.latency,generationTimeMs:generation.generationTime,
          inputTokens:generation.promptTokens,outputTokens:generation.completionTokens,
          reasoningTokens:generation.reasoningTokens,cachedTokens:generation.cachedTokens,
          model:generation.model,provider:generation.providerName,streamed:generation.streamed});
        return res.status(200).json({generationAudited:true,financialDetails:'private_runtime_logs',inferenceStarted:false});
      } catch (error) {
        return res.status(503).json({generationAudited:false,reason:classifyModelError(error,selection).reason,inferenceStarted:false});
      }
    }
    if (!last || now() - last.checkedAt >= 60000) {
      pending ||= (async () => {
        const checkedAt = now();
        try {
          const credits = await readCredits();
          const amount = value => typeof value === 'string' && /^\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : null;
          const balanceUsd = amount(credits.balance), totalUsedUsd = amount(credits.totalUsed);
          if (balanceUsd === null || totalUsedUsd === null) throw {type:'invalid_credit_response'};
          // No prompt, key, OIDC token, provider body or customer data is logged.
          log('MORA Gateway credit audit', {balanceUsd,totalUsedUsd,checkedAt:new Date(checkedAt).toISOString(),
            creditOrigin:'unknown',autoTopUp:'unknown',inferenceStarted:false});
          let modelCatalog;
          try {
            const catalog = await readModels();
            modelCatalog = {readable:true,modelListed:catalog.models.some(model => model.id === selection.model),reason:null};
          } catch (error) {
            modelCatalog = {readable:false,modelListed:null,reason:classifyModelError(error,{provider:'gateway',model:selection.model}).reason};
          }
          return {checkedAt,readable:true,reason:null,modelCatalog};
        } catch (error) {
          const diagnostic = classifyModelError(error,{provider:'gateway',model:null});
          log('MORA Gateway credit audit unavailable', diagnostic);
          return {checkedAt,readable:false,reason:diagnostic.reason,modelCatalog:{readable:false,modelListed:null,reason:'not_checked'}};
        }
      })();
      try {last = await pending;} finally {pending = null;}
    }
    return res.status(last.readable ? 200 : 503).json({creditsReadable:last.readable,reason:last.reason,
      freeUseVerified:false,autoTopUpVerified:false,inferenceEnabled:env.MORA_AI_ENABLED !== 'false',
      inferenceStarted:false,financialDetails:'private_runtime_logs',
      configuration:{provider:selection.provider,model:selection.model,ready:selection.ready,
        gatewayCredential:env.AI_GATEWAY_API_KEY ? 'api_key' : 'oidc',
        reason:selection.availability?.reason || null,requiredMode:env.MORA_AI_REQUIRED === 'true',naturalReplies:env.MORA_AI_NATURAL_REPLIES === 'true'},
      modelCatalog:last.modelCatalog,modelInferenceAccessVerified:false});
  };
}

export default createReadinessHandler();
