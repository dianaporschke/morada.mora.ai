import { z } from 'zod';

export const categories = ['water', 'electricity', 'heating', 'access', 'neighbours', 'appliances', 'general'];
export const intents = ['issue', 'documents', 'appointments', 'status', 'contact', 'property', 'walkthrough', 'greeting', 'general'];
const optionalText = z.string().max(2000).nullable();

// The model extracts meaning; the application owns questions, actions and side effects.
export const understandingSchema = z.object({
  intent: z.enum(intents), newIssue: z.boolean(), confidence: z.enum(['clear', 'unclear']),
  category: z.enum(categories).nullable(), subcategory: optionalText, description: optionalText,
  location: optionalText, since: optionalText, extent: optionalText, details: optionalText,
  urgency: z.enum(['normal', 'high', 'emergency']),
  hazard: z.enum(['none', 'water', 'fire', 'gas', 'electric', 'other']),
});

export const attachmentSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/), name: z.string().min(1).max(180),
  type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
});

export const chatInputSchema = z.object({
  message: z.string().trim().min(1).max(2000).optional(), session: z.string().max(180000).optional(),
  actionId: z.string().max(100).optional(), attachments: z.array(attachmentSchema).max(6).optional(),
}).strict().refine(value => value.message || value.actionId || value.attachments, 'Eine Nachricht oder Aktion wird benötigt.');

export const requestInputSchema = z.object({
  session: z.string().min(1).max(180000), idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
}).strict();

export const categoryLabels = {
  water: 'Wasser / Feuchtigkeit', electricity: 'Elektrik / Beleuchtung', heating: 'Heizung',
  access: 'Schlüssel / Zugang', neighbours: 'Nachbarschaft / Lärm', appliances: 'Geräte / Waschküche', general: 'Allgemeines Anliegen',
};
