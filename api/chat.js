import { chatInputSchema } from '../lib/mora/schema.js';
import { readSession, sealSession } from '../lib/mora/session.js';
import { processTurn } from '../lib/mora/engine.js';
import { extractUnderstanding } from '../lib/mora/understanding.js';
import { portalCapabilities } from '../lib/portal/adapter.js';

export function createChatHandler(understand = extractUnderstanding) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Nur POST-Anfragen sind erlaubt.' });
    }
    const parsed = chatInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Bitte geben Sie eine kurze Nachricht oder eine gültige Aktion ein.' });
    try {
      const previous = parsed.data.session ? readSession(parsed.data.session) : null;
      const result = await processTurn(parsed.data, previous, understand);
      return res.status(200).json({ version: 2, reply: result.reply, actions: result.state.actions,
        issue: result.state.issue, issues: result.state.issues, session: sealSession(result.state), capabilities: portalCapabilities,
        understanding: result.understanding, modelAvailability:result.availability });
    } catch (error) {
      if (error.code === 'ISSUE_LIMIT') return res.status(409).json({ error:'In dieser Unterhaltung sind bereits acht Anliegen aufgenommen. Öffnen Sie die vorhandenen Entwürfe und starten Sie für weitere Probleme einen neuen Chat.', code:'ISSUE_LIMIT' });
      if (error.code === 'INVALID_SESSION' || error.code === 'INVALID_ACTION') {
        return res.status(409).json({ error: 'Diese Unterhaltung oder Aktion ist nicht mehr aktuell. Ihre Angaben bleiben im Chat erhalten. Bitte starten Sie eine neue Unterhaltung.', code: error.code });
      }
      // Never log messages, signed sessions or provider errors containing request bodies.
      console.error('MORA request failed', { code: 'TURN_FAILED' });
      return res.status(500).json({ error: 'MORA ist gerade nicht erreichbar. Ihre bisherigen Angaben bleiben erhalten. Bitte versuchen Sie es erneut.' });
    }
  };
}
export default createChatHandler();
