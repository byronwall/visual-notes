# MCP parity matrix

Every user-facing server action and query (`= action(` / `= query(` under `src/services` and `src/features`), and the MCP tool that does the same job. "Human-only" means the connector deliberately leaves it out. The reference for the tools themselves is [mcp-connector.md](mcp-connector.md).

The rules that decide human-only:

- **Ownership.** Agents change the body, title, or path only of notes they created (`originalSource = "chatgpt"`).
- **Metadata is open.** Task status and dates, collection values, event decisions, and note `meta` can change on any record.
- **Deleting stays with the user**, everywhere. Agents cancel (tasks, shows), hide (undoably), or remove from a collection instead.
- **Review and layout stay with the user**: accepting research summaries, canvas and card positions, column widths, manual ordering, and calendar settings.
- **Not the agent's business**: login, OAuth consent, the in-app AI chat and prompts (they spend the user's model keys), embedding and UMAP runs, and admin migrations.

Keep this file current when adding an action or a tool. A new action is either covered, or listed here as human-only with its reason.

## Notes

| Action / query                                                                                                 | MCP                                                                 | Notes                                                            |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `createDoc`                                                                                                    | `notes_create`                                                      | Any path; `idempotencyKey`                                       |
| `saveDocContent`                                                                                               | `notes_update`, `notes_append`, `notes_edit_blocks`                 | Agent notes only                                                 |
| Pasting or dropping an image in the editor                                                                     | `notes_upload_image`, then a note write                             | Stored as a file rather than inline base64                       |
| `updateDoc`                                                                                                    | `notes_update` (title, path), `notes_set_meta` (meta)               | Title and path need ownership; meta doesn't                      |
| `deleteDoc`, `bulkDeleteDocs`, `deleteAllDocs`, `deleteBySource`                                               | human-only                                                          | Deletes                                                          |
| `bulkUpdateMeta`                                                                                               | `notes_set_meta`                                                    | Up to 50 notes per call                                          |
| `fetchMetaKeys`, `fetchMetaValues`                                                                             | `notes_list_meta_keys`                                              | Added in layer 6                                                 |
| `bulkSetSource`                                                                                                | human-only                                                          | Rewrites `originalSource`, which is what ownership is decided by |
| `processPathRound`, `cleanupTitles`, `cleanupTitlesDryRun`, `scanRelativeImages`                               | human-only                                                          | Bulk maintenance across notes the user wrote                     |
| `fetchDoc`, `fetchDocPreviews`, `fetchDocs` (both)                                                             | `notes_get`, `notes_query`                                          |                                                                  |
| `searchDocs`                                                                                                   | `search`                                                            | Same keyword search, fused with meaning-based matches            |
| `fetchPathStats`, `fetchPathPageData`, `fetchPathSuggestions`, `fetchPathDiscovery`, `fetchRelatedNotesByPath` | `notes_list_paths`, `notes_query` with `path`, `search` with `path` |                                                                  |
| `fetchSources`                                                                                                 | `notes_query` with `createdBy`                                      | Only the agent/user split matters to agents                      |
| `fetchDocContentVersion`, `fetchDocsServerNow`                                                                 | n/a                                                                 | Editor and index plumbing for live updates                       |
| `fetchDocRevisions`                                                                                            | `notes_list_revisions`                                              |                                                                  |
| `restoreDocRevision`                                                                                           | `notes_restore_revision`                                            | Agent notes only                                                 |
| `fetchRecentItems`                                                                                             | `notes_query`                                                       |                                                                  |
| `logRecentView`                                                                                                | human-only                                                          | The user's own viewing history                                   |
| `fetchJobStatus`                                                                                               | n/a                                                                 | Background job polling for the UI                                |

## Tags, links, and note tasks

| Action / query                                 | MCP                          | Notes                                     |
| ---------------------------------------------- | ---------------------------- | ----------------------------------------- |
| `fetchBacklinks`                               | `notes_get_backlinks`        |                                           |
| `fetchLinkTargets`, `fetchLinkLabel`           | `search`, `notes_get`        | Agents write `[[Label\|noteId]]` directly |
| `fetchTags`, `fetchTagNames`, `fetchTagBlocks` | `notes_list_tags`            |                                           |
| `fetchOpenNoteTasks`                           | `tasks_query` with `inNotes` |                                           |

## Shares

| Action / query                          | MCP        | Notes                              |
| --------------------------------------- | ---------- | ---------------------------------- |
| `upsertDocShare`, `deleteDocShare`      | human-only | Publishes a note on a public URL   |
| `fetchDocShare`, `fetchPublicSharedDoc` | human-only | Share settings and the public page |

## Note audio

| Action / query                                                        | MCP        | Notes                                                      |
| --------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| `startDocAudio`, `finishDocAudio`, `renameDocAudio`, `fetchDocAudios` | human-only | Recording runs in the browser; agents can't hear the audio |

## Research

| Action / query                                                                | MCP                                                                | Notes                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| `fetchResearchTopics`                                                         | `research_list_topics`                                             | `includeArchived`                                 |
| `fetchResearchTopicGraph`                                                     | `research_get_topic`, `research_get_card`, `research_list_batches` |                                                   |
| `createResearchTopic`                                                         | `research_create_topic`                                            |                                                   |
| `renameResearchTopic`, `setResearchTopicArchived`                             | `research_update_topic`                                            |                                                   |
| `editResearchCard`                                                            | `research_update_cards`                                            | Undoable batch                                    |
| `removeResearchCards`                                                         | `research_remove_cards`                                            | Hides cards as an undoable batch                  |
| `setResearchCardState`                                                        | `research_set_card_states`                                         |                                                   |
| `undoResearchBatch`, `redoResearchBatch`                                      | `research_undo_batch`, `research_redo_batch`                       |                                                   |
| (agent-only)                                                                  | `research_add_cards`                                               | Cards, links, and draft summaries arrive this way |
| `setResearchSummaryStatus`, `updateResearchSummary`, `discardResearchSummary` | human-only                                                         | Reviewing an agent's summary is the user's call   |
| `setResearchCardNudge`                                                        | human-only                                                         | The user's steering signal to the agent           |

## Tasks

| Action / query                        | MCP                 | Notes                                     |
| ------------------------------------- | ------------------- | ----------------------------------------- |
| `fetchTaskLists`, `fetchTaskListById` | `tasks_list_lists`  |                                           |
| `fetchTaskTree`                       | `tasks_query`       | Filters instead of a whole tree           |
| `createTask`                          | `tasks_create`      | Or a `- [ ]` line in a note               |
| `updateTask`                          | `tasks_update`      | Text of a task in a user note stays fixed |
| `moveTask`, `moveTaskToList`          | `tasks_move`        |                                           |
| `createTaskList`                      | `tasks_create_list` |                                           |
| `updateTaskList`                      | `tasks_rename_list` |                                           |
| `reorderTaskLists`                    | human-only          | Rail order is layout                      |
| `deleteTask`, `deleteTaskList`        | human-only          | Deletes; agents set `cancelled`           |

## Collections

| Action / query                                                    | MCP                                                       | Notes                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `fetchCollections`                                                | `collections_list`                                        |                                                   |
| `fetchCollectionBundle`                                           | `collections_get`, `collections_query`                    |                                                   |
| `fetchCollectionViewBundle`                                       | `collections_query` with `view`                           |                                                   |
| `fetchDocCollection`                                              | `notes_get`                                               | Reports `collectionId` and values                 |
| `fetchNoteSummaries`, `searchNotesForCollection`                  | `search`, `collections_query`                             |                                                   |
| `createCollection`, `updateCollection`                            | `collections_create`, `collections_update`                |                                                   |
| `createProperty`, `updateProperty`, `createSelectOption`          | `collections_add_property`, `collections_update_property` | Missing options are also created on write         |
| `createRow`                                                       | `collections_add_row`                                     | A new note the agent owns                         |
| `setRowProperties`                                                | `collections_set_values`                                  |                                                   |
| `setRowTitle`                                                     | `notes_update`                                            | Row title is the note title, so ownership applies |
| `addNotesToCollection`, `moveNoteToCollection`, `previewMoveNote` | `collections_add_notes`                                   | Moving carries values by name                     |
| `removeNoteFromCollection`, `removeRowsFromCollection`            | `collections_remove_notes`                                | Values are kept                                   |
| `createView`                                                      | `collections_create_view`                                 | Can host it in an agent note                      |
| `updateView`, `reorderViews`, `reorderProperties`, `moveRow`      | human-only                                                | Layout; agents create a new view instead          |
| `changePropertyKind`                                              | human-only                                                | Can drop values that don't convert                |
| `deleteCollection`, `deleteProperty`, `deleteRows`, `deleteView`  | human-only                                                | Deletes                                           |

## Time blocks

| Action / query                                                                                   | MCP                               | Notes   |
| ------------------------------------------------------------------------------------------------ | --------------------------------- | ------- |
| `fetchTimeBlocksForRange`, `fetchWeeklyTimeBlocks`, `fetchTimeBlockById`, `fetchTimeBlockCounts` | `time_blocks_query`               |         |
| `fetchTimeBlockBacklinks`                                                                        | `time_blocks_query` with `noteId` |         |
| `fetchTimeBlockDayMeta`, `fetchDateRangeTimeBlockMeta`, `fetchDateRangeTimeBlockMetaSummary`     | `time_blocks_query` (`dayValues`) |         |
| `createTimeBlock`, `duplicateTimeBlock`                                                          | `time_blocks_create`              |         |
| `updateTimeBlock`, `bulkUpdateTimeBlocks`                                                        | `time_blocks_update`              |         |
| `createTimeBlockDayMeta`, `updateTimeBlockDayMeta`                                               | `time_blocks_set_day_value`       |         |
| `deleteTimeBlock`, `deleteTimeBlocksByDateRange`, `deleteTimeBlockDayMeta`                       | human-only                        | Deletes |

## Events and places

| Action / query                                                                                                                                                               | MCP                              | Notes                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------- |
| `fetchOccurrences`, `fetchShowsView`, `fetchEventList`                                                                                                                       | `events_query`                   | One row per show                                          |
| `fetchNoteEvent`                                                                                                                                                             | `events_get`                     |                                                           |
| (agent-only)                                                                                                                                                                 | `events_find_duplicates`         | The dedupe check `events_create` runs                     |
| `saveNoteEvent`                                                                                                                                                              | `events_create`, `events_update` | Create also makes the note and can add it to a collection |
| `createOccurrences`, `createRepeatingOccurrences`                                                                                                                            | `events_add_shows`               |                                                           |
| `saveOccurrence`                                                                                                                                                             | `events_update_show`             | Including its decision                                    |
| `fetchPlaces`, `fetchPlace`, `fetchPlacesWithCounts`                                                                                                                         | `places_list`                    |                                                           |
| `addPlace`, `savePlace`                                                                                                                                                      | `places_upsert`                  | Dedupes by name and city                                  |
| `fetchFeeds`, `fetchEventFeeds`, `fetchFeedRuleOptions`                                                                                                                      | `events_list_feeds`              | Without subscribe tokens                                  |
| `removeNoteEvent`, `removeOccurrence`, `removePlace`                                                                                                                         | human-only                       | Deletes; a called-off show gets status cancelled          |
| `createCalendarFeed`, `saveCalendarFeed`, `removeCalendarFeed`, `rotateCalendarFeedToken`, `setCalendarFeedEntry`, `fetchFeedPreview`, `fetchFeedEntries`, `fetchFeedOrigin` | human-only                       | Feeds publish the calendar on a secret URL                |

## Web archive

| Action / query                                                                                                                                                                                                                                       | MCP                | Notes                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------ |
| `fetchArchivedPages`, `fetchArchivedPageGroups`, `fetchArchivedPageGroupSummaries`, `fetchArchivedPageTotals`                                                                                                                                        | `archive_query`    |                                                                          |
| `fetchArchivedPageDetail`, `lookupArchivedPageByUrl`                                                                                                                                                                                                 | `archive_get`      |                                                                          |
| `createArchivedPageNote`, `addArchivedPageNoteImage`                                                                                                                                                                                                 | `archive_add_note` |                                                                          |
| `updateArchivedPage`                                                                                                                                                                                                                                 | human-only         | Page title and group are the user's filing, like a note's title and path |
| `updateArchivedPageNote`, `updateArchivedPageNoteImage`                                                                                                                                                                                              | human-only         | Archive notes don't record who wrote them; agents add a new note         |
| `deleteArchivedPage`, `deleteArchivedPageNote`, `deleteArchivedPageNoteImage`                                                                                                                                                                        | human-only         | Deletes                                                                  |
| `fetchArchiveCanvasOverviewGroups`, `fetchArchiveGroupCanvasItems`, `createArchiveCanvasNode`, `updateArchiveCanvasNode`, `updateArchiveCanvasNodeState`, `deleteArchiveCanvasNode`, `saveArchiveGroupCanvasLayout`, `updateArchivedPageCanvasState` | human-only         | Canvas layout                                                            |
| `fetchArchiveAdminSnapshots`, `fetchArchiveAdminSnapshotDetail`                                                                                                                                                                                      | human-only         | Raw snapshot admin                                                       |

## Activity

| Action / query                                             | MCP                            | Notes                               |
| ---------------------------------------------------------- | ------------------------------ | ----------------------------------- |
| `fetchTimelineEvents`                                      | `activity_query`               |                                     |
| `fetchDocActivityHistory`                                  | `activity_query` with `noteId` | Added in layer 6                    |
| `fetchDocActivitySummary`, `recomputeDocActivitySnapshots` | human-only                     | View counters and their maintenance |
| `logDocViewEvent`, `logSearchResultOpened`                 | human-only                     | They record the user's own views    |

## AI chat and prompts

| Action / query                                                                                                                                | MCP        | Notes                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| `createChatThread`, `sendChatMessage`, `updateChatMessage`, `deleteChatMessage`, `updateChatThread`, `fetchChatThread`, `fetchChatThreads`    | human-only | The in-app chat; the connected agent is already a chat |
| `runPrompt`, `runPromptDesigner`, `fetchPromptRun`, `fetchPromptRuns`, `fetchAiModels`                                                        | human-only | Spend the user's model keys                            |
| `createPrompt`, `updatePrompt`, `revisePrompt`, `createPromptVersion`, `activatePromptVersion`, `deletePrompt`, `fetchPrompt`, `fetchPrompts` | human-only | Prompt library management                              |

## Embeddings and UMAP

| Action / query                                                                                                                                                                                                                                        | MCP        | Notes                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| `createEmbeddingRun`, `processEmbeddingRun`, `updateEmbeddingRun`, `deleteEmbeddingRun`, `fetchEmbeddingRun`, `fetchEmbeddingRuns`, `fetchDocSections`                                                                                                | human-only | Admin; `search` uses the newest run, and agent writes refresh it |
| `createUmapRun`, `projectUmapRun`, `updateUmapRun`, `deleteUmapRun`, `regenerateUmapRegionsAction`, `fetchUmapRun`, `fetchUmapRuns`, `fetchUmapPointsForRun`, `fetchUmapRegionDetail`, `fetchLatestUmapRun`, `fetchUmapPoints`, `fetchNearbyUmapDocs` | human-only | The map view; `search` covers "notes like this"                  |

## Admin and auth

| Action / query                                                                                                          | MCP        | Notes                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------- |
| `runBlockMigration`, `rebuildBlockIndex`, `fetchBlockMigrationCounts`                                                   | human-only | Storage migration                           |
| `runInlineImageMigrationBatch`, `runHeicToJpegBatch`, `recoverInlineImageMigrationBackup`, `fetchInlineImageMigration*` | human-only | Image migration                             |
| `magicLogin`, `magicLogout`, `fetchMagicSession`                                                                        | human-only | Login                                       |
| `decideOAuthConsent`, `fetchOAuthConsent`, `fetchOAuthConnections`, `revokeOAuthConnection`                             | human-only | Granting or revoking the agent's own access |
