import { query } from "@solidjs/router";
import {
  listBacklinks,
  searchLinkTargets,
  type Backlink,
  type LinkTarget,
} from "~/server/notes/note-links";

export type { Backlink, LinkTarget };

export const fetchBacklinks = query(async (docId: string) => {
  "use server";
  return listBacklinks(docId);
}, "note-backlinks");

export const fetchLinkTargets = query(
  async (input: { query: string; excludeDocId?: string }) => {
    "use server";
    return searchLinkTargets(input.query, input.excludeDocId);
  },
  "note-link-targets",
);

/** Current label for one link target (used after pasting a note URL). */
export const fetchLinkLabel = query(
  async (input: { docId: string; blockId?: string | null }) => {
    "use server";
    const { resolveNoteLinks } = await import("~/server/notes/note-links");
    const resolved = await resolveNoteLinks({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "noteLink",
              attrs: { docId: input.docId, blockId: input.blockId ?? null, label: "" },
            },
          ],
        },
      ],
    });
    const attrs = resolved.content?.[0]?.content?.[0]?.attrs ?? {};
    return { label: String(attrs.label ?? ""), missing: Boolean(attrs.missing) };
  },
  "note-link-label",
);
