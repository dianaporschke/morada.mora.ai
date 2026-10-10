import { createGateway } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getVercelOidcToken } from '@vercel/oidc';
import { estimateTokenCost } from './costs.js';

// Defaults intentionally retain the existing choice. A change requires owner approval.
export async function resolveProvider(env = process.env, readOidc = getVercelOidcToken) {
  const requested = env.MORA_AI_PROVIDER || 'auto';
  if (!['auto', 'gateway', 'openai'].includes(requested)) return unavailable(null, null, 'invalid_provider_configuration');
  let gatewayToken = env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN;
  if (requested !== 'openai' && !gatewayToken) {
    try { gatewayToken = await readOidc(); } catch { /* No request-scoped token outside Vercel. */ }
  }
  const provider = requested === 'auto' ? (gatewayToken ? 'gateway' : 'openai') : requested;
  const model = provider === 'gateway' ? (env.AI_GATEWAY_MODEL || 'openai/gpt-6-luna') : (env.OPENAI_MODEL || 'gpt-5.4-mini');
  if (!/^[a-zA-Z0-9_.:/-]{1,120}$/.test(model) || (provider === 'gateway' && !model.includes('/'))) {
    return unavailable(provider, null, 'invalid_model_configuration');
  }
  // Independent of credentials: a disabled preview must never spend on inference.
  if (env.MORA_AI_ENABLED === 'false') return unavailable(provider, model, 'inference_disabled');
  const credential = provider === 'gateway' ? gatewayToken : env.OPENAI_API_KEY;
  if (!credential) return unavailable(provider, model, 'missing_credentials');
  return { provider, model, ready:true, availability:null,
    // Do not retain or return the credential as diagnostic data.
    createModel:() => provider === 'gateway'
      // OIDC must use the SDK's OIDC path and auth-method header, not an API-key header.
      ? createGateway({ apiKey:env.AI_GATEWAY_API_KEY || undefined })(model)
      : createOpenAI({ apiKey:credential }).responses(model) };
}

function unavailable(provider, model, reason) {
  return { provider, model, ready:false, availability:{provider, model, status:null, reason}, createModel:null };
}

export function modelUnavailable(availability) {
  return Object.assign(new Error('Model unavailable'), { code:'MODEL_UNAVAILABLE', availability });
}

/** Public diagnostics contain machine codes only, never messages or provider bodies. */
export function classifyModelError(error, selection) {
  // Gateway can wrap a local AbortSignal timeout as a generic 500 response_error.
  // Keep the actual cause distinct from an upstream server refusal.
  let cause = error;
  for (let depth = 0; cause && depth < 4; depth++, cause = cause.cause) {
    if (['TimeoutError','AbortError'].includes(cause.name)) {
      return {provider:selection.provider,model:selection.model,status:null,reason:'model_timeout'};
    }
  }
  let payload = error?.data || error?.cause?.data;
  if (!payload) {
    try { payload = JSON.parse(error?.responseBody || error?.cause?.responseBody || '{}'); } catch { /* Invalid error body. */ }
  }
  const candidate = payload?.error?.code || payload?.error?.type || error?.type;
  let reason = typeof candidate === 'string' && /^[a-z][a-z0-9_]{1,64}$/.test(candidate) ? candidate : null;
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : Number.isInteger(error?.cause?.statusCode) ? error.cause.statusCode : null;
  // Specific provider codes take precedence over a generic message heuristic.
  if (!reason) {
    const message = `${error?.message || ''} ${error?.cause?.message || ''}`;
    if (/customer.verification|payment method/i.test(message)) reason = 'customer_verification_required';
    else if (/oidc|issuer|audience/i.test(message)) reason = 'oidc_access_denied';
    else if (['TimeoutError', 'AbortError'].includes(error?.name)) reason = 'model_timeout';
    else if (/NoObjectGenerated|TypeValidation|JSONParse|ZodError/.test(error?.name || '')) reason = 'invalid_model_output';
    else reason = ({401:'authentication_failed',402:'payment_required',403:'access_denied',404:'model_not_found',429:'rate_limit_or_quota',500:'provider_unavailable',502:'provider_unavailable',503:'provider_unavailable'})[status] || 'unavailable';
  }
  return { provider:selection.provider, model:selection.model, status, reason };
}

export function safeUsage(usage) {
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  return { inputTokens:count(usage?.inputTokens), outputTokens:count(usage?.outputTokens),
    reasoningTokens:count(usage?.outputTokenDetails?.reasoningTokens), cachedInputTokens:count(usage?.inputTokenDetails?.cacheReadTokens) };
}

export function safeGenerationId(metadata) {
  const id = metadata?.gateway?.generationId;
  return typeof id === 'string' && /^gen_[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : null;
}

export function logModelUsage(operation, selection, usage, durationMs, metadata) {
  console.info('MORA model usage', { operation, provider:selection.provider, model:selection.model,
    ...safeUsage(usage), durationMs, generationId:safeGenerationId(metadata),
    estimatedTokenCostUsd:estimateTokenCost(selection.model, usage),
    costBasis:'2026-10-10 standard uncached tokens; estimate, not invoice' });
}
