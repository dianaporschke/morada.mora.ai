import { z } from 'zod';

export const categories = ['water', 'electricity', 'heating', 'access', 'neighbours', 'appliances', 'general'];
export const equipmentTypes = ['socket', 'light', 'switch', 'power', 'heater', 'key', 'washer', 'dryer', 'dishwasher', 'tap', 'drain', 'pipe', 'leak', 'noise', 'unknown'];
export const intents = ['issue', 'documents', 'appointments', 'status', 'contact', 'property', 'walkthrough', 'greeting', 'knowledge', 'general'];
const optionalText = z.string().max(2000).nullable();
export const issuePatchSchema = z.object({
  category: z.enum(categories).nullable(), subcategory: optionalText, description: optionalText,
  equipment: z.enum(equipmentTypes).nullable().describe('The actual physical part named by the customer, not the defect. Rohr/Leitung = pipe, Wasserhahn = tap, Abfluss = drain, Steckdose = socket, Lampe/Leuchte = light. Use generic leak/power only while no specific part is known. Later explicit component information refines the same issue.'), defect: optionalText,
  count: z.number().int().min(1).max(10000).nullable().describe('Only an explicit number/count word given by the customer. Do not infer a count of one merely from singular wording such as my socket or my heating. Otherwise null.'),
  location: optionalText.describe('Room or area supplied by the customer. Preserve a known room when they add a narrower position within it: put that position in details, not in place of the room. An actual room correction replaces location. Without a known room, a supplied area/reference may be location.'),
  since: optionalText.describe('Only an actual time or duration provided by the customer. A statement that they do not know or remember the start is not a time: return null here and include since in unknownFields.'),
  extent: optionalText, details: optionalText,
  urgency: z.enum(['normal', 'high', 'emergency']), hazard: z.enum(['none', 'water', 'fire', 'gas', 'electric', 'other']),
}).strict();

// The LLM proposes validated data and one clarification, never executable actions.
export const dialogueSchema = z.object({
  reply:z.string().trim().min(1).max(1800),
  stage:z.enum(['clarify','discuss','offer_draft','information']),
  forIssueIndex:z.number().int().min(0).max(3).optional(),
  forIssueId:z.string().min(1).max(80).optional(),
  buttons:z.array(z.object({
    kind:z.enum(['select','prepare_draft','attachment','add_details','navigate','continue']),
    label:z.string().trim().min(1).max(90),
    field:z.enum(['equipment','location','since','extent','details']).nullable(),
    value:z.string().trim().min(1).max(300).nullable(),
    target:z.enum(['docs','service','profile','portfolio']).nullable(),
  }).strict()).max(4),
}).strict();

export const understandingSchema = issuePatchSchema.extend({
  intent: z.enum(intents), newIssue: z.boolean(), confidence: z.enum(['clear', 'unclear']),
  targetIssueId: z.string().max(80).nullable(), correction: z.boolean(),
  clearFields: z.array(z.enum(['count', 'extent', 'location', 'since', 'equipment', 'defect'])).max(6)
    .describe('Only fields explicitly withdrawn by the customer in this message. Otherwise an empty array.'),
  unknownFields: z.array(z.enum(['equipment', 'location', 'since', 'extent', 'details'])).max(5)
    .describe('Only fields the customer explicitly says they cannot or will not answer. Their corresponding scalar values must be null. Not yet mentioned is not unknown. Otherwise an empty array. Existing unknown markers are retained by the application.'),
  additionalIssues: z.array(issuePatchSchema).max(3),
  question: z.enum(['equipment', 'location', 'since', 'extent', 'details']).nullable().describe('The fact asked for by the reply: equipment is ONLY the unknown device TYPE (not ownership/installation). Use details for own versus fixed light or common area, location for an unknown room, since for an unknown start, extent for scope. Never ask a field with a provided value. A clarification needs question and clarification; otherwise omit/null.'),
  clarification: z.string().max(300).nullable(),
  topic: z.enum(['deposit', 'general']).nullable(), answer: z.string().max(1200).nullable(),
  // Optional only for existing signed sessions, guided mode and legacy adapters.
  dialogue:dialogueSchema.optional(),
}).strict();
const modelRisk=z.enum(['none','flood','fire','gas','electric','other']).describe('Actual acute risk, NOT the issue category. Ordinary dripping/leaks are none; flood means heavy uncontrolled water. A broken heater alone is none.');
const sourceQuote=z.string().min(1).max(2000).nullable().describe('Exact span of the CURRENT customerMessage about THIS issue, excluding other issues. Required for each separate issue in a multi-issue message; otherwise may be null.');
const modelIssueSchema=issuePatchSchema.omit({hazard:true}).partial().extend({risk:modelRisk.nullish(),sourceQuote:sourceQuote.optional()});
const modelButtonSchema=dialogueSchema.shape.buttons.element.extend({
  label:dialogueSchema.shape.buttons.element.shape.label.nullish(),
  field:dialogueSchema.shape.buttons.element.shape.field.nullish(),
  value:dialogueSchema.shape.buttons.element.shape.value.nullish(),
  target:dialogueSchema.shape.buttons.element.shape.target.nullish(),
});
const modelDialogueSchema=z.object({
  reply:dialogueSchema.shape.reply,
  ask:z.object({
    field:understandingSchema.shape.question.unwrap().describe('The NEXT missing fact asked for in reply, not a fact just answered. equipment means unknown device type; details means ownership/installation. Known room/time and explicit unknowns must not be asked again.'),
    text:z.string().trim().min(1).max(300).describe('The next question, also expressed naturally in reply.'),
    issueIndex:z.number().int().min(0).max(3).optional().describe('Which issue this NEXT question concerns: 0=main issue patch, 1=first additionalIssues item, etc. Required if this response captures several issues; otherwise omit or 0.'),
    targetIssueId:z.string().min(1).max(80).optional().describe('An EXISTING context issue ID this NEXT question concerns, independently of the issue being updated. Use this when updating one existing issue but asking about another; otherwise use issueIndex for current patches. Never invent an ID.'),
  }).strict().nullish().describe('Only the NEXT helpful damage clarification. Omit for acknowledgement, corrections, knowledge questions, or direct reporting. Never describe the field the customer just answered.'),
  buttons:z.array(modelButtonSchema).max(4).nullish(),
}).strict();
// Sparse updates keep a normal greeting from generating an unrelated form of
// null values. The canonical application schema below remains fully validated.
export const conversationSchema = understandingSchema.omit({unknownFields:true,topic:true,answer:true,confidence:true,hazard:true,additionalIssues:true,dialogue:true,question:true,clarification:true}).partial().required({intent:true}).extend({
  dialogue:modelDialogueSchema,risk:modelRisk.nullish(),sourceQuote:sourceQuote.optional(),
  additionalIssues:z.array(modelIssueSchema).max(3).nullish(),
  unknownAnswers:z.array(z.object({
    field:z.enum(['equipment','location','since','extent','details']),
    quote:z.string().min(1).max(300),
  }).strict()).max(5).nullish().describe('Only explicit inability/refusal to give a fact. quote is an exact verbatim span from the current customerMessage expressing that inability. Omit this array for merely absent facts.'),
});

export function emptyUnderstanding(overrides = {}) {
  return { intent:'general', newIssue:false, confidence:'unclear', category:null, subcategory:null,
    description:null, equipment:null, defect:null, count:null, location:null, since:null, extent:null, details:null,
    urgency:'normal', hazard:'none', targetIssueId:null, correction:false, clearFields:[], unknownFields:[], additionalIssues:[],
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
