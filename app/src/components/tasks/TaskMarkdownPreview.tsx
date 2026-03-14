import { createMemo } from "solid-js";
import { Box } from "styled-system/jsx";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";

type Props = {
  markdown: string;
  onClick: () => void;
};

function normalizeTaskMarkdown(markdown: string): string {
  return markdown.replace(/==([^=\n][^=\n]*?)==/g, "<mark>$1</mark>");
}

export const TaskMarkdownPreview = (props: Props) => {
  const html = createMemo(() =>
    normalizeMarkdownToHtml(normalizeTaskMarkdown(props.markdown))
  );

  return (
    <Box
      class="task-markdown-preview"
      flex="1"
      minW="0"
      cursor="text"
      onClick={(event) => {
        event.stopPropagation();
        const target = event.target;
        if (target instanceof Element && target.closest("a")) return;
        props.onClick();
      }}
      innerHTML={html()}
    />
  );
};
