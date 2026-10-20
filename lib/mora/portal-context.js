import { z } from 'zod';

/** MORA-side contract only. Authentication, memberships and data APIs belong to
 * the portal. This module cannot authenticate a user or grant a permission. */
export const portalContextContract=z.object({
  version:z.literal(1),
  status:z.literal('verified'),
  properties:z.array(z.object({
    id:z.string().min(1).max(100),
    label:z.string().min(1).max(180),
    unitId:z.string().min(1).max(100).nullable(),
    roles:z.array(z.enum(['tenant','owner'])).min(1).max(2),
  }).strict()).max(40),
  selectedPropertyId:z.string().min(1).max(100).nullable(),
}).strict().superRefine((context,ctx)=>{
  if (new Set(context.properties.map(property=>property.id)).size!==context.properties.length)
    ctx.addIssue({code:'custom',message:'Duplicate property scope'});
  if (context.selectedPropertyId && !context.properties.some(property=>property.id===context.selectedPropertyId))
    ctx.addIssue({code:'custom',message:'Selected property outside verified memberships'});
});

const unavailable=()=>({version:1,status:'unavailable',properties:[],selectedPropertyId:null});

// Alexander supplies a server-only loader after authenticating the request and
// enforcing property/unit access. Never use request.body, chat claims or a signed
// conversation's model notes as an identity or permission source.
export async function readPortalContext(request,loader=undefined) {
  if (!loader) return unavailable();
  try {
    const result=portalContextContract.safeParse(await loader(request));
    if (result.success) return result.data;
  } catch { /* Fail closed for portal outages without losing the conversation. */ }
  console.warn('MORA portal context unavailable',{code:'PORTAL_CONTEXT_UNAVAILABLE'});
  return unavailable();
}

export function conversationPortalContext(context) {
  if (context?.status!=='verified') return unavailable();
  const parsed=portalContextContract.safeParse(context);
  return parsed.success ? parsed.data : unavailable();
}
