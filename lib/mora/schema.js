import { z } from 'zod';

export const categories = ['water', 'electricity', 'heating', 'access', 'neighbours', 'appliances', 'general'];
export const equipmentTypes = ['socket', 'light', 'switch', 'power', 'heater', 'key', 'washer', 'dryer', 'dishwasher', 'tap', 'drain', 'pipe', 'leak', 'noise', 'unknown'];
export const intents = ['issue', 'documents', 'appointments', 'status', 'contact', 'property', 'walkthrough', 'greeting', 'knowledge', 'general'];
const optionalText = z.string().max(2000).nullable();
export const issuePatchSchema = z.object({
  category: z.enum(categories).nullable(), subcategory: optionalText, description: optionalText,
  equipment: z.enum(equipmentTypes).nullable(), defect: optionalText,
  count: z.number().int().min(1).max(10000).nullable(),
  location: optionalText, since: optionalText, extent: optionalText, details: optionalText,
  urgency: z.enum(['normal', 'high', 'emergency']), hazard: z.enum(['none', 'water', 'fire', 'gas', 'electric', 'other']),
}).strict();

// The LLM proposes validated data and one clarification, never executable actions.
export const understandingSchema = issuePatchSchema.extend({
  intent: z.enum(intents), newIssue: z.boolean(), confidence: z.enum(['clear', 'unclear']),
  targetIssueId: z.string().max(80).nullable(), correction: z.boolean(),
  clearFields: z.array(z.enum(['count', 'extent', 'location', 'since', 'equipment', 'defect'])).max(6),
  additionalIssues: z.array(issuePatchSchema).max(3),
  question: z.enum(['equipment', 'location', 'since', 'extent', 'details']).nullable(),
  clarification: z.string().max(300).nullable(),
  topic: z.enum(['deposit', 'general']).nullable(), answer: z.string().max(1200).nullable(),
}).strict();

export function emptyUnderstanding(overrides = {}) {
  return { intent:'general', newIssue:false, confidence:'unclear', category:null, subcategory:null,
    description:null, equipment:null, defect:null, count:null, location:null, since:null, extent:null, details:null,
    urgency:'normal', hazard:'none', targetIssueId:null, correction:false, clearFields:[], additionalIssues:[],
    question:null, clarification:null, topic:null, answer:null, ...overrides };
}

export const attachmentSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/), name: z.string().min(1).max(180),
  type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
}).strict();

export const chatInputSchema = z.object({
  message: z.string().trim().min(1).max(2000).optional(), session: z.string().max(180000).optional(),
  actionId: z.string().max(100).optional(), attachments: z.array(attachmentSchema).max(6).optional(),
}).strict().refine(value => value.message || value.actionId || value.attachments, 'Eine Nachricht oder Aktion wird benötigt.')
  .refine(value => !(value.message && value.actionId), 'Nachricht und Auswahl dürfen nicht kombiniert werden.')
  .refine(value => !value.attachments || new Set(value.attachments.map(file => file.id)).size === value.attachments.length, 'Doppelte Fotos sind nicht erlaubt.');

export const requestInputSchema = z.object({
  session: z.string().min(1).max(180000), idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
}).strict();

export const categoryLabels = {
  water: 'Wasser / Feuchtigkeit', electricity: 'Elektrik', heating: 'Heizung',
  access: 'Schlüssel / Zugang', neighbours: 'Nachbarschaft / Lärm', appliances: 'Geräte / Waschküche', general: 'Allgemeines Anliegen',
};
