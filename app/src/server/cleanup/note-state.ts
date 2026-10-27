import { linkOnlyUrl, type LinkCheck } from "./link-check";

/**
 * Builds the decision state for one note. Anything code can know for sure
 * (source, dates, counts, whether a date has passed) is computed here and sent
 * as a fact, so the model only judges what code can't.
 */

export type NoteSource =
  | "chatgpt_transcript"
  | "notion_import"
  | "agent"
  | "user";

export type NoteFacts = {
  source: NoteSource;
  path: string;
  created: string;
  words: number;
  headings: number;
  links: number;
  views30d: number;
  latestDateInBody: string | null;
  latestDateIsPast: boolean | null;
  truncated: boolean;
  /** The link when the note is only a saved link (a breadcrumb), else null. */
  linkUrl: string | null;
  /** Whether `linkUrl` still loads; filled in by the sweep before asking. */
  link?: LinkCheck;
};

export type NoteStateInput = {
  title: string;
  path: string | null;
  createdAt: Date;
  markdown: string;
  originalSource: string | null;
  createdByAgent: boolean;
  views30d: number;
};

export type NoteState = {
  facts: NoteFacts;
  note: { title: string; body: string };
};

/** ~5k tokens; longer notes send the head and tail with a marker. */
const BODY_CAP = 20_000;
const HEAD = 15_000;
const TAIL = 5_000;

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const MONTH =
  "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?";

const DATE_PATTERNS: Array<
  [RegExp, (m: RegExpExecArray) => [number, number, number]]
> = [
  [/\b(20[12]\d)-(\d{2})-(\d{2})/g, (m) => [+m[1], +m[2], +m[3]]],
  [/\b(\d{1,2})\/(\d{1,2})\/(20[12]\d)\b/g, (m) => [+m[3], +m[1], +m[2]]],
  [
    new RegExp(
      `\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20[12]\\d)\\b`,
      "gi",
    ),
    (m) => [+m[3], MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]],
  ],
  [
    new RegExp(`\\b(\\d{1,2})\\s+${MONTH}\\s+(20[12]\\d)\\b`, "gi"),
    (m) => [+m[3], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]],
  ],
];

/** Every plausible calendar date written in the text, as YYYY-MM-DD. */
export function findDates(text: string): string[] {
  const out: string[] = [];
  for (const [pattern, parts] of DATE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const [y, m, d] = parts(match as RegExpExecArray);
      const date = new Date(Date.UTC(y, m - 1, d));
      if (
        date.getUTCFullYear() !== y ||
        date.getUTCMonth() !== m - 1 ||
        date.getUTCDate() !== d ||
        y < 2010 ||
        y > 2030
      ) {
        continue;
      }
      out.push(date.toISOString().slice(0, 10));
    }
  }
  return out;
}

/** Strips what only adds tokens: images, data urls, block id tags. */
export function cleanBody(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[image]")
    .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "[data]")
    .replace(/[ \t]*\^[A-Za-z0-9_-]{6,}[ \t]*$/gm, "")
    .replace(/\(__NOTION__[^)]*\)/g, "(notion-link)")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sourceOf(input: NoteStateInput, body: string): NoteSource {
  if (/Link back:\*?\s*\[?https:\/\/chatgpt\.com/i.test(body)) {
    return "chatgpt_transcript";
  }
  if (/notion/i.test(input.originalSource ?? "")) return "notion_import";
  if (input.createdByAgent) return "agent";
  return "user";
}

export function buildNoteState(input: NoteStateInput, today: Date): NoteState {
  const body = cleanBody(input.markdown);
  const dates = findDates(body).sort();
  const latest = dates.at(-1) ?? null;
  const todayIso = today.toISOString().slice(0, 10);
  const truncated = body.length > BODY_CAP;
  return {
    facts: {
      source: sourceOf(input, body),
      path: input.path || "(unfiled)",
      created: input.createdAt.toISOString().slice(0, 10),
      words: body.match(/\w+/g)?.length ?? 0,
      headings: body.match(/^#{1,3} /gm)?.length ?? 0,
      links: body.match(/https?:\/\//g)?.length ?? 0,
      views30d: input.views30d,
      latestDateInBody: latest,
      latestDateIsPast: latest ? latest < todayIso : null,
      truncated,
      linkUrl: linkOnlyUrl(body),
    },
    note: {
      title: input.title,
      body: truncated
        ? `${body.slice(0, HEAD)}\n\n[… middle of note omitted …]\n\n${body.slice(-TAIL)}`
        : body,
    },
  };
}
