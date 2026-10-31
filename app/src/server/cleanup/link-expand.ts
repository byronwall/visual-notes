import { prisma } from "~/server/db";
import { ensureInboxList } from "~/server/notes/inline-tasks";
import { noteMarkdown } from "~/server/notes/note-store";
import { createTask } from "~/server/tasks/task-store";
import { MONTH_DAY_YEAR, appendMarkdown } from "./apply";
import { deciderFor, resolveProvider } from "./assess";
import { p } from "./buckets";
import { draftDistill, type DistillDraft } from "./distill";
import {
  fetchPage,
  linkOnlyUrl,
  pageText,
  pageTitle,
  statusFor,
  type LinkStatus,
} from "./link-check";
import { cleanBody } from "./note-state";
import { snoozeNote } from "./queue";
import { LINK_QUESTIONS, OWNER_PROFILE } from "./questions";

/**
 * Revisit a saved link: load the page again, summarize it, and ask whether
 * there is anything worth keeping. Runs only when the owner opens the card.
 */

export type LinkExpansion = {
  url: string;
  status: LinkStatus;
  httpStatus: number | null;
  title: string | null;
  /** The page loaded and has enough text to summarize. */
  readable: boolean;
  /** Null when not asked for, or when the page isn't readable. */
  draft: DistillDraft | null;
  /** P(the page holds something worth keeping); null without a decider. */
  worth: number | null;
};

const PAGE_BYTES = 600_000;
const TEXT_CAP = 20_000;
/** Less readable text than this is a login wall or a script-only app. */
const MIN_TEXT = 200;

export const LINK_FOCUS = `This is the text of a web page the owner saved a link to and meant to come back to. Say what the page is and what it offers him: the main ideas, and any specifics worth remembering (names, numbers, steps, prices, versions). Title it with what the page is, not the site name alone.`;

async function linkNote(docId: string) {
  const doc = await prisma.doc.findUnique({
    where: { id: docId },
    select: { title: true, markdown: true, html: true, content: true },
  });
  if (!doc) throw new Error("Not found");
  const url = linkOnlyUrl(cleanBody(noteMarkdown(doc)));
  if (!url) throw new Error("This note is not a saved link");
  return { title: doc.title, url };
}

/** The page check is free. `summarize` adds the calls that cost money. */
export async function expandLink(
  docId: string,
  summarize: boolean,
): Promise<LinkExpansion> {
  const note = await linkNote(docId);
  const { httpStatus, html, noHost } = await fetchPage(note.url, PAGE_BYTES);
  const status = statusFor(httpStatus, noHost);
  const title = html ? pageTitle(html) : null;
  const text = html ? pageText(html).slice(0, TEXT_CAP) : "";
  const readable = status === "ok" && text.length >= MIN_TEXT;
  const base = { url: note.url, status, httpStatus, title, readable };
  if (!readable || !summarize) return { ...base, draft: null, worth: null };
  const provider = resolveProvider();
  const [draft, worth] = await Promise.all([
    draftDistill({
      docId,
      title: title ?? note.title,
      markdown: text,
      focus: LINK_FOCUS,
      trigger: "cleanup:link",
    }),
    provider
      ? deciderFor(provider, "cleanup:link")({
          owner: OWNER_PROFILE,
          state: {
            note: { title: note.title, url: note.url },
            page: { title, text },
          },
          questions: LINK_QUESTIONS,
          noteId: docId,
          kind: "worth",
        }).then((r) => p(r.answers, "page_worth_keeping"))
      : Promise.resolve(null),
  ]);
  return { ...base, draft, worth };
}

/** Adds the summary under the link; the note stays where it is. */
export async function addLinkSummary(docId: string, markdown: string) {
  const when = new Date().toLocaleDateString("en-US", MONTH_DAY_YEAR);
  await appendMarkdown(
    docId,
    `## Summary\n\n${markdown.trim()}\n\n_Summarized from the link on ${when}._`,
  );
  await prisma.noteAssessment.updateMany({
    where: { docId },
    data: { decision: "done", decidedAt: new Date() },
  });
}

/** An Inbox task to go look at the link; the card comes back in 30 days. */
export async function remindLink(docId: string) {
  const note = await linkNote(docId);
  await createTask({
    listId: await ensureInboxList(),
    description: `Check out ${note.title.trim() || note.url}: ${note.url}`,
    meta: { cleanupFrom: note.title, url: note.url, noteId: docId },
  });
  await snoozeNote(docId);
}
