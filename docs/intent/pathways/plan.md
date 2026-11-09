# Pathways in Visual Notes: decisions and plan

The prototype lives in [sandbox/pathways](../../../sandbox/pathways/README.md). Decisions come from Byron's answers on November 8, 2026.

## Goals

- **Get unstuck on a decision.** See the options, where they lead 1–3 steps out, and where different choices end up in the same place.
- **Find the options you missed.** An agent proposes choices and next steps, asks about your goals, and reads your reactions and notes.
- **Explore, then do.** The map is for exploring. Next steps is the short list to go do. You report back what happened and the map catches up.
- **Only a thin slice becomes real tasks.** Most pathway content stays in the pathway. You export the few next steps worth tracking, and they stay linked.

## Decisions

| Area | Decision |
| --- | --- |
| Home | **Own feature for now**, until it is clear what this thing is. A **Pathways** sidebar item next to Tasks. `/pathways` lists maps; `/pathways/<id>` opens one. Not built on Research topics, though both may merge later. |
| Storage | One `Pathway` row per map. The graph (nodes, edges), goals and Q&A, and the plan sit in JSON columns, the same shape as the sandbox file. `PathwayRevision` keeps a snapshot before each write, which gives undo for people and agents. |
| Task links | `PathwayTaskLink {pathwayId, taskId, nodeIds[], planTaskId}`, many-to-many: one task can serve several pathways, and most tasks belong to none. A plan task that was exported holds its `taskId`. |
| Export | **Pick a list each time.** "Export to tasks" opens a picker: choose next steps and a list. The pathway remembers the last list. Exported tasks get a link back to the pathway. |
| Status sync | **Mirror.** A plan task linked to a real task shows that task's status (`complete` is done, `cancelled` is skipped). "What happened?" stays in Pathways and waits for your words before the map update reads it. |
| Task awareness | A linked task shows a "↳ map title" link on its row that opens the map's Next steps. Tasks never require a pathway. (The task editor dialog does not list pathways yet.) |
| Entry points | All four in v1: **from a task** (row menu "Map this out": the task becomes the question and links back), **free-form** ("New decision": question plus optional context), **from a note** (the agent reads the note and drafts the first options), **from chat via MCP**. |
| Agent in the app | The sandbox's actions, on the server through `callLLM` so every call is logged: more choices, what happens next, where paths meet, what am I missing, goals questions, improve from feedback, fresh map, plan next steps, update map from what happened. Web research uses OpenAI's web search tool. |
| Agent over MCP | `pathways_list`, `pathways_get` (outline with goals, notes, reactions, plan, research queue), `pathways_create` (from question, task, or note), `pathways_edit` (batched ops: add nodes and edges, merge, set status, weight, feedback, notes; one revision per call), `pathways_set_plan`, `pathways_report_research`. Claude in chat is then the agent: it reads the map, ideates, and writes. |
| Map view | Port the sandbox: packed left-to-right layout (dagre), the Draftably router in a Web Worker, near and far layouts by zoom, cards that fill with text, hover peek, change card, reactions and weights with keys 1–5, AutoText fields. Restyle on Panda tokens and `~/components/ui`. |
| Live updates | v1 refetches the open map when the tab regains focus and after each agent call. A `pathways-<id>` live channel comes later if MCP edits feel stale. |
| Import | After deploy, the chat agent imports the sandbox's **Indy Init** map through `pathways_create` with `import` (goals, notes, research, plan). No script and no personal content in the repo. The demo map stays behind. |
| UI polish | Port the behavior first, then run a `/10x` pass on the real screens: information architecture, where each thing lives, and visuals on the app's design system. |

## PR stack

1. **docs**: this plan.
2. **model**: Prisma migration (`Pathway`, `PathwayRevision`, `PathwayTaskLink`), store with revisions and undo, graph apply ops shared by the agent and MCP (pure, tested).
3. **mcp**: seven tools (`pathways_undo` joined the six), guidance text, and a database test through the real MCP server.
4. **map page**: `/pathways` list and `/pathways/<id>` map: layout, router worker, cards, panel, AutoText, in-app agent actions, research, sidebar item.
5. **next steps**: the Next steps view, export picker, `PathwayTaskLink`, status mirroring, and pathway links on task rows and in the task editor.
6. **entry points**: "Map this out" on task rows, "Explore as pathway" on notes, and "New decision".
7. **10x**: an IA and visual pass on the map, panel, and Next steps, with before and after screenshots.

## Open questions for later

- Does Pathways merge into Research topics once its shape is clear?
- Live updates while Claude edits a map over MCP: is refetch on focus enough?
- Should "What happened?" also accept a note link or a voice memo transcript?
