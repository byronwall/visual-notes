# MCP parity matrix

Every user-facing server action and query (`= action(` / `= query(` under `src/services` and `src/features`), and the MCP tool that does the same job. "Human-only" means the connector deliberately leaves it out. The reference for the tools themselves is [mcp-connector.md](mcp-connector.md).

The rules that decide human-only:

- **Ownership.** Agents change the body, title, or path only of notes they created (`originalSource = "chatgpt"`).
- **Metadata is open.** Task status and dates, collection values, and note `meta` can change on any record.
- **Deleting stays with the user**, everywhere. Agents cancel, hide (undoably), or remove from a collection instead.
- **Review and layout stay with the user**: accepting research summaries, canvas and card positions, column widths, manual ordering, and calendar settings.
- **Not the agent's business**: login, OAuth consent, the in-app AI chat and prompts (they spend the user's model keys), embedding and UMAP runs, and admin migrations.

Keep this file current when adding an action or a tool. A new action is either covered, or listed here as human-only with its reason.

## Notes

| Action / query | MCP | Notes |
| --- | --- | --- |
| `createDoc` | `create_note` | Any path; `idempotencyKey` |
| `saveDocContent` | `update_note`, `append_to_note`, `edit_note` | Agent notes only |
| `updateDoc` | `update_note` (title, path), `set_note_meta` (meta) | Title and path need ownership; meta doesn't |
| `deleteDoc`, `bulkDeleteDocs`, `deleteAllDocs`, `deleteBySource` | human-only | Deletes |
| `bulkUpdateMeta` | `set_note_meta` | Up to 50 notes per call |
| `fetchMetaKeys`, `fetchMetaValues` | `list_meta_keys` | Added in layer 6 |
| `bulkSetSource` | human-only | Rewrites `originalSource`, which is what ownership is decided by |
| `processPathRound`, `cleanupTitles`, `cleanupTitlesDryRun`, `scanRelativeImages` | human-only | Bulk maintenance across notes the user wrote |
| `fetchDoc`, `fetchDocPreviews`, `fetchDocs` (both) | `get_notes`, `list_recent` | |
| `searchDocs` | `search` | Same keyword search, fused with meaning-based matches |
| `fetchPathStats`, `fetchPathPageData`, `fetchPathSuggestions`, `fetchPathDiscovery`, `fetchRelatedNotesByPath` | `list_paths`, `list_recent` with `path`, `search` with `path` | |
| `fetchSources` | `list_recent` with `createdBy` | Only the chatgpt/any split matters to agents |
| `fetchDocContentVersion`, `fetchDocsServerNow` | n/a | Editor and index plumbing for live updates |
| `fetchDocRevisions` | `list_revisions` | |
| `restoreDocRevision` | `restore_revision` | Agent notes only |
| `fetchRecentItems` | `list_recent` | |
| `logRecentView` | human-only | The user's own viewing history |
| `fetchJobStatus` | n/a | Background job polling for the UI |

## Tags, links, and note tasks

| Action / query | MCP | Notes |
| --- | --- | --- |
| `fetchBacklinks` | `get_backlinks` | |
| `fetchLinkTargets`, `fetchLinkLabel` | `search`, `get_notes` | Agents write `[[Label\|noteId]]` directly |
| `fetchTags`, `fetchTagNames`, `fetchTagBlocks` | `list_tags` | |
| `fetchOpenNoteTasks` | `list_note_tasks` | |

## Shares

| Action / query | MCP | Notes |
| --- | --- | --- |
| `upsertDocShare`, `deleteDocShare` | human-only | Publishes a note on a public URL |
| `fetchDocShare`, `fetchPublicSharedDoc` | human-only | Share settings and the public page |

## Note audio

| Action / query | MCP | Notes |
| --- | --- | --- |
| `startDocAudio`, `finishDocAudio`, `renameDocAudio`, `fetchDocAudios` | human-only | Recording runs in the browser; agents can't hear the audio |

## Research

| Action / query | MCP | Notes |
| --- | --- | --- |
| `fetchResearchTopics` | `research_list_topics` | `includeArchived` |
| `fetchResearchTopicGraph` | `research_read_topic`, `research_list_frontier`, `research_get_card`, `research_list_batches` | |
| `createResearchTopic` | `research_create_topic` | |
| `renameResearchTopic`, `setResearchTopicArchived` | `research_update_topic` | |
| `editResearchCard` | `research_update_cards` | Undoable batch |
| `removeResearchCards` | `research_remove_cards` | Hides cards as an undoable batch |
| `setResearchCardState` | `research_set_state` | |
| `undoResearchBatch`, `redoResearchBatch` | `research_undo_batch`, `research_redo_batch` | |
| (agent-only) | `research_ingest_tree`, `research_add_card`, `research_link_cards` | Cards and draft summaries arrive this way |
| `setResearchSummaryStatus`, `updateResearchSummary`, `discardResearchSummary` | human-only | Reviewing an agent's summary is the user's call |
| `setResearchCardNudge` | human-only | The user's steering signal to the agent |

## Tasks

| Action / query | MCP | Notes |
| --- | --- | --- |
| `fetchTaskLists`, `fetchTaskListById` | `tasks_list_lists` | |
| `fetchTaskTree` | `tasks_query` | Filters instead of a whole tree |
| `createTask` | `tasks_create` | Or a `- [ ]` line in a note |
| `updateTask` | `tasks_update` | Text of a task in a user note stays fixed |
| `moveTask`, `moveTaskToList` | `tasks_move` | |
| `createTaskList` | `tasks_create_list` | |
| `updateTaskList` | `tasks_rename_list` | |
| `reorderTaskLists` | human-only | Rail order is layout |
| `deleteTask`, `deleteTaskList` | human-only | Deletes; agents set `cancelled` |

## Collections

| Action / query | MCP | Notes |
| --- | --- | --- |
| `fetchCollections` | `collections_list` | |
| `fetchCollectionBundle` | `collections_get`, `collections_query` | |
| `fetchCollectionViewBundle` | `collections_query` with `view` | |
| `fetchDocCollection` | `get_notes` | Reports `collectionId` and values |
| `fetchNoteSummaries`, `searchNotesForCollection` | `search`, `collections_query` | |
| `createCollection`, `updateCollection` | `collections_create`, `collections_update` | |
| `createProperty`, `updateProperty`, `createSelectOption` | `collections_add_property`, `collections_update_property` | Missing options are also created on write |
| `createRow` | `collections_add_row` | A new note the agent owns |
| `setRowProperties` | `collections_set_properties` | |
| `setRowTitle` | `update_note` | Row title is the note title, so ownership applies |
| `addNotesToCollection`, `moveNoteToCollection`, `previewMoveNote` | `collections_add_notes` | Moving carries values by name |
| `removeNoteFromCollection`, `removeRowsFromCollection` | `collections_remove_notes` | Values are kept |
| `createView` | `collections_create_view` | Can host it in an agent note |
| `updateView`, `reorderViews`, `reorderProperties`, `moveRow` | human-only | Layout; agents create a new view instead |
| `changePropertyKind` | human-only | Can drop values that don't convert |
| `deleteCollection`, `deleteProperty`, `deleteRows`, `deleteView` | human-only | Deletes |

## Time blocks

| Action / query | MCP | Notes |
| --- | --- | --- |
| `fetchTimeBlocksForRange`, `fetchWeeklyTimeBlocks`, `fetchTimeBlockById`, `fetchTimeBlockCounts` | `time_blocks_list` | |
| `fetchTimeBlockBacklinks` | `time_blocks_list` with `noteId` | |
| `fetchTimeBlockDayMeta`, `fetchDateRangeTimeBlockMeta`, `fetchDateRangeTimeBlockMetaSummary` | `time_blocks_list` (`dayValues`) | |
| `createTimeBlock`, `duplicateTimeBlock` | `time_blocks_create` | |
| `updateTimeBlock`, `bulkUpdateTimeBlocks` | `time_blocks_update` | |
| `createTimeBlockDayMeta`, `updateTimeBlockDayMeta` | `time_blocks_set_day_value` | |
| `deleteTimeBlock`, `deleteTimeBlocksByDateRange`, `deleteTimeBlockDayMeta` | human-only | Deletes |

## Web archive

| Action / query | MCP | Notes |
| --- | --- | --- |
| `fetchArchivedPages`, `fetchArchivedPageGroups`, `fetchArchivedPageGroupSummaries`, `fetchArchivedPageTotals` | `archive_search` | |
| `fetchArchivedPageDetail`, `lookupArchivedPageByUrl` | `archive_get` | |
| `createArchivedPageNote`, `addArchivedPageNoteImage` | `archive_add_note` | |
| `updateArchivedPage` | human-only | Page title and group are the user's filing, like a note's title and path |
| `updateArchivedPageNote`, `updateArchivedPageNoteImage` | human-only | Archive notes don't record who wrote them; agents add a new note |
| `deleteArchivedPage`, `deleteArchivedPageNote`, `deleteArchivedPageNoteImage` | human-only | Deletes |
| `fetchArchiveCanvasOverviewGroups`, `fetchArchiveGroupCanvasItems`, `createArchiveCanvasNode`, `updateArchiveCanvasNode`, `updateArchiveCanvasNodeState`, `deleteArchiveCanvasNode`, `saveArchiveGroupCanvasLayout`, `updateArchivedPageCanvasState` | human-only | Canvas layout |
| `fetchArchiveAdminSnapshots`, `fetchArchiveAdminSnapshotDetail` | human-only | Raw snapshot admin |

## Activity

| Action / query | MCP | Notes |
| --- | --- | --- |
| `fetchTimelineEvents` | `activity_recent` | |
| `fetchDocActivityHistory` | `activity_recent` with `noteId` | Added in layer 6 |
| `fetchDocActivitySummary`, `recomputeDocActivitySnapshots` | human-only | View counters and their maintenance |
| `logDocViewEvent`, `logSearchResultOpened` | human-only | They record the user's own views |

## AI chat and prompts

| Action / query | MCP | Notes |
| --- | --- | --- |
| `createChatThread`, `sendChatMessage`, `updateChatMessage`, `deleteChatMessage`, `updateChatThread`, `fetchChatThread`, `fetchChatThreads` | human-only | The in-app chat; the connected agent is already a chat |
| `runPrompt`, `runPromptDesigner`, `fetchPromptRun`, `fetchPromptRuns`, `fetchAiModels` | human-only | Spend the user's model keys |
| `createPrompt`, `updatePrompt`, `revisePrompt`, `createPromptVersion`, `activatePromptVersion`, `deletePrompt`, `fetchPrompt`, `fetchPrompts` | human-only | Prompt library management |

## Embeddings and UMAP

| Action / query | MCP | Notes |
| --- | --- | --- |
| `createEmbeddingRun`, `processEmbeddingRun`, `updateEmbeddingRun`, `deleteEmbeddingRun`, `fetchEmbeddingRun`, `fetchEmbeddingRuns`, `fetchDocSections` | human-only | Admin; `search` uses the newest run, and agent writes refresh it |
| `createUmapRun`, `projectUmapRun`, `updateUmapRun`, `deleteUmapRun`, `regenerateUmapRegionsAction`, `fetchUmapRun`, `fetchUmapRuns`, `fetchUmapPointsForRun`, `fetchUmapRegionDetail`, `fetchLatestUmapRun`, `fetchUmapPoints`, `fetchNearbyUmapDocs` | human-only | The map view; `search` covers "notes like this" |

## Admin and auth

| Action / query | MCP | Notes |
| --- | --- | --- |
| `runBlockMigration`, `rebuildBlockIndex`, `fetchBlockMigrationCounts` | human-only | Storage migration |
| `runInlineImageMigrationBatch`, `runHeicToJpegBatch`, `recoverInlineImageMigrationBackup`, `fetchInlineImageMigration*` | human-only | Image migration |
| `magicLogin`, `magicLogout`, `fetchMagicSession` | human-only | Login |
| `decideOAuthConsent`, `fetchOAuthConsent`, `fetchOAuthConnections`, `revokeOAuthConnection` | human-only | Granting or revoking the agent's own access |
