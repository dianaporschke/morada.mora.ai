import { requestInputSchema } from '../lib/mora/schema.js';
import { readSession } from '../lib/mora/session.js';
import { submitRequest, portalCapabilities } from '../lib/portal/adapter.js';

/** Phase 2 boundary. The production adapter is disconnected; tests inject a simulated authorised backend. */
export function createRequestsHandler({ connected = portalCapabilities.submitRequest, authorize = async (_req, _draft) => null, submit = submitRequest } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error:'Nur POST-Anfragen sind erlaubt.' });
    }
    const input = requestInputSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error:'Ungültiger Anliegenentwurf.' });
    try {
      const state = readSession(input.data.session);
      if (!state.issue?.description) return res.status(400).json({ error:'Bitte beschreiben Sie zuerst Ihr Anliegen.' });
      if (!connected) return res.status(503).json({ accepted:false, status:'integration_required', draftId:state.issue.id,
        message:'Ihr Anliegen ist vorbereitet. Die direkte Übermittlung an MORADA ist noch nicht angeschlossen; es wurde nichts versendet.' });
      // Trust only server-derived identity and permission, never client account IDs or capabilities.
      const context = await authorize(req, state.issue);
      if (!context?.customerId || context.canSubmit !== true) return res.status(403).json({ accepted:false, error:'Für diese Übermittlung fehlt die bestätigte Berechtigung. Ihr Entwurf bleibt erhalten.' });
      if (input.data.idempotencyKey !== state.issue.id) return res.status(409).json({ accepted:false, error:'Der Übermittlungsschlüssel gehört nicht zu diesem Anliegen.' });
      const receipt = await submit({ draft:state.issue, idempotencyKey:state.issue.id, customerContext:context });
      if (receipt?.accepted !== true || typeof receipt.requestId !== 'string' || !receipt.requestId) {
        return res.status(502).json({ accepted:false, error:'Die Speicherung wurde nicht bestätigt. Ihr Anliegen bleibt als Entwurf erhalten.' });
      }
      return res.status(201).json({ accepted:true, requestId:receipt.requestId });
    } catch (error) {
      return res.status(error.code === 'INVALID_SESSION' ? 409 : 500).json({ accepted:false, error:'Die Übermittlung konnte nicht bestätigt werden. Ihr Anliegen bleibt als Entwurf erhalten.' });
    }
  };
}
export default createRequestsHandler();
