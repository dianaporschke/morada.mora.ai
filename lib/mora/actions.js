import { z } from 'zod';
import { draftActionState, issueContent } from '../../assets/mora-data.js';

const base = { id:z.string().min(1).max(100), label:z.string().min(1).max(90), variant:z.enum(['primary','secondary']) };
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type:z.literal('select'), field:z.enum(['message','location','since','extent','equipment','details']), value:z.string().min(1).max(2000) }).strict(),
  z.object({ ...base, type:z.literal('switch_issue'), issueId:z.string().uuid() }).strict(),
  z.object({ ...base, type:z.literal('navigate'), target:z.enum(['docs','service','profile','portfolio']) }).strict(),
  z.object({ ...base, type:z.literal('call'), number:z.literal('112') }).strict(),
  ...['handover','attachment','add_details','continue'].map(type => z.object({ ...base, type:z.literal(type) }).strict()),
]);
export const action = (id, label, type, extra = {}) => actionSchema.parse({ id, label, type, variant:'secondary', ...extra });
export const select = (id, label, field, value = label) => action(id, label, 'select', { field, value });
// A local draft is the only available handover; do not label it as a sent report.
export const report = (primary = true, update = false) => action('prepare-request', update ? 'Entwurf aktualisieren' : 'Für MORADA vorbereiten', 'handover', { variant:primary ? 'primary':'secondary' });

/** A typed proposal may expose a button; it can never execute the handover. */
export function preparationProposal(state,{reuseExisting=true}={}) {
  if(!state.issue || state.pendingKey)return null;
  const existing=reuseExisting && state.actions?.find(item=>item.type==='handover');
  if(existing)return existing;
  const policy=draftActionState(state.issue);
  return policy.canOffer && (state.actions?.length || 0)<4?report(true,policy.operation==='update'):null;
}
export function rememberPreparationOffer(state) {
  if(!state.issue)return;
  state.issue.draftOfferShown=true;
  state.issue.draftOffer={operation:draftActionState(state.issue).operation,content:issueContent(state.issue),revision:state.issue.revision};
}
export function acceptPreparationProposal(state) {
  const proposal=preparationProposal(state);
  if(!proposal)throw Object.assign(new Error('Preparation is not available'),{code:'INVALID_ACTION'});
  if(!state.actions.some(item=>item.type==='handover'))state.actions=validateActions([...state.actions,proposal],state);
  rememberPreparationOffer(state);
}
export const photo = () => action('attach-photo', 'Foto hinzufügen', 'attachment');
export const additional = () => action('add-details', 'Noch etwas ergänzen', 'add_details');
export const continueIssue = () => action('continue-issue', 'Mit meinem Anliegen fortfahren', 'continue');
export const issueSwitch = issue => action(`switch-${issue.id}`, `${issue.shortLabel || 'Weiteres Anliegen'} bearbeiten`, 'switch_issue', { issueId:issue.id });

export function validateActions(actions, state) {
  if (actions.length > 4) throw new Error('Too many actions');
  const parsed = actions.map(value => actionSchema.parse(value));
  if (new Set(parsed.map(value => value.id)).size !== parsed.length) throw new Error('Duplicate actions');
  if (parsed.some(value => value.type === 'switch_issue' && !state.issues.some(issue => issue.id === value.issueId))) throw new Error('Invalid issue target');
  return parsed;
}
