import {createPortalChatHandler} from './portal-chat.js';
import {createCompactPortalAgent} from '../lib/mora/portal/compact-agent.js';
import {createPreviewCreditGuard,AGENT_MODEL} from '../lib/mora/portal/budget.js';

// Isolated signed sessions; never replaces the established portal_v1 route.
export default createPortalChatHandler({converse:createCompactPortalAgent(),preflight:createPreviewCreditGuard(process.env,AGENT_MODEL),integration:'portal_agent_v1'});
