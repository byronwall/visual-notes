# Note cleanup

Cleanup suggests what to do with notes that have stopped earning their place: distill a copied answer, regroup related notes, summarize an event that has passed, turn a note into a task, or delete it. Every action waits for a click. The design and experiment behind it are in [docs/intent/notes-cleanup-decisions](../../docs/intent/notes-cleanup-decisions/ux-decisions.md).

## Assessment

`server/cleanup/` asks a decision model a fixed set of yes/no and choice questions about each note, then picks a bucket in code.

| File                  | Role                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `questions.ts`        | The question set, the owner profile, and `QUESTION_SET_VERSION`                                                                                   |
| `note-state.ts`       | Facts code knows for sure: source (ChatGPT transcript, Notion import, agent, user), word count, latest date in the body and whether it has passed |
| `decide.ts`           | `decide()` adapters for Jev and OpenAI Decisions, normalized to `{p}` / `{choice, probs}` / `{label, probs}`                                      |
| `heuristic.ts`        | Rule-based answers for runs without a vendor key (local, audit databases). Results carry the `heuristic-v1` model name                            |
| `buckets.ts`          | Combines answers into `distill`, `post_event`, `make_task`, `delete`, or `keep`, with the probability the queue sorts on                          |
| `assess.ts`           | Finds stale notes, asks the questions, and upserts `NoteAssessment`                                                                               |
| `assessment-sweep.ts` | One pass after boot, every six hours, and a minute after any content write                                                                        |

A note is stale when it has no assessment, its `contentVersion` changed, or `QUESTION_SET_VERSION` changed. Collection rows, events, and places are never assessed.

### Provider

| `CLEANUP_DECIDER` | Behavior                                              |
| ----------------- | ----------------------------------------------------- |
| unset             | Jev when `TYPESAFE_API_KEY` is set, otherwise off     |
| `jev`             | Jev (`jev-1.14.0`)                                    |
| `openai`          | OpenAI Decisions (`gpt-6-luna`) with `OPENAI_API_KEY` |
| `heuristic`       | Local rules only, no network                          |
| `off`             | No assessment                                         |

Jev costs about $0.11 per 1,000 notes for this question set and answers in ~0.2 s. Rewording a question is a code change: bump `QUESTION_SET_VERSION` and every note is re-asked on the next sweep.

## Archive

Every cleanup action archives the original instead of deleting it (`server/notes/note-archive.ts`).

- `Doc.archivedAt`, `archivedIntoId` (where the content went), and `archiveReason`.
- Archived notes are hidden from the docs index and search, the path tree, Recent, the canvas map, the `[[` link picker, collection pickers, and MCP `search` / `notes_query` / `notes_list_paths`. Opening one by id still works and shows a banner with Restore and a link to where its content went. A new list or search over `Doc` should filter `archivedAt: null` too.
- Links to an archived note resolve to `archivedInto` at read time (`resolveNoteLinks` → `resolveArchiveRedirect` in `archive-window.ts`).
- `/docs/archived` lists the archive, soonest deletion first, with Restore.
- `startArchivePurge` (boot plus every six hours) deletes notes archived more than 30 days ago. Each one leaves a `DocTombstone` with the title and redirect, and notes that pointed into it are re-pointed to where its content went. Opening a deleted note's id follows the tombstone.

To seed an audit database with cleanup archetypes, assessments (heuristic), and three archived notes: `pnpm audit:db -- --owner <slug> --seed-cleanup`.
