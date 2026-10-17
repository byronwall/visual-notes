import "highlight.js/styles/github.css";

import { Box } from "styled-system/jsx";
import { cx } from "styled-system/css";
import { documentContentClass } from "./document-content-styles";

type ReadOnlyDocumentContentProps = {
  html: string;
  class?: string;
};

export function ReadOnlyDocumentContent(props: ReadOnlyDocumentContentProps) {
  return (
    <Box
      class={cx(documentContentClass, props.class)}
      position="relative"
      borderWidth="1px"
      borderColor="gray.outline.border"
      borderRadius="l2"
      bg="bg.default"
    >
      <Box class="vn-doc-content prose editor-prose" innerHTML={props.html} />
    </Box>
  );
}
