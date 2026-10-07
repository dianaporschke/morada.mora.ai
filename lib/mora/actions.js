import { z } from 'zod';

const base = { id:z.string().min(1).max(100), label:z.string().min(1).max(90), variant:z.enum(['primary','secondary']) };
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type:z.literal('select'), field:z.enum(['message','location','since','extent','equipment']), value:z.string().min(1).max(2000) }).strict(),
  z.object({ ...base, type:z.literal('switch_issue'), issueId:z.string().uuid() }).strict(),
  z.object({ ...base, type:z.literal('navigate'), target:z.enum(['docs','service','profile','portfolio']) }).strict(),
  z.object({ ...base, type:z.literal('call'), number:z.literal('112') }).strict(),
  ...['handover','attachment','add_details','continue'].map(type => z.object({ ...base, type:z.literal(type) }).strict()),
]);
export const action = (id, label, type, extra = {}) => actionSchema.parse({ id, label, type, variant:'secondary', ...extra });
export const select = (id, label, field, value = label) => action(id, label, 'select', { field, value });
// A local draft is the only available handover; do not label it as a sent report.
export const report = (primary = true) => action('prepare-request', 'Für MORADA vorbereiten', 'handover', { variant:primary ? 'primary':'secondary' });
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
