const issueFields = ['id','category','equipment','description','defect','count','location','since','extent','details','cause','urgency','hazard','unknownFields'];
const briefFields = ['id','category','equipment','location','since','extent','count','description','defect','details','cause','unknownFields'];

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
  const active=state?.issue ? {...state.issues?.find(issue=>issue.id===state.issue.id),...state.issue} : null;
  const activeIssue=pick(active, issueFields);
  if (activeIssue) {
    activeIssue.localPhotoCount=active.attachments?.length || 0;
    activeIssue.draftAlreadyOffered=Boolean(active.draftOfferShown);
    activeIssue.askedFields=Object.keys(active.attempts || {}).filter(key => active.attempts[key]>0);
  }
  return { history, activeIssue, pendingQuestion:state?.pendingKey || null,
    pendingQuestionText:active?.clarification || null,conversationTopic:state?.conversationTopic || null,
    // The active facts are already present; keep other drafts without repeating them.
    knownIssues:(state?.issues || []).filter(issue => issue.id !== state?.issue?.id).slice(0, 8).map(issue => pick(issue, briefFields)) };
}
