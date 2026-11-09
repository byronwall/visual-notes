# Agent inbox

The agent inbox lets you leave work for MCP agents while you read, and see what they did in one place. An agent such as a ChatGPT scheduled task checks the inbox on its own schedule, does the work, and answers. Planning history is in `docs/intent/agent-inbox/`.

## What the user does

- **Note to AI.** Use the button in the note header (next to the microphone), or the **Note to AI** button in the task editor and the task sheet. It adds a request on the whole note or task, with the built-in **Request** type.
- **Highlights.** Select text in one block and click **Annotate**. Then pick a type and write a comment. The highlight is drawn over the text. The rail left of the note lists the annotations in note order. A narrow window gets an **N annotations** button that opens the list as a sheet.
- **Types.** **Types** (in the rail or the composer) manages types: a name, a color (`amber`, `green`, `blue`, `red`, or `gray`), a **For AI** flag, and the default. **Note** (the default), **Request** (For AI), and **From AI** (agent-written) always exist. Request and From AI cannot be deleted. Deleting another type moves its annotations to the default.
- **Suggested edits.** An agent's proposed edit shows inline: the old block is struck through, and a card holds the new blocks with **Accept** and **Reject**. **Accept** applies the edit in the open editor, so autosave writes it as your edit.
- **Inbox.** `/inbox` and the sidebar **Inbox** count. See [Inbox page](#inbox-page).

## Records

All of it lives beside the note, never in `Doc.content`. Adding an annotation changes no text, revision, search text, or markdown.

| Model               | Holds                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AnnotationType`    | Name, color, `forAi`, `isDefault`, `builtIn` (`request`, `from-ai`)                                                                                                                                                                       |
| `Annotation`        | On a note (`docId`) or a task (`taskId`). A passage has `blockId`, `quote`, and `quoteStart`; a whole-note one has neither. The request fields are `status`, `claimedBy`, `claimedAt`, `readyAt`, `closedAt`, `lastAgentAt`, and `seenAt` |
| `AnnotationMessage` | The request thread: `author` (`you` or the agent's client name) and `body`                                                                                                                                                                |
| `EditProposal`      | `ops` (`replace`, `insert_after`, `delete` with blocks and the target's `baseHash`, each `pending`, `accepted`, or `rejected`), an optional request (`annotationId`), `resolvedAt`                                                        |
| `ResearchComment`   | `seenAt` marks an agent's resolution as dismissed in the inbox                                                                                                                                                                            |

Code: `server/annotations/` (stores), `server/mcp/annotations-tools.ts` (tools), `services/annotations/` (queries and actions), `components/annotations/` (rail, composer, threads, Note to AI), `components/editor/annotations/` and `components/editor/proposals/` (ProseMirror plugins), and `components/inbox/` (the page).

## Requests

An annotation whose type is **For AI** is a request:

```text
open → claimed (an agent took it) → ready (the agent is done) → closed (only you)
```

- `inbox_claim` is a conditional update, so exactly one of two racing agents wins. A claim with no agent reply for 24 hours lapses (`CLAIM_TTL_MS`).
- An agent reply moves an open request to claimed. `ready: true` moves it to ready.
- Your reply on a ready or closed request opens it again and clears the claim.
- Changing an annotation's type to a For AI type opens it as a request. Changing it away drops the request state.

## Anchoring

A passage is stored as the block id plus the quoted text and where it started (`quoteStart`). Text counts only text nodes, joined (`blockText` in the editor, `nodeText` on the server).

- In the editor, `annotationPlugin.ts` maps each highlight through every transaction, so typing elsewhere or inside the passage keeps it in place.
- A typed edit that deletes the passage loses it. A remote version (applied with `preventUpdate`) makes the plugin look for the quote in the block again.
- After each successful content save, `DocumentViewer` calls the layer's flush. It saves the anchors that moved, so the stored quote always matches the stored note. A lost passage is saved as detached, and the rail shows it as **Passage removed**.
- On load, a quote that cannot be found shows as **Passage not found**. It is not marked detached, because the note may simply not be saved yet.

## Suggested edits

`notes_propose_edits` stores ops with the target block's hash (`blockHash`, normalized through the note schema). In the editor, `proposalPlugin.ts` draws each pending op.

- A replace or delete whose block changed shows **Note changed** and cannot be accepted.
- An addition stays valid while its anchor block exists, so "rewrite this block and add a list after it" works in either order.
- **Accept** runs `proposalTransaction` (the replaced block keeps its id) and then records the decision. The note body goes through the normal autosave and its per-block merge. Nothing writes it on the server.

## Inbox page

`loadUserInbox` (`server/annotations/user-inbox.ts`) sorts each item into one of these groups:

| Section        | What is in it                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Needs you      | Ready requests, agent replies after you last looked (`lastAgentAt > seenAt`), agent annotations you have not dismissed, pending proposals, and resolved research comments you have not dismissed |
| With agents    | Open and claimed requests                                                                                                                                                                        |
| Agent activity | `mcp.call.*` events from the last 7 days, grouped by agent, with calls more than 30 minutes apart starting a new run                                                                             |

The sidebar count is the length of **Needs you**. Every annotation write publishes the `inbox` live area (`annotations-*` and `inbox-*` query keys), so the count and open notes update without a reload.

## Switch

`AGENT_INBOX=false` leaves out the five MCP tools and their server-instructions line. It also makes the annotation, proposal, and inbox queries return nothing, and makes **Note to AI** report that the inbox is off. The button stays in the header so that the server render and the first client render match. Stored rows stay. It is a runtime env var, read straight from `process.env`.

## Testing locally

1. Start a database and the app with MCP on:

   ```sh
   corepack pnpm audit:db -- --owner inbox
   MCP_CONNECTOR_ENABLED=true MCP_DEV_TOKEN=dev corepack pnpm audit:harness -- <printed options>
   ```

2. Run the fake agent. With `--step propose`, it proposes edits on a note. Without it, it works the note's requests (and a task's with `--task`): it claims, annotates or proposes, and replies `ready`.

   ```sh
   MCP_URL=http://127.0.0.1:<port>/mcp MCP_BEARER=dev node --experimental-strip-types scripts/agent-inbox-smoke.ts --note <id> [--task <id>]
   ```

3. The database tests are `server/annotations/*.db.test.ts`. Run them with `TEST_DATABASE_URL` set to the audit database. Every local agent is named "Dev token". The database test covers the race between two agents.

## Live check with a scheduled agent

Do this once after deploying, on one test note:

1. Deploy with `AGENT_INBOX` unset or `true`, and with the MCP connector connected in ChatGPT (see [mcp-connector.md](mcp-connector.md#deploying-and-connecting-chatgpt-or-claude)).
2. Make a test note, and add a **Note to AI** such as "Find two current sources for this".
3. In ChatGPT, create a scheduled task that runs every few hours: "Check my Visual Notes inbox with inbox_get. Claim each open request, do the work, and reply with what you did (ready: true). Propose edits only when a request asks for a change to a note."
4. After the first run, open the Activity page's **MCP** tab. Look for `inbox_get`, `inbox_claim`, and `inbox_reply` from the ChatGPT client, and check that the request shows **Ready for review** in `/inbox`.
5. If the run read the inbox but did not write, unattended write approval is the likely cause, or the plan does not allow write tools in scheduled tasks. Record what happened. Any other MCP client that polls on a schedule, such as Claude routines, uses the same tools.
