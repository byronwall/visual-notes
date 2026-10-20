import { query } from "@solidjs/router";
import {
  listOpenNoteTasks,
  listTagBlocks,
  listTags,
  searchTagNames,
} from "~/server/notes/note-views";

export type {
  NoteGroup,
  NoteTask,
  TaggedBlock,
  TagSummary,
} from "~/server/notes/note-views";

export const fetchTags = query(async () => {
  "use server";
  return listTags();
}, "note-tags");

export const fetchTagBlocks = query(async (tag: string) => {
  "use server";
  return listTagBlocks(tag);
}, "note-tag-blocks");

export const fetchOpenNoteTasks = query(async () => {
  "use server";
  return listOpenNoteTasks();
}, "note-open-tasks");

export const fetchTagNames = query(async (prefix: string) => {
  "use server";
  return searchTagNames(prefix);
}, "note-tag-names");
