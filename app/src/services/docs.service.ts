export type MetaRecord = Record<string, string | number | boolean | null>;

export {
  fetchDoc,
  fetchDocPreviews,
  fetchDocPreviewsBatched,
  fetchDocs,
  fetchMetaKeys,
  fetchMetaValues,
  fetchPathDiscovery,
  fetchPathPageData,
  fetchPathStats,
  fetchPathSuggestions,
  fetchRelatedNotesByPath,
} from "./docs.queries";

export {
  createDoc,
  deleteDoc,
  saveDocContent,
  updateDoc,
} from "./docs.actions";

export type { PathStat } from "./docs.queries";
