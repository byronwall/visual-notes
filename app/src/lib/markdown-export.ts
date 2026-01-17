import type { Session, Round, Question, Answer } from "./domain";

/**
 * Exports a single round as markdown text
 */
export function exportRoundAsMarkdown(
  round: Round,
  roundNumber?: number
): string {
  const parts: string[] = [];

  const title = roundNumber ? `Round ${roundNumber}` : "Round Export";
  parts.push(`# ${title}\n`);
  parts.push(`**Date:** ${new Date(round.createdAt).toLocaleString()}\n`);
  parts.push("\n---\n");

  // Questions and Answers
  if (round.questions.length > 0) {
    parts.push("\n## Questions & Answers\n");

    round.questions.forEach((question, qIndex) => {
      const answer = round.answers.find((a) => a.questionId === question.id);
      parts.push(formatQuestionAndAnswer(question, answer, qIndex + 1));
    });
  }

  // Result
  if (round.result) {
    parts.push("\n## Analysis & Recommendations\n");
    parts.push(round.result);
    parts.push("\n");
  }

  return parts.join("\n");
}

/**
 * Exports a session as markdown text
 */
export function exportSessionAsMarkdown(session: Session): string {
  const parts: string[] = [];

  // Session header
  parts.push("# Session Export\n");

  if (session.title) {
    parts.push(`## ${session.title}\n`);
  }

  if (session.description) {
    parts.push(`${session.description}\n`);
  }

  parts.push("---\n");

  // Original prompt
  parts.push("## Original Prompt\n");
  parts.push(`${session.prompt}\n`);
  parts.push("\n---\n");

  // Rounds
  session.rounds.forEach((round, index) => {
    parts.push(formatRound(round, index + 1));
  });

  // Metadata
  parts.push("\n---\n");
  parts.push("## Session Information\n");
  parts.push(`- **Created:** ${new Date(session.createdAt).toLocaleString()}\n`);
  parts.push(`- **Updated:** ${new Date(session.updatedAt).toLocaleString()}\n`);
  parts.push(`- **Total Rounds:** ${session.rounds.length}\n`);

  return parts.join("\n");
}

/**
 * Formats a single round as markdown
 */
function formatRound(round: Round, roundNumber: number): string {
  const parts: string[] = [];

  parts.push(`## Round ${roundNumber}\n`);
  parts.push(`**Date:** ${new Date(round.createdAt).toLocaleString()}\n`);

  // Questions and Answers
  if (round.questions.length > 0) {
    parts.push("\n### Questions & Answers\n");

    round.questions.forEach((question, qIndex) => {
      const answer = round.answers.find((a) => a.questionId === question.id);
      parts.push(formatQuestionAndAnswer(question, answer, qIndex + 1));
    });
  }

  // Result
  if (round.result) {
    parts.push("\n### Analysis & Recommendations\n");
    parts.push(round.result);
    parts.push("\n");
  }

  parts.push("\n---\n");

  return parts.join("\n");
}

/**
 * Formats a question and its answer as markdown
 */
function formatQuestionAndAnswer(
  question: Question,
  answer: Answer | undefined,
  questionNumber: number
): string {
  const parts: string[] = [];

  parts.push(`#### ${questionNumber}. ${question.text}\n`);
  parts.push(`**Type:** ${formatQuestionType(question.type)}\n`);

  // Available options
  parts.push("\n**Options:**\n");
  question.options.forEach((option) => {
    const isSelected = answer?.selectedOptionIds.includes(option.id) ?? false;
    const checkbox = isSelected ? "[x]" : "[ ]";
    parts.push(`- ${checkbox} ${option.text}\n`);
  });

  // Custom input
  if (answer?.customInput) {
    parts.push("\n**Custom Response:**\n");
    parts.push(`> ${answer.customInput}\n`);
  }

  return parts.join("\n");
}

/**
 * Formats question type as human-readable text
 */
function formatQuestionType(type: string): string {
  const typeMap: Record<string, string> = {
    goal_discovery: "Goal Discovery",
    user_goals: "User Goals",
    output_related: "Output Related",
  };

  return typeMap[type] ?? type;
}

/**
 * Sanitizes a string to be safe for use as a filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Downloads a markdown string as a file
 */
export function downloadMarkdown(content: string, filename: string): void {
  console.log("downloadMarkdown", { filename, contentLength: content.length });

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  // Clean up
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
