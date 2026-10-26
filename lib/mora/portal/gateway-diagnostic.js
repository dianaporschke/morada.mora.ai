// Account/routing refusals only. Never log request bodies, prompts, headers,
// model output, arbitrary exception messages, or return this detail to clients.
export function gatewayRefusalDiagnostic(error, availability) {
  if (availability?.status !== 403 || availability?.reason !== 'no_providers_available') return null;
  for (let cause = error, depth = 0; cause && depth < 4; cause = cause.cause, depth++) {
    let body = cause.data;
    if (!body && typeof cause.responseBody === 'string' && cause.responseBody.length < 16000) {
      try { body = JSON.parse(cause.responseBody); } catch { /* Not a Gateway JSON refusal. */ }
    }
    const refusal = body?.error;
    if ((refusal?.code || refusal?.type) !== 'no_providers_available' || typeof refusal.message !== 'string') continue;
    const message = refusal.message
      .replace(/https?:\/\/\S+/gi, '[url removed]')
      .replace(/\bBearer\s+\S+/gi, '[credential removed]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
      .replace(/[A-Za-z0-9_+\/.=-]{24,}/g, '[identifier removed]')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .slice(0, 600);
    return {status:403,reason:'no_providers_available',message};
  }
  return {status:403,reason:'no_providers_available',message:null};
}
