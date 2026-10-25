/**
 * Cleanup question set, vendor-neutral. `decide.ts` translates it to Jev or
 * OpenAI Decisions. Wording comes from the experiment in
 * docs/intent/notes-cleanup-decisions (question-design.md, results.md):
 * atomic questions, high = yes, score levels as situations, `other` on every
 * choice, dates and counting done in code. Rewording a question is a code
 * change: bump QUESTION_SET_VERSION so the sweep re-asks every note.
 */

export const QUESTION_SET_VERSION = "v1";

export type Option = readonly [key: string, description: string];

export type Question =
  | { id: string; type: "noul"; instructions: string }
  | { id: string; type: "choice"; instructions: string; options: Option[] }
  | { id: string; type: "score"; instructions: string; levels: Option[] };

/** Who the notes belong to; "specific" and "generic" mean nothing without it. */
export const OWNER_PROFILE = {
  about:
    "The owner of these notes: a senior full-stack developer (TypeScript, SolidJS, data viz, stats) with a young family. Hobbies: house projects and repairs, woodworking, electronics, Bible study. Builds his own tools, including this notes app.",
  keeps:
    "Things he wrote or decided himself: logs of what he did, project notes and build logs, measurements, model numbers, hard-won fixes, plans still in progress, personal opinions and lessons, family records.",
  drops:
    "Generic explanations anyone could re-ask a chatbot or search for, plans and quotes for dates that have passed with nothing reusable, empty captures, leftovers from importing other tools.",
} as const;

export const NOTE_QUESTIONS: Question[] = [
  {
    id: "copied_or_generated",
    type: "noul",
    instructions:
      "Was most of `note.body` copied from a website or produced by a chatbot or agent, rather than written by `owner` in his own words?",
  },
  {
    id: "author_specific",
    type: "noul",
    instructions:
      "Does `note.body` contain something specific to `owner`: his own decisions, measurements, logs, plans, opinions, or results? A question he asked or a link he saved does not count by itself.",
  },
  {
    id: "rederivable",
    type: "noul",
    instructions:
      "Could a person get the useful content of `note.body` today with one general web search or chatbot question, with nothing lost?",
  },
  {
    id: "time_anchor",
    type: "choice",
    instructions: "What is `note.body` mainly organized around?",
    options: [
      [
        "ongoing_reference",
        "Reference or ideas that are useful at any time; not tied to a date.",
      ],
      [
        "one_event",
        "A single trip, outing, appointment, purchase, or event that happens once.",
      ],
      [
        "period_plan",
        "Plans, quotes, schedules, or options for one specific window of time.",
      ],
      [
        "dated_log",
        "A running record of entries describing what already happened on past dates.",
      ],
      ["other", "None of the above fits."],
    ],
  },
  {
    id: "evergreen_core",
    type: "noul",
    instructions:
      "If `note.body` is about a dated event or plan, does it also contain information that would still be useful after that date, such as a packing list, contacts, lessons, or recurring sources? If it is not about a dated event or plan, answer yes.",
  },
  {
    id: "empty_or_stub",
    type: "noul",
    instructions:
      "Is `note.body` empty, a title with no content, or a single link or line with no explanation?",
  },
  {
    id: "import_junk",
    type: "noul",
    instructions:
      "Is most of `note.body` leftover formatting from an import, such as delimiter rows (|||), lists of links to other pages, or metadata lines, rather than readable content?",
  },
  {
    id: "is_todo",
    type: "noul",
    instructions:
      "Is the main content of `note.body` one or a few things `owner` intends to do but has not recorded as done?",
  },
  {
    id: "worth_reading",
    type: "noul",
    instructions:
      "Would `owner` learn or recall something useful by reading `note.body` today?",
  },
  {
    id: "title_fits",
    type: "noul",
    instructions:
      "Does `note.title` tell a reader what `note.body` is about, without opening it?",
  },
];
