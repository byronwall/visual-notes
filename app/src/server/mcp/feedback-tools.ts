import { z } from "zod";
import { createNote } from "./notes-write";
import type { ToolRegistrar } from "./tool-registry";

// The calling agent reports a problem with the connector, or a missing
// feature, with a proposed fix. Each report is a note at one fixed path with
// a task line, so it shows up in the Tasks inbox for the user to triage.

export const FEEDBACK_PATH = "work.visual-notes.feedback";

export const FEEDBACK_INSTRUCTIONS =
  "Feedback: when a Visual Notes tool fails in a way you cannot fix, gives a confusing result or error, or lacks something you needed, call feedback_submit once with what you tried, what happened, and the change you propose. Do it after you finish or give up on the user's request, not instead of it. Do not report the user's own content or ordinary refusals you fixed by changing your input.";

const KINDS = ["bug", "confusing", "missing"] as const;

export function feedbackMarkdown(
  input: {
    kind: (typeof KINDS)[number];
    summary: string;
    tool?: string;
    happened: string;
    proposedFix: string;
  },
  agent: string,
): string {
  return [
    `- [ ] Triage connector feedback: ${input.summary}`,
    "",
    `**Kind:** ${input.kind}`,
    `**Tool:** ${input.tool ? `\`${input.tool}\`` : "none named"}`,
    `**From:** ${agent}`,
    "",
    "## What happened",
    "",
    input.happened,
    "",
    "## Proposed fix",
    "",
    input.proposedFix,
  ].join("\n");
}

export function registerFeedbackTools(tools: ToolRegistrar): void {
  const { ctx } = tools;

  tools.write(
    "feedback_submit",
    {
      title: "Report a connector problem",
      description:
        "Tell the developer about a problem with these tools or something they lack, with a proposed fix. Saves one note with a triage task in the user's Tasks inbox. Use it for the connector itself (a wrong result, an unclear error or description, a missing tool or field), not for the user's content.",
      input: {
        kind: z
          .enum(KINDS)
          .describe(
            "bug = wrong result or failure; confusing = unclear description, error, or result; missing = a tool or field you needed",
          ),
        summary: z
          .string()
          .min(1)
          .max(120)
          .describe("One line, e.g. 'notes_edit_blocks drops table rows'"),
        tool: z
          .string()
          .optional()
          .describe("The tool this is about, when there is one"),
        happened: z
          .string()
          .min(1)
          .max(4000)
          .describe(
            "What you called (inputs, trimmed), what came back, and what you expected",
          ),
        proposedFix: z
          .string()
          .min(1)
          .max(4000)
          .describe(
            "The change you suggest: new wording, a new field or tool, or a behavior change",
          ),
      },
    },
    async (args) => {
      const note = await createNote(ctx, {
        title: `Feedback: ${args.summary}`,
        path: FEEDBACK_PATH,
        markdown: feedbackMarkdown(args, ctx.clientName || "Agent"),
      });
      return {
        id: note.id,
        title: note.title,
        path: note.path,
        appUrl: note.appUrl,
        saved: "The report is a note with a triage task in the user's Tasks inbox.",
      };
    },
  );
}
