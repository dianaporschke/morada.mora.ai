import { z } from 'zod';
import { conversationSchema, issuePatchSchema } from './schema.js';

// The model writes a response and, only where useful, small issue updates.
// Storage defaults, stages, UUIDs and executable actions remain application concerns.
const unknownAnswers=conversationSchema.shape.unknownAnswers;
const patch=issuePatchSchema.omit({hazard:true}).partial().extend({
  ref:z.string().min(1).max(20).optional(),
  sourceQuote:z.string().min(1).max(2000).optional(),
  correction:z.boolean().optional(),
  clearFields:conversationSchema.shape.clearFields,
  unknownAnswers,
  risk:conversationSchema.shape.risk,
}).strict();
export const responseContract=z.object({
  reply:conversationSchema.shape.dialogue.shape.reply,
  intent:conversationSchema.shape.intent,
  updates:z.array(patch).max(4).optional(),
  ask:conversationSchema.shape.dialogue.shape.ask,
  actions:conversationSchema.shape.dialogue.shape.buttons,
}).strict();

export function expandConversation(raw) {
  const {updates=[],reply,intent,ask,actions}=raw;
  const expand=({ref,...update})=>({...update,
    ...(ref && ref!=='new' ? {targetIssueId:ref} : {}),
    ...(ref==='new' ? {newIssue:true} : {})});
  const [first={},...rest]=updates.map(expand);
  return {...first,intent,additionalIssues:rest,dialogue:{reply,...(ask ? {ask} : {}),...(actions ? {buttons:actions} : {})}};
}

// Accept the earlier internal contract during the transition; it is never
// advertised in the prompt, exposed as an endpoint or trusted as authorization.
export const acceptedConversation=z.union([
  responseContract.transform(expandConversation),conversationSchema,
]);
