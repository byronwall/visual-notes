import { For, type Component } from "solid-js";
import { Box } from "styled-system/jsx";
import type { RenderedCodeLines } from "./renderCodeLines";

type LineNumberedCodeViewProps = {
  rendered: RenderedCodeLines;
};

export const LineNumberedCodeView: Component<LineNumberedCodeViewProps> = (
  props,
) => {
  return (
    <Box
      as="pre"
      m="0"
      p="0"
      fontFamily="mono"
      fontSize="sm"
      lineHeight="1.6"
      whiteSpace="pre-wrap"
      overflowWrap="anywhere"
      style={{
        "--md-code-line-digits": String(props.rendered.lineDigits),
        "--md-code-gutter-ch": `calc(var(--md-code-line-digits) + 2)`,
      }}
      css={{
        "& .code-line": {
          display: "block",
          position: "relative",
          paddingLeft: "calc(var(--md-code-gutter-ch) * 1ch)",
          minHeight: "1.6em",
        },
        "& .code-line::before": {
          content: "attr(data-line)",
          position: "absolute",
          left: "0",
          width: "calc(var(--md-code-line-digits) * 1ch)",
          textAlign: "right",
          color: "fg.muted",
          userSelect: "none",
          opacity: "0.9",
        },
      }}
    >
      <Box as="code" display="block" p="0" m="0" bg="transparent" borderWidth="0">
        <For each={props.rendered.lines}>
          {(line, index) => (
            <Box
              as="span"
              class="code-line"
              data-line={String(index() + 1)}
              data-md-language={props.rendered.language}
              innerHTML={line || " "}
            />
          )}
        </For>
      </Box>
    </Box>
  );
};
