# Pathways sandbox

A throwaway prototype for a "choose your own adventure" decision map. It is separate from the Visual Notes app: no database, no sign-in.

```sh
cd sandbox/pathways && corepack pnpm install && corepack pnpm dev
```

Open http://localhost:5174.

## What it does

- A map starts from a question (the root). Options, steps, and outcomes grow to the right.
- Paths can meet. A node with more than one incoming edge gets an amber ring and a "N paths meet" badge.
- Hover a node to trace every path through it.
- The in-app agent (OpenAI) has three actions:
  - **What are my options?** adds missing options at a node, including "new angle" ones you may not have considered.
  - **Play it forward** adds the next 1 to 3 steps, and links to existing nodes where paths meet.
  - **Where do paths meet?** merges duplicate nodes and adds shared outcomes.
- **Undo** (⌘Z) steps back through every change, agent changes included.

The agent uses `OPENAI_API_KEY` from the shell, or else from the main checkout's `app/.env`. Set `PATHWAYS_MODEL` (default `gpt-5.4-mini`) or `PATHWAYS_EFFORT` (default `medium`) to change it.

## Outside agents

Each map is one JSON file in `data/maps/<id>.json`. An agent such as Claude Code can edit the file directly. The page reloads the map when the file changes, and pulses the new nodes. A direct file edit cannot be undone, because only the API saves a history copy before it writes. Use `PUT /api/maps/:id` when the edit must be undoable.

File shape (see `src/types.ts`):

```json
{
  "id": "demo",
  "title": "The question",
  "nodes": [
    { "id": "root", "kind": "root", "title": "The question", "note": "", "by": "me", "status": "open" },
    { "id": "a1", "kind": "option", "title": "An option", "note": "Why or tradeoff", "by": "agent", "status": "open", "missed": true }
  ],
  "edges": [{ "from": "root", "to": "a1" }],
  "updatedAt": "2026-11-08T00:00:00.000Z"
}
```

- `kind`: `root`, `option`, `step`, or `outcome`. Keep the root id as `root`.
- `status`: `open`, `chosen`, or `dropped`.
- `missed: true` marks an option the person probably had not considered.
- Edges point forward in time. To show that two paths arrive at the same place, point both at one node.

HTTP API: `GET/POST /api/maps`, `GET/PUT /api/maps/:id`, `POST /api/maps/:id/undo`, `POST /api/maps/:id/agent` with `{ "action": "options" | "forward" | "converge", "nodeId": "...", "hint": "..." }`.
