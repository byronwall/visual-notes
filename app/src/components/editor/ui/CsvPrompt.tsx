import { usePasteChoicePrompt } from "./usePasteChoicePrompt";

export type Choice = "table" | "text" | "cancel";

export function useCsvPrompt() {
  return usePasteChoicePrompt<Choice>({
    cancelChoice: "cancel",
    logPrefix: "csv",
    title: "Paste detected as CSV/TSV",
    description: "Choose how to insert the content:",
    options: [
      { label: "Paste contents directly", value: "text" },
      { label: "Paste as table", value: "table" },
    ],
    maxW: "720px",
    previewLimit: 500,
  });
}
