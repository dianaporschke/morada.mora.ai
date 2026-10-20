import { z } from 'zod';

export const categories = ['water', 'electricity', 'heating', 'access', 'neighbours', 'appliances', 'general'];
export const equipmentTypes = ['socket', 'light', 'switch', 'power', 'heater', 'key', 'washer', 'dryer', 'dishwasher', 'tap', 'drain', 'pipe', 'leak', 'noise', 'unknown'];
export const intents = ['issue', 'documents', 'appointments', 'status', 'contact', 'property', 'walkthrough', 'greeting', 'knowledge', 'general'];
const optionalText = z.string().max(2000).nullable();
export const issuePatchSchema = z.object({
  category: z.enum(categories).nullable(), subcategory: optionalText, description: optionalText,
  equipment: z.string().trim().min(1).max(80).nullable().describe('Known internal equipment code, or the actual customer-named fixture for other objects. Never infer an unseen component.'), defect: optionalText,
  count: z.number().int().min(1).max(10000).nullable().describe('Only an explicit number/count word given by the customer. Do not infer a count of one merely from singular wording such as my socket or my heating. Otherwise null.'),
  location: optionalText.describe('Room or area supplied by the customer. Preserve a known room when they add a narrower position within it: put that position in details, not in place of the room. An actual room correction replaces location. Without a known room, a supplied area/reference may be location.'),
  since: optionalText.describe('Only an actual time or duration provided by the customer. An explicitly unknown start is not a time: omit since and record the exact customer quote in unknownAnswers with field=since.'),
  extent: optionalText, details: optionalText,
  cause:optionalText.optional().describe('Only a cause explicitly stated by the customer, never your diagnosis. Unknown why/warum is unknownAnswers field=cause, separate from known position/details.'),
  urgency: z.enum(['normal', 'high', 'emergency']), hazard: z.enum(['none', 'water', 'fire', 'gas', 'electric', 'other']),
}).strict();
const additionalIssueSchema=issuePatchSchema.extend({
  targetIssueId:z.string().min(1).max(80).nullish(),
  correction:z.boolean().optional(),
  clearFields:z.array(z.enum(['count','extent','location','since','equipment','defect'])).max(6).optional(),
  uncertainAnswers:z.array(z.object({field:z.enum(['equipment','defect','count','location','since','extent','details','cause']),quote:z.string().min(1).max(300)}).strict()).max(8).optional(),
  unknownFields:z.array(z.enum(['equipment','location','since','extent','details','cause','count','defect'])).max(6).optional(),
});

// The LLM proposes validated data and one clarification, never executable actions.
export const dialogueSchema = z.object({
  reply:z.string().trim().min(1).max(1800),
  stage:z.enum(['clarify','discuss','offer_draft','information']),
  forIssueIndex:z.number().int().min(0).max(3).optional(),
  forIssueId:z.string().min(1).max(80).optional(),
  reconsiderationQuote:z.string().min(1).max(300).optional(),
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
  uncertainAnswers:z.array(z.object({field:z.enum(['equipment','defect','count','location','since','extent','details','cause']),quote:z.string().min(1).max(300)}).strict()).max(8).optional(),
  unknownFields: z.array(z.enum(['equipment', 'location', 'since', 'extent', 'details','cause','count','defect'])).max(6)
    .describe('Only fields the customer explicitly says they cannot or will not answer. Their corresponding scalar values must be null. Not yet mentioned is not unknown. Otherwise an empty array. Existing unknown markers are retained by the application.'),
  additionalIssues: z.array(additionalIssueSchema).max(3),
  question: z.enum(['equipment', 'location', 'since', 'extent', 'details']).nullable().describe('The fact asked for by the reply: equipment is ONLY the unknown device TYPE (not ownership/installation). Use details for own versus fixed light or common area, location for an unknown room, since for an unknown start, extent for scope. Never ask a field with a provided value. A clarification needs question and clarification; otherwise omit/null.'),
  clarification: z.string().max(300).nullable(),
  topic: z.enum(['deposit', 'general']).nullable(), answer: z.string().max(1200).nullable(),
  // Optional only for existing signed sessions, guided mode and legacy adapters.
  dialogue:dialogueSchema.optional(),
}).strict();
const modelRisk=z.enum(['none','flood','fire','gas','electric','other']).describe('Actual acute risk, NOT the issue category. Ordinary dripping/leaks are none; flood means heavy uncontrolled water. A broken heater alone is none.');
const sourceQuote=z.string().min(1).max(2000).nullable().describe('Exact span of the CURRENT customerMessage about THIS issue, excluding other issues. Required for each separate issue in a multi-issue message; otherwise may be null.');
const modelIssueSchema=issuePatchSchema.omit({hazard:true}).partial().extend({risk:modelRisk.nullish(),sourceQuote:sourceQuote.optional(),
  targetIssueId:z.string().min(1).max(20).nullish().describe('For an update to an OTHER EXISTING issue: its availableIssueReferences value. Omit for a genuinely new issue. Never invent an ID.'),
  correction:z.boolean().optional(),
});
const modelButtonSchema=dialogueSchema.shape.buttons.element.extend({
  label:dialogueSchema.shape.buttons.element.shape.label.nullish(),
  field:dialogueSchema.shape.buttons.element.shape.field.nullish(),
  value:dialogueSchema.shape.buttons.element.shape.value.nullish(),
  target:dialogueSchema.shape.buttons.element.shape.target.nullish(),
});
const modelDialogueSchema=z.object({
  reply:dialogueSchema.shape.reply,
  ask:z.object({
    field:understandingSchema.shape.question.unwrap().describe('The fact clarified in reply. equipment=device type, details=other issue details. Known or refused facts need no new question unless reconsiderationQuote identifies a new uncertainty.'),
    text:z.string().trim().min(1).max(300).describe('The next question, also expressed naturally in reply.'),
    issueIndex:z.number().int().min(0).max(3).optional().describe('Which issue this NEXT question concerns: 0=main issue patch, 1=first additionalIssues item, etc. Required if this response captures several issues; otherwise omit or 0.'),
    targetIssueId:z.string().min(1).max(80).optional().describe('An EXISTING short reference from availableIssueReferences (active, other1, etc.) this NEXT question concerns, independently of the issue being updated. Use this when updating one existing issue but asking about another; otherwise use issueIndex for current patches. Never invent an ID.'),
    reconsiderationQuote:z.string().min(1).max(300).optional().describe('Exact span of the CURRENT customer message reopening an ambiguity or contradiction about a previously supplied fact. Only for resolving that new uncertainty, never merely to re-ask a known or refused fact.'),
  }).strict().nullish().describe('Optional metadata for an actual helpful issue question in reply; does not prescribe a dialogue step. General knowledge questions need no ask.'),
  buttons:z.array(modelButtonSchema).max(4).nullish(),
}).strict();
// Sparse updates keep a normal greeting from generating an unrelated form of
// null values. The canonical application schema below remains fully validated.
const conversationFactsSchema=understandingSchema.omit({unknownFields:true,topic:true,answer:true,confidence:true,hazard:true,additionalIssues:true,dialogue:true,question:true,clarification:true}).partial().required({intent:true});
// Present the customer reply before its invisible notes, without imposing any
// wording, question sequence or mandatory action on that reply.
export const conversationSchema = z.object({
  dialogue:modelDialogueSchema,...conversationFactsSchema.shape,
  targetIssueId:z.string().min(1).max(20).nullish().describe('Existing short reference from availableIssueReferences: active or other1, other2, etc. This selects the facts update, independently of dialogue.ask.targetIssueId. Never copy or invent a UUID.'),
  risk:modelRisk.nullish(),sourceQuote:sourceQuote.optional(),
  additionalIssues:z.array(modelIssueSchema).max(3).nullish(),
  unknownAnswers:z.array(z.object({
    field:z.enum(['equipment','location','since','extent','details','cause','count','defect']),
    quote:z.string().min(1).max(300),
  }).strict()).max(8).nullish().describe('Only explicit inability/refusal to give a fact. quote is an exact verbatim span from the current customerMessage expressing that inability. Unknown why/warum is cause, never overwrite known physical details. Omit this array for merely absent facts.'),
}).strict();

export function emptyUnderstanding(overrides = {}) {
  return { intent:'general', newIssue:false, confidence:'unclear', category:null, subcategory:null,
    description:null, equipment:null, defect:null, count:null, location:null, since:null, extent:null, details:null,cause:null,
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
  draftReceipt:z.object({issueId:z.string().uuid(),revision:z.number().int().min(1),status:z.enum(['portal_received','error'])}).strict().optional(),
  actionId: z.string().max(100).optional(), attachments: z.array(attachmentSchema).max(6).optional(),
}).strict().refine(value => value.message || value.actionId || value.attachments || value.draftReceipt, 'Eine Nachricht oder Aktion wird benötigt.')
  .refine(value=>!value.draftReceipt || (!value.message && !value.actionId && !value.attachments && Boolean(value.session)), 'Entwurfsbestätigungen benötigen die aktuelle Unterhaltung.')
  .refine(value => !(value.message && value.actionId), 'Nachricht und Auswahl dürfen nicht kombiniert werden.')
  .refine(value => !value.attachments || new Set(value.attachments.map(file => file.id)).size === value.attachments.length, 'Doppelte Fotos sind nicht erlaubt.');

export const requestInputSchema = z.object({
  session: z.string().min(1).max(180000), idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
}).strict();

export { categoryLabels } from '../../assets/mora-data.js';
