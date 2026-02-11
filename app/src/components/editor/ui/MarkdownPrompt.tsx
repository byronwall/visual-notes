import { usePasteChoicePrompt } from "./usePasteChoicePrompt";

export type MdChoice = "formatted" | "text" | "cancel";

export function useMarkdownPrompt() {
  return usePasteChoicePrompt<MdChoice>({
    cancelChoice: "cancel",
    logPrefix: "markdown",
    title: "Paste detected as Markdown",
    description: "Choose how to insert the content:",
    options: [
      { label: "Paste as raw text", value: "text" },
      { label: "Paste with formatting", value: "formatted" },
    ],
    maxW: "720px",
    previewLimit: 500,
  });
}
