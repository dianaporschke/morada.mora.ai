import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const localSecret = randomBytes(32).toString('hex');
const secret = () => process.env.MORA_SESSION_SECRET || process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY || localSecret;
const signature = payload => createHmac('sha256', secret()).update(payload).digest('base64url');
export const invalidSession = () => Object.assign(new Error('Invalid session'), { code: 'INVALID_SESSION' });

export function sealSession(state) {
  const payload = Buffer.from(JSON.stringify({ ...state, expiresAt: Date.now() + 12 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function readSession(token) {
  const parts = token.split('.');
  if (parts.length !== 2) throw invalidSession();
  const [payload, supplied] = parts;
  const expected = signature(payload);
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw invalidSession();
  try {
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (state.version !== 2 || state.expiresAt < Date.now() || !Array.isArray(state.history) || !Array.isArray(state.actions)) throw invalidSession();
    return state;
  } catch { throw invalidSession(); }
}
