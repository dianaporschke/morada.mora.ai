import { requestInputSchema } from '../lib/mora/schema.js';
import { readSession } from '../lib/mora/session.js';
import { submitRequest } from '../lib/portal/adapter.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Nur POST-Anfragen sind erlaubt.' });
  }
  const input = requestInputSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: 'Ungültiger Anliegenentwurf.' });
  try {
    const state = readSession(input.data.session);
    if (!state.issue?.description) return res.status(400).json({ error: 'Bitte beschreiben Sie zuerst Ihr Anliegen.' });
    const receipt = await submitRequest({ draft: state.issue, idempotencyKey: input.data.idempotencyKey, customerContext: null });
    if (!receipt.accepted) return res.status(503).json({ ...receipt,
      message: 'Ihr Anliegen ist vorbereitet. Die direkte Übermittlung an MORADA ist noch nicht angeschlossen; es wurde nichts versendet.' });
    return res.status(201).json(receipt);
  } catch (error) {
    return res.status(error.code === 'INVALID_SESSION' ? 409 : 500).json({ error: 'Die Übermittlung konnte nicht bestätigt werden. Ihr Anliegen bleibt als Entwurf erhalten.' });
  }
}
