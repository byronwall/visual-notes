import { prisma } from "~/server/db";
import { ensureInboxList } from "~/server/notes/inline-tasks";
import { noteMarkdown } from "~/server/notes/note-store";
import { createTask } from "~/server/tasks/task-store";
import { appendMarkdown } from "./apply";
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
  /** Null when the page didn't load or had no readable text. */
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

export async function expandLink(docId: string): Promise<LinkExpansion> {
  const note = await linkNote(docId);
  const { httpStatus, html, timedOut } = await fetchPage(note.url, PAGE_BYTES);
  const status = statusFor(httpStatus, timedOut);
  const title = html ? pageTitle(html) : null;
  const text = html ? pageText(html).slice(0, TEXT_CAP) : "";
  const base = { url: note.url, status, httpStatus, title };
  if (status !== "ok" || text.length < MIN_TEXT) {
    return { ...base, draft: null, worth: null };
  }
  const provider = resolveProvider();
  const [draft, worth] = await Promise.all([
    draftDistill({
      docId,
      title: title ?? note.title,
      markdown: text,
      focus: LINK_FOCUS,
    }),
    provider
      ? deciderFor(provider)({
          owner: OWNER_PROFILE,
          state: {
            note: { title: note.title, url: note.url },
            page: { title, text },
          },
          questions: LINK_QUESTIONS,
        }).then((r) => p(r.answers, "page_worth_keeping"))
      : Promise.resolve(null),
  ]);
  return { ...base, draft, worth };
}

/** Adds the summary under the link; the note stays where it is. */
export async function addLinkSummary(docId: string, markdown: string) {
  const when = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
