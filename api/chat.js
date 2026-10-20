import { chatInputSchema } from '../lib/mora/schema.js';
import { readSession, sealSession } from '../lib/mora/session.js';
import { processTurn } from '../lib/mora/engine.js';
import { extractUnderstanding } from '../lib/mora/understanding.js';
import { portalCapabilities } from '../lib/portal/adapter.js';
import { canComposeReply, composeNaturalReply, retainValidatedConversation } from '../lib/mora/reply.js';
import { modelFailure } from '../lib/mora/availability.js';
import { readPortalContext } from '../lib/mora/portal-context.js';
import { safeUsage } from '../lib/mora/provider.js';
import { acceptPreparationProposal } from '../lib/mora/actions.js';

const sumUsage=(first,second)=>Object.fromEntries(['inputTokens','outputTokens','reasoningTokens','cachedInputTokens'].map(key=>[key,
  Number.isSafeInteger(first?.[key]) && Number.isSafeInteger(second?.[key])?first[key]+second[key]:null]));

export function createChatHandler(understand = extractUnderstanding, { compose = composeNaturalReply, env = process.env, loadPortalContext=undefined } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Nur POST-Anfragen sind erlaubt.' });
    }
    const parsed = chatInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Bitte geben Sie eine kurze Nachricht oder eine gültige Aktion ein.' });
    const startedAt=Date.now();
    let modelMs=0,modelCalls=0;
    try {
      // Extraction and wording share one bounded budget, below the Function limit.
      const deadline = Date.now() + 55000;
      const previous = parsed.data.session ? readSession(parsed.data.session) : null;
      const portalContext=await readPortalContext(req,loadPortalContext);
      const result = await processTurn(parsed.data, previous, async(message, state) => {
        const start=Date.now(); modelCalls++;
        try {
          const interpreted=await understand(message,state,{timeoutMs:deadline-Date.now(),portalContext});
          if (interpreted.generationCount>1) modelCalls+=interpreted.generationCount-1;
          return interpreted;
        }
        catch (error) { if (error.modelCalls===2) modelCalls++; throw error; }
        finally { modelMs+=Date.now()-start; }
      });
      const activeDanger=result.state.issue && (result.state.issue.hazard!=='none' || result.state.issue.urgency==='emergency');
      let responseMode = result.understanding === 'safety' || activeDanger ? 'safety' : result.recoveredFacts ? 'recovery' : result.singleModelReply ? 'model' : 'engine';
      if ((result.needsWording || !result.singleModelReply && env.MORA_AI_NATURAL_REPLIES === 'true') && canComposeReply(result)) {
        const start=Date.now(); modelCalls++;
        try {
          const composed=await compose(result, {env, timeoutMs:deadline - Date.now()});
          result.reply=typeof composed==='string'?composed:composed.reply;
          if(typeof composed!=='string') {
            if(composed.requestPreparation)acceptPreparationProposal(result.state);
            modelCalls+=Math.max(0,(composed.generationCount || 1)-1);
            const usage=safeUsage(composed.usage);
            result.modelUsage=sumUsage(result.modelUsage,usage);
          }
        }
        catch(error) {
          if(error.modelCalls>1)modelCalls+=error.modelCalls-1;
          error.modelUsage=sumUsage(result.modelUsage,error.modelUsage);
          if(error.code==='MODEL_UNAVAILABLE' && retainValidatedConversation(result,error.availability))result.modelUsage=error.modelUsage;
          else throw error;
        }
        finally { modelMs+=Date.now()-start; }
        // The signed context must contain the wording actually shown to the customer.
        result.state.history.at(-1).content = result.reply;
        responseMode = result.recoveredFacts?'recovery':'model';
      }
      const totalMs=Date.now()-startedAt;
      const timingMs={total:totalMs,model:modelMs,application:Math.max(0,totalMs-modelMs)};
      console.info('MORA turn timing',{...timingMs,modelCalls,responseMode,architecture:result.needsWording?'verified_state_then_wording':result.singleModelReply?'single_generation':'legacy_or_safety'});
      return res.status(200).json({ version: 2, reply: result.reply, actions: result.state.actions,
        issue: result.state.issue, issues: result.state.issues, session: sealSession(result.state), capabilities: portalCapabilities,
        understanding: result.understanding, responseMode, modelAvailability:result.availability,
        timingMs,modelCalls,recoveredFacts:Boolean(result.recoveredFacts),wordingFallback:result.wordingFallback || null,degraded:Boolean(result.wordingFallback),modelUsage:result.modelUsage || null });
    } catch (error) {
      if (error.code === 'MODEL_UNAVAILABLE') {
        const failure = modelFailure(error.availability);
        console.warn('MORA model unavailable', {...failure.modelAvailability,category:failure.category,retryable:failure.retryable,validation:error.validation || null});
        const total=Date.now()-startedAt;
        return res.status(503).json({...failure,timingMs:{total,model:modelMs,application:Math.max(0,total-modelMs)},
          modelCalls,modelUsage:error.modelUsage || null});
      }
      if (error.code === 'ISSUE_LIMIT') return res.status(409).json({ error:'In dieser Unterhaltung sind bereits acht Anliegen aufgenommen. Öffnen Sie die vorhandenen Entwürfe und starten Sie für weitere Probleme einen neuen Chat.', code:'ISSUE_LIMIT' });
      if (error.code === 'INVALID_SESSION' || error.code === 'INVALID_ACTION') {
        return res.status(409).json({ error: 'Diese Unterhaltung oder Aktion ist nicht mehr aktuell. Ihre Angaben bleiben im Chat erhalten. Bitte starten Sie eine neue Unterhaltung.', code: error.code });
      }
      // Never log messages, signed sessions or provider errors containing request bodies.
      console.error('MORA request failed', { code: 'TURN_FAILED' });
      return res.status(500).json({ error: 'MORA ist gerade nicht erreichbar. Ihre bisherigen Angaben bleiben erhalten. Bitte versuchen Sie es erneut.' });
    }
  };
}
export default createChatHandler();
