import {createPortalChatHandler} from './portal-chat.js';
import {createPortalAgent} from '../lib/mora/portal/agent.js';

// Isolated signed sessions; never replaces the established portal_v1 route.
export default createPortalChatHandler({converse:createPortalAgent(),integration:'portal_agent_v1'});
