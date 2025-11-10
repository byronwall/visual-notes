export type Source = "paste" | "drop" | "file";
export type MarkdownPromptFn = (
  text: string,
  src: Source
) => Promise<"formatted" | "text" | "cancel">;

let markdownPrompt: MarkdownPromptFn | undefined;

export function setMarkdownPrompt(fn?: MarkdownPromptFn) {
  markdownPrompt = fn;
}

export function getMarkdownPrompt(): MarkdownPromptFn | undefined {
  return markdownPrompt;
}
