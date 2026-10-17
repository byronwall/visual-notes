import { createMemo, splitProps, type JSX } from "solid-js";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";

type Props = Omit<JSX.HTMLAttributes<HTMLDivElement>, "onClick"> & {
  markdown: string;
  onClick: () => void;
};

function normalizeTaskMarkdown(markdown: string): string {
  return markdown.replace(/==([^=\n][^=\n]*?)==/g, "<mark>$1</mark>");
}

export const TaskMarkdownPreview = (props: Props) => {
  const [local, rest] = splitProps(props, ["markdown", "onClick"]);
  const html = createMemo(() =>
    normalizeMarkdownToHtml(normalizeTaskMarkdown(local.markdown))
  );

  return (
    <div
      {...rest}
      class={`task-markdown-preview ${rest.class ?? ""}`}
      onClick={(event) => {
        event.stopPropagation();
        const target = event.target;
        if (target instanceof Element && target.closest("a")) return;
        local.onClick();
      }}
      innerHTML={html()}
    />
  );
};
