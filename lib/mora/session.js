import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const localSecret = randomBytes(32).toString('hex');
function secret() {
  const stable = process.env.MORA_SESSION_SECRET || process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY;
  if (stable) return stable;
  if (process.env.VERCEL) throw Object.assign(new Error('Stable session secret required'), { code:'SESSION_CONFIG' });
  return localSecret;
}
const signature = payload => createHmac('sha256', secret()).update(payload).digest('base64url');
export const invalidSession = () => Object.assign(new Error('Invalid session'), { code:'INVALID_SESSION' });

export function sealSession(state) {
  // Store active issue by ID, not twice. Deflate keeps long conversations below the request limit.
  const payloadState = structuredClone(state);
  payloadState.activeIssueId = state.issue?.id || null;
  payloadState.issues ||= state.issue ? [structuredClone(state.issue)] : [];
  delete payloadState.issue;
  payloadState.expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const encode = () => `z:${deflateRawSync(Buffer.from(JSON.stringify(payloadState))).toString('base64url')}`;
  let payload = encode();
  // Preserve current structured fields and every issue. Only bounded audit/history is compacted.
  // The visible browser thread and saved drafts retain their own copies.
  while (payload.length > 170000 || Buffer.byteLength(JSON.stringify(payloadState)) > 500000) {
    if (payloadState.history.length > 2) payloadState.history.shift();
    else {
      const issue = payloadState.issues.find(item => item.answers.length > 1 || item.corrections?.length);
      if (!issue) throw new Error('Conversation is too large');
      if (issue.answers.length > 1) issue.answers.shift(); else issue.corrections.shift();
    }
    payload = encode();
  }
  return `${payload}.${signature(payload)}`;
}

export function readSession(token) {
  const parts = token.split('.');
  if (parts.length !== 2) throw invalidSession();
  const [payload, supplied] = parts;
  const expected = signature(payload);
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw invalidSession();
  try {
    // Legacy uncompressed signed sessions remain valid until their normal expiry.
    const text = payload.startsWith('z:') ? inflateRawSync(Buffer.from(payload.slice(2),'base64url'), { maxOutputLength:512000 }).toString() : Buffer.from(payload,'base64url').toString();
    const state = JSON.parse(text);
    if (state.version !== 2 || state.expiresAt < Date.now() || !Array.isArray(state.history) || !Array.isArray(state.actions)) throw invalidSession();
    if (state.activeIssueId) state.issue = state.issues?.find(issue => issue.id === state.activeIssueId);
    else state.issue ||= null;
    if (state.activeIssueId && !state.issue) throw invalidSession();
    return state;
  } catch { throw invalidSession(); }
}
