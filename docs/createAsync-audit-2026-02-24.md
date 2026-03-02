# createAsync Audit (2026-02-24)

## Scope

- Runtime code scanned: `app/src/**`
- Repo-wide text scan also included docs/notes references.
- Pattern: `createAsync(`

## Totals

- `app/src` runtime callsites: **44** across **30 files**
- Repo-wide matches (including docs/skills docs): **54**
- Runtime callsites currently using `.latest` directly on those `createAsync` resources: **0**

## Risk Model (null blip impact)

- **Low**: gated by `Suspense` fallback, or data is non-critical/secondary UI.
- **Medium**: resource is consumed as `resource() || []` / `resource() ?? []`; likely transient empty state/flicker.
- **High**: auth/session or primary page data branches directly on `undefined`, or likely layout/content jump on refetch.

## Runtime Inventory (app/src)

- `app/src/components/DocActivitySummaryPopover.tsx:77`
  - Resource: `history`
  - Data: `fetchDocActivityHistory(docId)` activity entries
  - Consumption: wrapped in `Suspense` with loading placeholder
  - Null blip impact: **Low**

- `app/src/components/MetaKeySuggestions.tsx:13`
  - Resource: `keySuggestions`
  - Data: `fetchMetaKeys()` key frequency list
  - Consumption: `Array.isArray(keySuggestions()) ? ... : []`
  - Null blip impact: **Medium** (chips can momentarily disappear)

- `app/src/components/MetaValueSuggestions.tsx:14`
  - Resource: `valueSuggestions`
  - Data: `fetchMetaValues(key)` value frequency list
  - Consumption: `Array.isArray(valueSuggestions()) ? ... : []`
  - Null blip impact: **Medium**

- `app/src/components/ModelSelect.tsx:14`
  - Resource: `models`
  - Data: `fetchAiModels()` model id list
  - Consumption: `models()?.items || []` with `Suspense` fallback
  - Null blip impact: **Low-Medium** (select can flicker to loading)

- `app/src/components/PathEditor.tsx:37`
  - Resource: `pathCounts`
  - Data: `fetchPathSuggestions()` path counts
  - Consumption: `pathCounts() || []` in suggestions memo
  - Null blip impact: **Medium** (autocomplete can clear/repopulate)

- `app/src/components/PathRelatedNotesPopover.tsx:27`
  - Resource: `related`
  - Data: `fetchRelatedNotesByPath({ path, currentDocId, take })`
  - Consumption: `related()?.notes || []` with `Show` fallback
  - Null blip impact: **Medium** ("no related notes" flash possible)

- `app/src/components/ai/LLMSidebar.tsx:53`
  - Resource: `threads`
  - Data: `fetchChatThreads()` chat thread list
  - Consumption: `threads() || []` passed to list
  - Null blip impact: **Medium**

- `app/src/components/ai/LLMSidebar.tsx:54`
  - Resource: `thread`
  - Data: `fetchChatThread(selectedId)` selected thread detail
  - Consumption: conditional null when no selection
  - Null blip impact: **Medium**

- `app/src/components/editor/ui/AIPromptsMenu.tsx:34`
  - Resource: `prompts`
  - Data: `fetchPrompts()` prompt list
  - Consumption: `prompts() || []` with menu fallback items
  - Null blip impact: **Medium**

- `app/src/components/editor/ui/AiPromptModal.tsx:36`
  - Resource: `models`
  - Data: `fetchAiModels()` model id list
  - Consumption: `models()?.items || []` in select items
  - Null blip impact: **Medium**

- `app/src/components/editor/ui/PromptsManagerModal.tsx:29`
  - Resource: `prompts`
  - Data: `fetchPrompts()` prompt list
  - Consumption: `prompts() || []` with `Suspense`
  - Null blip impact: **Medium**

- `app/src/components/sidebar/AppSidebarRecentDocs.tsx:32`
  - Resource: `items`
  - Data: `fetchDocs({ sortMode: 'relevance', take: 10 })`
  - Consumption: `items() || []` for list and preview ids
  - Null blip impact: **Medium** (sidebar recent list blip)

- `app/src/components/time-blocks/TimeBlockBacklinks.tsx:16`
  - Resource: `blocks`
  - Data: `fetchTimeBlockBacklinks({ noteId, take })`
  - Consumption: `blocks() || []` with empty fallback text
  - Null blip impact: **Medium**

- `app/src/components/time-blocks/TimeBlockMetadataSummaryDialog.tsx:73`
  - Resource: `entries`
  - Data: `fetchDateRangeTimeBlockMeta({ startIso, endIso })`
  - Consumption: `entries() || []` with empty-state fallback
  - Null blip impact: **Medium**

- `app/src/components/time-blocks/TimeBlocksListDialog.tsx:36`
  - Resource: `blocks`
  - Data: `fetchWeeklyTimeBlocks({ weekStartIso, numberOfDays })`
  - Consumption: `blocks() || []` in grouped map with empty fallback
  - Null blip impact: **Medium**

- `app/src/features/docs-index/components/DocsIndexPage.tsx:49`
  - Resource: `docs`
  - Data: `fetchDocs(query args)` paged doc list
  - Consumption: `docs() || []` for main table/list
  - Null blip impact: **Medium-High** (primary content can flash empty)

- `app/src/features/docs-index/components/DocsIndexPage.tsx:50`
  - Resource: `docsServerNow`
  - Data: `fetchDocsServerNow()` server timestamp
  - Consumption: ancillary value in header/filter context
  - Null blip impact: **Low**

- `app/src/features/docs-index/components/DocsIndexPage.tsx:51`
  - Resource: `sources`
  - Data: `fetchSources()` source facet list
  - Consumption: `sources()?.sources ?? []`
  - Null blip impact: **Medium**

- `app/src/features/docs-index/components/DocsIndexPage.tsx:52`
  - Resource: `pathDiscovery`
  - Data: `fetchPathDiscovery()` path discovery metadata
  - Consumption: filter/sidebar support UI
  - Null blip impact: **Medium**

- `app/src/features/docs-index/components/PathTreeSidebar.tsx:89`
  - Resource: `pathCounts`
  - Data: `fetchPathSuggestions()` path counts
  - Consumption: `(pathCounts() || [])` then tree build
  - Null blip impact: **Medium** (tree can collapse/rebuild)

- `app/src/features/docs-index/hooks/useDocPreviewMap.ts:6`
  - Resource: `docs`
  - Data: `fetchDocPreviews(ids)` preview payloads
  - Consumption: `docs() || []` converted to `Map`
  - Null blip impact: **Medium** (preview text/metadata can blank briefly)

- `app/src/hooks/useMagicAuth.tsx:16`
  - Resource: `session`
  - Data: `fetchMagicSession()` `{ authed, ... }` payload
  - Consumption: `loading: session() === undefined`; `authed` from `session()?.authed`
  - Null blip impact: **High** (auth/loading branch blips likely)

- `app/src/routes/activity.tsx:121`
  - Resource: `events`
  - Data: `fetchTimelineEvents(filters)` timeline list
  - Consumption: primary route data resource
  - Null blip impact: **Medium-High**

- `app/src/routes/admin/migrations.tsx:94`
  - Resource: `countsStatus`
  - Data: `fetchInlineImageMigrationCounts()`
  - Consumption: suspense-gated admin status block
  - Null blip impact: **Low**

- `app/src/routes/admin/migrations.tsx:95`
  - Resource: `recentBackups`
  - Data: `fetchInlineImageMigrationRecentBackups()`
  - Consumption: suspense-gated admin status block
  - Null blip impact: **Low**

- `app/src/routes/admin/migrations.tsx:96`
  - Resource: `imageStorageStatus`
  - Data: `fetchInlineImageMigrationImageStorage()`
  - Consumption: suspense-gated admin status block
  - Null blip impact: **Low**

- `app/src/routes/ai/index.tsx:99`
  - Resource: `prompts`
  - Data: `fetchPrompts()` prompt catalog
  - Consumption: `prompts() || []` for metrics/tables
  - Null blip impact: **Medium**

- `app/src/routes/ai/index.tsx:100`
  - Resource: `runs`
  - Data: `fetchPromptRuns({ limit: 100 })` run list
  - Consumption: `runs() || []` for metrics/filtering/tables
  - Null blip impact: **Medium**

- `app/src/routes/ai/prompts/[id].tsx:86`
  - Resource: `prompt`
  - Data: `fetchPrompt(id)` prompt detail
  - Consumption: direct branches/effects on `prompt()`
  - Null blip impact: **Medium-High**

- `app/src/routes/ai/prompts/[id].tsx:90`
  - Resource: `runs`
  - Data: `fetchPromptRuns({ promptId: id })` run history
  - Consumption: list/detail UI derived from `runs()`
  - Null blip impact: **Medium**

- `app/src/routes/ai/runs/[id].tsx:63`
  - Resource: `run`
  - Data: `fetchPromptRun(id)` run detail
  - Consumption: suspense + detail fallback
  - Null blip impact: **Low-Medium**

- `app/src/routes/embeddings/[id].tsx:54`
  - Resource: `run`
  - Data: `fetchEmbeddingRun({ id, includeDocs, limit, offset })`
  - Consumption: detail route + side-panel state seeded from run
  - Null blip impact: **Medium-High**

- `app/src/routes/embeddings/index.tsx:58`
  - Resource: `runs`
  - Data: `fetchEmbeddingRuns()` embedding run list
  - Consumption: list/table route data
  - Null blip impact: **Medium**

- `app/src/routes/path/[...segments].tsx:35`
  - Resource: `data`
  - Data: `fetchPathPageData({ path })` notes + child paths
  - Consumption: primary route content; `data()?.notes || []`
  - Null blip impact: **Medium-High**

- `app/src/routes/path/[...segments].tsx:43`
  - Resource: `previewDocs`
  - Data: `fetchDocPreviews(ids)` for visible notes
  - Consumption: map built from `previewDocs() || []`
  - Null blip impact: **Medium**

- `app/src/routes/path/index.tsx:19`
  - Resource: `paths`
  - Data: `fetchPathSuggestions()`
  - Consumption: `(paths() || [])` filtering/grouping
  - Null blip impact: **Medium**

- `app/src/routes/path/index.tsx:20`
  - Resource: `discovery`
  - Data: `fetchPathDiscovery()` recently viewed data
  - Consumption: `(discovery()?.recentlyViewed || [])`
  - Null blip impact: **Medium**

- `app/src/routes/umap/[id].tsx:37`
  - Resource: `meta`
  - Data: `fetchUmapRun(id)` run metadata
  - Consumption: detail route metadata/summary
  - Null blip impact: **Medium**

- `app/src/routes/umap/[id].tsx:41`
  - Resource: `data`
  - Data: `fetchUmapPointsForRun(id)` plotted points
  - Consumption: visualization dataset
  - Null blip impact: **Medium-High** (plot can blank/repaint)

- `app/src/routes/umap/index.tsx:77`
  - Resource: `runs`
  - Data: `fetchUmapRuns()` run list
  - Consumption: table/list + derived options
  - Null blip impact: **Medium**

- `app/src/routes/umap/index.tsx:78`
  - Resource: `embeddingRuns`
  - Data: `fetchEmbeddingRuns()` options for creation form
  - Consumption: select/options data
  - Null blip impact: **Medium**

- `app/src/services/docs.resources.ts:11`
  - Resource: return value
  - Data: `fetchDocs()` docs list helper
  - Consumption: shared helper; impact depends on callers
  - Null blip impact: **Medium** (call-site dependent)

- `app/src/services/docs.resources.ts:15`
  - Resource: return value
  - Data: `fetchLatestUmapRun()` latest run helper
  - Consumption: shared helper
  - Null blip impact: **Medium**

- `app/src/services/docs.resources.ts:19`
  - Resource: return value
  - Data: `fetchUmapPoints(runId)` helper with `[]` when no id
  - Consumption: shared helper
  - Null blip impact: **Medium**

## Non-runtime references (docs/guidance)

These are text docs discussing/illustrating `createAsync` usage and may now conflict with the new preference for `createResource` + `.latest` in no-bump UIs:

- `client-server-comms.md`
- `docs/note-activity-history-ui-work-summary-2026-02-12.md`
- `docs/data-tables/data-tables-prd.md`
- `docs/action-intelligence-notes-index-implementation-retrospective.md`
- `.agents/skills/solidstart-data-async/SKILL.md`

## Highest-priority null-blip candidates

1. `app/src/hooks/useMagicAuth.tsx` (`session`): auth/loading can transiently flip.
2. `app/src/features/docs-index/components/DocsIndexPage.tsx` (`docs`): primary content list can clear/repaint during refresh.
3. `app/src/routes/path/[...segments].tsx` (`data`): path page note list is primary route content.
4. `app/src/routes/embeddings/[id].tsx` (`run`) and `app/src/routes/umap/[id].tsx` (`data`): visualization/detail payloads can blank and repopulate.
5. time-block dialogs/lists (`TimeBlocksListDialog`, `TimeBlockMetadataSummaryDialog`, `TimeBlockBacklinks`): noticeable empty-state flashes during edits/revalidation.

## Migration guidance from this audit

- For UIs that should remain visually stable through refetch, prefer preserving prior value (`resource.latest`) in rendering code.
- Keep explicit loading transitions only where a visible "loading bump" is desired.
- Routes/components above marked Medium-High/High are best first targets.
