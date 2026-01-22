export type MetaRecord = Record<string, string | number | boolean | null>;

export {
  fetchDoc,
  fetchDocs,
  fetchMetaKeys,
  fetchMetaValues,
  fetchPathSuggestions,
} from "./docs.queries";

export { createDoc, deleteDoc, updateDoc } from "./docs.actions";
