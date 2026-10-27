import {z} from 'zod';
import {hydrateSimple,contentHash} from '../simple/state.js';
import {applyPatch} from '../issue-state.js';
import {emptyUnderstanding} from '../schema.js';

const id=z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
// Reserved integration contract. No HTTP endpoint accepts these raw values.
// IDs and labels must be resolved by a portal backend with the customer's rights.
export const walkthroughSelectionSchema=z.object({
  propertyId:id,unitId:id,walkthroughId:id,roomId:id,objectId:id,hotspotId:id,
  roomLabel:z.string().trim().min(1).max(120),objectLabel:z.string().trim().min(1).max(80),
}).strict();

export async function attachWalkthroughSelection(previous,{issueId,selectionToken},principal,resolveSelection){
  if(!principal||typeof resolveSelection!=='function')throw Error('Walkthrough authorization is not connected');
  if(typeof selectionToken!=='string'||selectionToken.length>2000)throw Error('Invalid selection token');
  const selection=walkthroughSelectionSchema.parse(await resolveSelection(selectionToken,principal));
  const state=hydrateSimple(previous),issue=state.issues.find(i=>i.id===issueId);
  if(!issue)throw Error('Unknown issue');
  const before=contentHash(issue),revision=issue.revision;
  const source='Kundenauswahl im Walkthrough: '+selection.objectLabel+' · '+selection.roomLabel;
  applyPatch(issue,emptyUnderstanding({equipment:selection.objectLabel,location:selection.roomLabel,correction:true,sourceQuote:source}),source,null,true);
  issue.walkthrough={...selection,status:'selected',equipment:issue.equipment};
  if(contentHash(issue)!==before)issue.revision=Math.max(issue.revision,revision+1);
  state.issue=issue;state.conversationTopic='issue';return state;
}

/** Correcting a room/device must never silently move an old hotspot there. */
export function invalidateWalkthroughSelection(issue){
  const link=issue.walkthrough;
  if(link?.status==='selected'&&(issue.location!==link.roomLabel||issue.equipment!==link.equipment||['unknown','uncertain'].includes(issue.fieldFacts?.location?.status)||['unknown','uncertain'].includes(issue.fieldFacts?.equipment?.status)))link.status='needs_reselection';
}
