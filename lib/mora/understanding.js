import { generateStructured } from './structured.js';
import { resolveProvider, classifyModelError, modelUnavailable, logModelUsage, safeUsage } from './provider.js';
import { modelContext } from './context.js';
import { understandingSchema, conversationSchema, emptyUnderstanding, issuePatchSchema } from './schema.js';
import { guidedUnderstanding } from './guided.js';
import { portalCapabilities } from '../portal/adapter.js';
import { validatedDialogueReply } from './dialogue.js';
import { isSpecificEquipment } from './equipment.js';
import { CONVERSATION_INSTRUCTIONS } from './instructions.js';

// Each service keeps only provider health, never customer messages or conversation state.
const PROVIDER_COOLDOWN_MS = 60_000;



export { guidedUnderstanding } from './guided.js';

export async function extractUnderstanding(message, state, options = {}) {
  return defaultUnderstanding(message, state, options);
}

/** Dependency injection makes provider refusal and strict AI mode testable without paid calls. */
export function createUnderstandingService({ env = process.env, resolve = resolveProvider,
  generate = generateUnderstandingResult, now = () => Date.now(), log = logModelUsage } = {}) {
  const cooldowns = new Map();
  return async function understand(message, state, options = {}) {
    const selection = await resolve(env);
    const fallback = availability => {
      if (env.MORA_AI_REQUIRED === 'true') throw modelUnavailable(availability);
      return { data:guidedUnderstanding(message, state), mode:'guided', availability };
    };
    if (!selection.ready) return fallback(selection.availability);
    const key = `${selection.provider}:${selection.model}`;
    const cooldown = cooldowns.get(key);
    if (cooldown && now() < cooldown.until) return fallback(cooldown.availability);
    const start = now();
    try {
      const {data,usage,totalUsage,metadata,generationCount}=await generate(message,state,selection.createModel(),{...options,
        logInvalid:error=>{
          log('conversation_invalid_output',selection,error.usage,now()-start,error.metadata);
          console.warn('MORA structured answer rejected',{validationFields:error.validationFields || null});
        }});
      console.info('MORA semantic plan',{intent:data.intent,targeted:Boolean(data.targetIssueId),newIssue:data.newIssue,
        updatedFields:['equipment','location','since','extent','count','details','defect'].filter(key=>data[key]!=null),
        additionalIssues:data.additionalIssues.length,question:data.question,questionTargeted:Boolean(data.dialogue?.forIssueId)});
      cooldowns.delete(key);
      log(data.dialogue ? 'conversation' : 'understanding', selection, usage, now() - start, metadata);
      return {data:understandingSchema.parse(data),mode:'model',usage:safeUsage(totalUsage || usage),generationCount:generationCount || 1};
    } catch (error) {
      if (error.usage) log('understanding_invalid_output', selection, error.usage, now() - start,error.metadata);
      const availability = classifyModelError(error, selection);
      if ([401, 402, 403, 404, 429].includes(availability.status)) {
        cooldowns.set(key, { until:now() + PROVIDER_COOLDOWN_MS, availability });
      }
      console.warn('MORA semantic understanding unavailable', {...availability,validationFields:error.validationFields || null});
      return fallback(availability);
    }
  };
}
const defaultUnderstanding = createUnderstandingService();

function normalizeDialogue(data) {
  const buttons=(data.dialogue.buttons || []).map(button=>({...button,
    label:button.label || button.value?.slice(0,90) || button.kind,
    field:button.field ?? null,value:button.value ?? null,target:button.target ?? null}));
  const {ask,...dialogue}=data.dialogue;
  const stage=ask ? 'clarify' : data.intent==='contact' || buttons.some(button=>button.kind==='prepare_draft') ? 'offer_draft' : data.intent!=='issue' ? 'information' : 'discuss';
  return {...dialogue,stage,buttons,...(!ask?.targetIssueId && ask?.issueIndex!==undefined ? {forIssueIndex:ask.issueIndex} : {}),
    ...(ask?.targetIssueId ? {forIssueId:ask.targetIssueId} : {})};
}

/** The production SDK path is also used by contract tests and the explicit live probe. */
export async function generateUnderstandingResult(message, state, model, options = {}) {
  const { history, ...context } = modelContext(state);
  // Short request-scoped references avoid copying long opaque session IDs.
  // They resolve only through this request's signed state, never arbitrary IDs.
  const refs=new Map();
  if (context.activeIssue) {refs.set('active',context.activeIssue.id);context.activeIssue.id='active';}
  context.knownIssues=context.knownIssues.map((issue,index)=>{
    const ref=`other${index+1}`;refs.set(ref,issue.id);return {...issue,id:ref};
  });
  const availableIssueReferences=[...refs.keys()];
  const resolveReference=ref=>ref==null ? null : refs.get(ref);
  const resolveOutput=raw=>({...raw,targetIssueId:resolveReference(raw.targetIssueId),dialogue:{...raw.dialogue,
    ...(raw.dialogue.ask ? {ask:{...raw.dialogue.ask,
      ...(raw.dialogue.ask.targetIssueId ? {targetIssueId:resolveReference(raw.dialogue.ask.targetIssueId)} : {})}} : {})}});

  // Real low-reasoning trials lost a room update and produced weaker German.
  // Preserve reasoning quality; optimize by removing the redundant second stage.
  const result = await generateStructured({
    model, instructions: CONVERSATION_INSTRUCTIONS,
    messages: [ ...history, { role:'user', content:JSON.stringify({ ...context, availableIssueReferences, capabilities:portalCapabilities, customerMessage:message }) } ],
    schema:conversationSchema, name:'MoraConversation',
    maxOutputTokens:3200, maxRetries:0,
    reasoningEffort:'medium',
    abortSignal:AbortSignal.timeout(Math.max(1, Math.min(50000, options.timeoutMs ?? 50000))),
    providerOptions:{ openai:{ store:false } },
    validateOutput:raw=>{
      if (raw.targetIssueId && !refs.has(raw.targetIssueId) || raw.dialogue.ask?.targetIssueId && !refs.has(raw.dialogue.ask.targetIssueId)) {
        throw Object.assign(new Error('Unknown issue reference'),{validation:'unknown_issue_reference',validationField:'targetIssueId'});
      }
      const resolved=resolveOutput(raw);
      const data={...resolved,question:raw.dialogue.ask?.field || null,clarification:raw.dialogue.ask?.text || null,
        unknownAnswers:raw.unknownAnswers || [],additionalIssues:raw.additionalIssues || [],
        dialogue:normalizeDialogue(resolved)};
      validatedDialogueReply(data);
      if (data.dialogue.buttons.some(button=>button.kind==='select' && (!button.field || !button.value))) {
        throw Object.assign(new Error('Incomplete choice'),{validation:'incomplete_choice',validationField:'dialogue.buttons'});
      }
      const unknown=data.unknownAnswers.filter(item=>message.includes(item.quote)).map(item=>item.field);
      const key=data.question;
      const index=raw.dialogue.ask?.targetIssueId ? undefined : raw.dialogue.ask?.issueIndex;
      const questionTarget=resolved.dialogue.ask?.targetIssueId;
      if (raw.dialogue.ask && !questionTarget && ((data.additionalIssues.length && index===undefined) || (index!==undefined && index>data.additionalIssues.length))) {
        throw Object.assign(new Error('Question issue target missing or out of bounds'),{validation:'ambiguous_issue_target',validationField:'dialogue.ask.issueIndex'});
      }
      if (data.targetIssueId && !state?.issues?.some(issue=>issue.id===data.targetIssueId)) {
        throw Object.assign(new Error('Unknown issue reference'),{validation:'unknown_issue_reference',validationField:'targetIssueId'});
      }
      if (questionTarget && !state?.issues?.some(issue=>issue.id===questionTarget)) {
        throw Object.assign(new Error('Unknown or ambiguous question reference'),{validation:'unknown_issue_reference',validationField:'dialogue.ask.targetIssueId'});
      }
      if (data.additionalIssues.length) {
        const spans=[];
        for (const [index,patch] of [data,...data.additionalIssues].entries()) {
          const quote=patch.sourceQuote;
          let offset=typeof quote==='string' ? message.indexOf(quote) : -1;
          while (offset>=0 && spans.some(span=>offset<span.end && offset+quote.length>span.start)) offset=message.indexOf(quote,offset+1);
          if (offset<0) throw Object.assign(new Error('Issue source missing or overlapping'),{validation:'source_overlap',validationField:'sourceQuote'});
          spans.push({start:offset,end:offset+quote.length});
          const known=index===0 && !data.newIssue && state?.issue?.equipment===data.equipment ? state.issue : null;
          if (patch.location && patch.location!==known?.location && !quote.toLocaleLowerCase().includes(patch.location.toLocaleLowerCase())) {
            throw Object.assign(new Error('Room assigned to the wrong issue'),{validation:'source_conflict',validationField:'location'});
          }
        }
      }
      const rootId=data.targetIssueId || state?.issue?.id;
      const patch=questionTarget && questionTarget!==rootId ? {} : [data,...data.additionalIssues][index || 0];
      const prior=questionTarget ? state?.issues?.find(issue=>issue.id===questionTarget) : index ? null : data.targetIssueId ? state?.issues?.find(issue=>issue.id===data.targetIssueId) : state?.issue;
      const known=key && key!=='details' && (key==='equipment'
        ? isSpecificEquipment(patch.equipment) || isSpecificEquipment(prior?.equipment)
        : patch[key]!=null || prior?.[key]!=null || (key==='extent' && (patch.count!=null || prior?.count!=null)));
      if (data.intent==='issue' && data.dialogue.stage==='clarify' && key && (known || ((!questionTarget || questionTarget===rootId) && !index && unknown.includes(key)) || prior?.unknownFields?.includes(key) || (prior?.attempts?.[key] || 0)>=2)) {
        throw Object.assign(new Error('Known or unknown fact re-asked'),{validation:'repeated_question',validationField:`dialogue.ask.${key}`});
      }
    },logInvalid:options.logInvalid,
  });
  const {unknownAnswers,sourceQuote,risk,...data}=resolveOutput(result.data);
  const defaults=emptyUnderstanding();
  const defaultPatch=Object.fromEntries(Object.keys(issuePatchSchema.shape).map(key=>[key,defaults[key]]));
  const sourceDescription=quote=>typeof quote==='string' && message.includes(quote) ? quote : null;
  const normalizeIssue=patch=>{const {sourceQuote,risk,...fields}=patch;return {...defaultPatch,...fields,
    description:sourceDescription(sourceQuote) || fields.description || null,hazard:risk==='flood' ? 'water' : risk || 'none'};};
  data.additionalIssues=(data.additionalIssues || []).map(normalizeIssue);
  data.question=data.dialogue.ask?.field || null;
  data.clarification=data.dialogue.ask?.text || null;
  data.dialogue=normalizeDialogue(data);
  // Missing information is not a customer's refusal. Require direct provenance
  // instead of guessing unknown facts from null values or matching typo patterns.
  const unknownFields=(unknownAnswers || []).filter(item=>message.includes(item.quote)).map(item=>item.field);
  return {...result,data:{...defaults,...data,description:(data.additionalIssues.length ? sourceDescription(sourceQuote) : null) || data.description || sourceDescription(sourceQuote),hazard:risk==='flood' ? 'water' : risk || 'none',topic:null,answer:null,unknownFields:[...new Set(unknownFields)]}};
}

export async function generateUnderstanding(message, state, model) {
  return (await generateUnderstandingResult(message, state, model)).data;
}
