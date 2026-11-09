# Pathways sandbox

A throwaway prototype for a "choose your own adventure" decision map. It is separate from the Visual Notes app: no database, no sign-in.

```sh
cd sandbox/pathways && corepack pnpm install && corepack pnpm dev
```

Open http://localhost:5174.

## What it does

- A map starts from a question (the root). Options, steps, and outcomes grow to the right.
- The layout packs layers to fit the window: a tall layer wraps into extra columns. Edges route around cards (the router is copied from Diagram Studio / Draftably).
- Paths can meet. A node with more than one incoming edge gets an amber ring and a "N paths meet" badge.
- Hover a node to trace every path through it. Drag anywhere to pan; ⌘/Ctrl + scroll zooms.
- Detail follows zoom. Below 70% zoom the map switches to a title-only layout with bigger cards; above 85% it switches back to full cards with notes. The card under the cursor stays in place across the switch. Fit picks the layout that reads best. Hover a card while zoomed out to see its full text.

### Tell it what you think

Select a node, then press a key (or use the panel):

| Key | Meaning |
| --- | --- |
| 1 | Like |
| 2 | Not for me |
| 3 | Want better options here |
| 4 | Important: bigger card, kept in the middle |
| 5 | Noise: one faint line at the edge of its column (nothing is deleted) |

Write your thoughts on any card in its **Your take** box, with or without a reaction; the card gets a ✎ note badge. Every agent action reads these notes, and **Improve from feedback** follows them. **Goals & vibes** (shown when nothing is selected) holds your own words and the agent's questions about your goals. Every agent prompt includes them.

### Agent actions (OpenAI)

- **More choices from here** adds 2–5 different choices that could follow from a card, with "new angle" ones you may not have considered.
- **What happens next** adds the likely next 1–3 steps if you go that way, and links to cards already on the map where paths meet.

The steer box belongs to what is selected: it clears when you select something else or when a run uses it. The result card shows the steer that run used.
- **Where do paths meet?** merges duplicate nodes and adds shared outcomes.
- **Ask me about my goals** adds 3 or 4 questions to Goals & vibes.
- **Improve from feedback** drops what you rejected, adds better options where you asked, and extends what you liked.
- **Fresh map from feedback** builds a new version ("· v2") as a separate map. The old map stays.

After each run, the panel shows what changed (added, joined existing paths, dropped, merged) and how long the call took. The new nodes and edges stay outlined until the next change. **Undo** (⌘Z) steps back through every change, agent changes included.

### Research

The agent puts a research question on a node when acting on it needs facts from the web. You can add one by hand with **Needs research…**. Then:

- **Research now** runs an OpenAI web search (about 30–60 seconds) and saves findings and sources on the node. Later agent prompts read them.
- **Queue for an agent** leaves it for an outside agent. `GET /api/research` lists the queue across maps. The agent reports back with `POST /api/maps/:id/research` and `{ "nodeId", "findings", "sources": [{ "title", "url" }], "by" }`.

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

HTTP API: `GET/POST /api/maps`, `GET/PUT /api/maps/:id`, `POST /api/maps/:id/undo`, `POST /api/maps/:id/agent` with `{ "action": "options" | "forward" | "converge" | "questions" | "improve" | "regenerate", "nodeId": "...", "hint": "..." }`, `POST /api/maps/:id/research`, and `GET /api/research`.

Optional node fields: `feedback: { vote: "like" | "no" | "more", comment }`, `weight: "key" | "noise"`, `research: { question, status, findings, sources, by }`. Optional map field: `context: { notes, qa: [{ q, a }] }`.
