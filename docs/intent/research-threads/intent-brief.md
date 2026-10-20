---
title: "Research threads: a multi-scale canvas for tasks and findings"
slug: "research-threads"
phase: intent
status: current
last_updated: "2026-10-19"
---

# Research threads: a multi-scale canvas for tasks and findings

## My read

Many of your projects are investigations, not checklists. A task produces a finding, and the finding raises new tasks, questions, or options. At any point, a project is a **frontier** of open work set against a growing body of what you know. The project ends when the frontier runs out or you lose interest or time.

You want each topic to be **its own canvas**. There will be many of them, never one giant canvas. Each holds the topic's tasks, findings, sources, and options, linked by where each one came from. The volume problem gets solved the same way at every scale: every layer has a **summary over details**. Zooming out folds groups of cards into their summaries, and zooming in returns to the raw material.

Much of the actual exploration will be done by **external agents** like Claude, Codex, and ChatGPT, writing into a topic over MCP. The app's job is to hold, structure, summarize, and show that work. It doesn't need to do the exploring.

Learning a topic is the first use case: collect and summarize information, then map out what to learn next. Decision research should fit without special handling. That means options stay stored and in view without overwhelming you.

## What matters most

- **The frontier is always visible**: open tasks and questions show at every zoom level.
- **Summaries come first at every scale**: library, then topic, then group, then card, then full note.
- **Pedigree**: what each item came from, and what it led to.
- **Agents are first-class writers**: they can add one item at a time or ingest a whole tree in one batch.

## The experience you want

From a **topic index**, you open a topic. Each topic shows its top summary, how many items are open, and its last activity. You land on a canvas that's laid out automatically from the topic's structure, and you can nudge cards and the layout remembers. You hand a frontier question to an agent, and it posts back a tree of findings, sources, and follow-up questions. Those attach under the question that spawned them, and the batch is attributed to the agent and can be undone. When a cluster gets dense, the app drafts a summary card for it. You accept or edit the summary, and from then on, zooming out shows that summary in place of the cluster. Finished and abandoned branches fade and fold away, but you can always reach them.

## Boundaries

### Must be true

- Many canvases, one per topic, each self-contained. The library layer is an index of topics, not one more canvas.
- Two separate structures. **Came-from** is a single primary parent per card, with optional **relates-to** links. **Summary groups** can span branches. Zooming folds by summary group, and pedigree shows as lines.
- Card types: task, question, finding, source, summary, option, criterion.
- Cards start short and can grow into a full rich note.
- Every agent change is attributed and can be undone as a batch.
- Nothing gets deleted automatically. Folding and fading are the way to condense, and deleting is manual and rare.
- Not everything belongs in the system. Linking out to external systems and capturing only the parts worth keeping (snippets, images) is fine.

### Must be avoided

- One massive canvas that holds everything.
- Building in-app agentic research for now. Generating the frontier is the external agents' job.
- Summaries that change under you without your approval.

## What seems settled

- **Clean slate.** This is a new model and surface. Tasks, Explorer, and `/canvas` are reference points, not a foundation.
- **In-app summaries.** The app drafts summaries itself, because it has the full context and summarizing is the easy part. External agents handle generation, which needs tools and autonomy.
- **Agents connect over MCP.** MCP is preferred over a REST API because it also works from ChatGPT.
- **Batch ingest.** It brings in agent exploration trees, research reports (split into findings, sources, and questions), your own notes and dictation, and web captures.
- **First usable version.** An agent posts an exploration tree over MCP, and it renders on a topic canvas with pedigree, fold-by-summary zoom, and open items visible.

## Possibilities, not decisions

- Open items stay visible inside folded groups for now. If that turns out cluttered, they collapse into a count on the summary.
- Decision views, such as options compared against criteria, can come after the first version.
- Cross-topic links and a zoomable meta-canvas are later.
- Time, uniqueness, and specificity could someday drive which items fade.

## Current reality that matters

- The repo has no MCP server yet. Its only external ingest is the Apple Notes CLI, which uses a bearer-token REST endpoint (`docs/plan-cli.md`).
- The app already has LLM plumbing (`Prompt`, `PromptRun`, `LlmRequest`) that in-app summary drafting can use.
- The TipTap editor and `Doc` model can serve as the "card grows into a note" body.
- The canvas pan/zoom code (`canvas.store`, the Explorer group canvas) shows what's possible, but layout here has to come from structure, not embeddings.

## What still needs your input

Nothing blocks shaping. The biggest open risk is whether keeping open items visible inside folded groups stays readable. The first proof will answer that.

## Next step after confirmation

Brainstorm contrasting shapes, or go straight to shaping around the first proof (MCP ingest to canvas).
