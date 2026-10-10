const issueFields = ['id','category','equipment','description','defect','count','location','since','extent','details','urgency','hazard','unknownFields'];
const briefFields = ['id','category','equipment','location','since','extent','count','description','unknownFields'];

function pick(issue, fields) {
  if (!issue) return null;
  return Object.fromEntries(fields.map(key => [key, typeof issue[key] === 'string' ? issue[key].slice(0, 2000) : issue[key]]));
}

/** Keep structured facts even when older messages no longer fit the bounded history. */
export function modelContext(state) {
  let remaining = 12000;
  const history = [];
  for (const item of (state?.history || []).slice(-20).reverse()) {
    if (!['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') continue;
    const content = item.content.slice(0, 2000);
    // Preserve complete recent entries rather than a misleading fragment of an older message.
    if (content.length > remaining) break;
    history.unshift({ role:item.role, content }); remaining -= content.length;
  }
  return { history, activeIssue:pick(state?.issue, issueFields), pendingQuestion:state?.pendingKey || null,
    knownIssues:(state?.issues || []).slice(0, 8).map(issue => pick(issue, briefFields)) };
}
