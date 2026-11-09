/**
 * `AGENT_INBOX=false` hides annotations, proposals, the inbox, and their
 * tools. Read straight from the environment so tool tests that build the MCP
 * server need no full env.
 */
export const agentInboxEnabled = () => process.env.AGENT_INBOX !== "false";
